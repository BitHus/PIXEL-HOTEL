// The crypt's layout (DG1, brief section 10 LAYOUT). Rooms are templates (rooms.ts) on a jittered 3 x 3 grid
// of zones, joined door to door by straight corridors of at most DUNGEON_CORRIDOR_MAX blocks, with a loop
// when there are 4 or more rooms, side nooks, a vault, secrets, a landmark and themed rooms (themes.ts), then
// a pacing pass (pacing.ts). Pure: all draws come from floorRng(seed, n) in ONE fixed order, so the same
// (seed, floor, round) is the same floor. A floor that breaks a rule (no loop, route too short or long) is drawn
// again from the same stream, up to DUNGEON_LAYOUT_ATTEMPTS times.
//
// ORDER OF DRAWS (never reorder without updating the golden hash in generate.test.ts):
//   0 room count
//   per attempt: 1 zones (start zone, growth), 2 templates (pick per room, sizes, L variants),
//     3 rooms + 4 links (per room: gap, position, link rows, wide chance), 5 loops (count, pick)
//   then 6 nooks, vault, secrets, 7 themes (per room, props kinds), 8 things (landmark, enemy counts and kinds
//     and places, chests, props), 9 pacing (enemy moves, prop fill).
// Chest counts, enemy counts and loot are those of the old layout (legacyLayout.ts).

import {
  BOSS_FLOOR,
  BOSS_HP_FLOOR_SCALING,
  DUNGEON_BLOCKS_H,
  DUNGEON_BLOCKS_W,
  DUNGEON_CORRIDOR_MAX,
  DUNGEON_LAYOUT_ATTEMPTS,
  DUNGEON_LINK_GAP_MAX,
  DUNGEON_LINK_GAP_MIN,
  DUNGEON_LOOPS,
  DUNGEON_NOOKS_MAX,
  DUNGEON_ROUNDS,
  DUNGEON_SECRETS_MAX,
  DUNGEON_TEMPLATE_MAX_PER_FLOOR,
  DUNGEON_WIDE_LINK_CHANCE,
  DUNGEON_ZONES,
  ENEMIES_PER_ROOM_MAX,
  ENEMIES_PER_ROOM_MIN,
  GOLDEN_CHEST_CHANCE,
  MIMIC_ONE_IN,
  PACE_ENEMY_GAP_BLOCKS,
  PACE_NEAR_BLOCKS,
  ROUTE_LEN_MAX,
  ROUTE_LEN_MIN,
  WOODEN_CHESTS_MAX,
  WOODEN_CHESTS_MIN,
  type EnemyKind,
} from '../config.ts';
import { rngInt, rngPick } from '../rng.ts';
import type { Rng } from '../types.ts';
import { blockCenter } from './grid.ts';
import { floorFn, propSpotOk } from './placement.ts';
import { generateLegacyCrypt } from './legacyLayout.ts';
import { blockDistances, chestSpotOk, floorRng, makeEnemy, type FloorPlan } from './layoutCommon.ts';
import { cheb, longestStretchWithout, nearest, routeBetween, type Cell } from './pacing.ts';
import { ROOM_TEMPLATES, getRoomTemplate, roomMask, type RoomTemplate } from './rooms.ts';
import type { BlockRect, Chest, ChestKind, DecorProp, DungeonBlock, DungeonMap, DungeonRoundId, Enemy, MapLink } from './run.ts';
import { LANDMARK_KINDS, getTheme, pickTheme, rollProps, type RoomTheme } from './themes.ts';

const COLS = DUNGEON_BLOCKS_W;
const ROWS = DUNGEON_BLOCKS_H;
const PITCH = Math.floor((COLS - 1) / DUNGEON_ZONES);
const ZONE = PITCH - 1;
/** 0 east, 1 south, 2 west, 3 north. */
const DIRS = [{ dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 0, dr: -1 }] as const;
const CORRIDOR_PROPS = ['rubble', 'bones', 'candle_stand', 'cobweb'] as const;
const NOOK_PROPS = ['barrel', 'crate', 'bones', 'candle_stand'] as const;
const PLACE_TRIES = 12;

interface Placed {
  rect: BlockRect;
  mask: boolean[];
  template: string;
  zc: number;
  zr: number;
  doors: Cell[];
}

interface Structure {
  rooms: Placed[];
  blocks: DungeonBlock[];
  links: MapLink[];
  loops: number;
}

const idx = (c: number, r: number): number => r * COLS + c;
const key = (p: Cell): number => idx(p.c, p.r);

function floorAt(room: Placed, c: number, r: number): boolean {
  const { x, y, w, h } = room.rect;
  return c >= x && r >= y && c < x + w && r < y + h && room.mask[(r - y) * w + (c - x)] === true;
}

function overlaps(a: BlockRect, b: BlockRect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function roomCells(room: Placed): Cell[] {
  const out: Cell[] = [];
  const { x, y, w, h } = room.rect;
  for (let r = y; r < y + h; r++) for (let c = x; c < x + w; c++) if (room.mask[(r - y) * w + (c - x)]) out.push({ c, r });
  return out;
}

function inRect(rect: BlockRect, c: number, r: number): boolean {
  return c >= rect.x && r >= rect.y && c < rect.x + rect.w && r < rect.y + rect.h;
}

function shuffle<T>(rng: Rng, list: readonly T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Every cell wall, inside the outer ring, and every neighbour wall, one of the cells, or an allowed floor block. */
function cellsFree(blocks: readonly DungeonBlock[], cells: readonly Cell[], allow: readonly Cell[] = []): boolean {
  const own = new Set(cells.map(key));
  const ok = new Set(allow.map(key));
  for (const p of cells) {
    if (p.c < 1 || p.r < 1 || p.c > COLS - 2 || p.r > ROWS - 2) return false;
    if (blocks[key(p)] !== 'wall') return false;
    for (const d of DIRS) {
      const k = idx(p.c + d.dc, p.r + d.dr);
      if (!own.has(k) && !ok.has(k) && blocks[k] !== 'wall') return false;
    }
  }
  return true;
}

interface LinkPlan {
  cells: Cell[];
  lo: Cell[];
  hi: Cell[];
}

/** A straight corridor between two rooms; `lo` is the west (or north) room, `hi` the east (or south) one. */
function planLink(rng: Rng, lo: Placed, hi: Placed, horizontal: boolean, blocks: readonly DungeonBlock[], all: readonly Placed[]): LinkPlan | null {
  const a = lo.rect;
  const b = hi.rect;
  const gap = horizontal ? b.x - (a.x + a.w) : b.y - (a.y + a.h);
  if (gap < 1 || gap > DUNGEON_CORRIDOR_MAX) return null;
  const from = horizontal ? Math.max(a.y, b.y) : Math.max(a.x, b.x);
  const to = horizontal ? Math.min(a.y + a.h, b.y + b.h) : Math.min(a.x + a.w, b.x + b.w);
  const ok: number[] = [];
  for (let t = from; t < to; t++) {
    const fl = horizontal ? floorAt(lo, a.x + a.w - 1, t) : floorAt(lo, t, a.y + a.h - 1);
    const fh = horizontal ? floorAt(hi, b.x, t) : floorAt(hi, t, b.y);
    if (fl && fh) ok.push(t);
  }
  if (ok.length === 0) return null;
  const wideRoll = rng() < DUNGEON_WIDE_LINK_CHANCE;
  const pairs = ok.filter((t) => ok.includes(t + 1));
  const lines = wideRoll && pairs.length > 0 ? (() => { const t = rngPick(rng, pairs); return [t, t + 1]; })() : [rngPick(rng, ok)];
  const cells: Cell[] = [];
  const dlo: Cell[] = [];
  const dhi: Cell[] = [];
  for (const t of lines) {
    if (horizontal) {
      for (let c = a.x + a.w; c < b.x; c++) cells.push({ c, r: t });
      dlo.push({ c: a.x + a.w - 1, r: t });
      dhi.push({ c: b.x, r: t });
    } else {
      for (let r = a.y + a.h; r < b.y; r++) cells.push({ c: t, r });
      dlo.push({ c: t, r: a.y + a.h - 1 });
      dhi.push({ c: t, r: b.y });
    }
  }
  if (cells.some((p) => all.some((room) => inRect(room.rect, p.c, p.r)))) return null;
  if (!cellsFree(blocks, cells, [...dlo, ...dhi])) return null;
  return { cells, lo: dlo, hi: dhi };
}

function carve(blocks: DungeonBlock[], cells: readonly Cell[]): void {
  for (const p of cells) blocks[key(p)] = 'floor';
}

function pickTemplate(rng: Rng, counts: Map<string, number>): RoomTemplate {
  const fit = ROOM_TEMPLATES.filter((t) => t.weight > 0 && (counts.get(t.id) ?? 0) < DUNGEON_TEMPLATE_MAX_PER_FLOOR);
  const total = fit.reduce((s, t) => s + t.weight, 0);
  let roll = rng() * total;
  for (const t of fit) {
    roll -= t.weight;
    if (roll < 0) return t;
  }
  return fit[fit.length - 1]!;
}

function makeRoom(rng: Rng, t: RoomTemplate, zc: number, zr: number): Placed {
  const w = rngInt(rng, t.w[0], t.w[1]);
  const h = rngInt(rng, t.h[0], t.h[1]);
  const variant = t.mask === 'ell' ? rngInt(rng, 0, 3) : 0;
  return { rect: { x: 0, y: 0, w, h }, mask: roomMask(t.mask, w, h, variant), template: t.id, zc, zr, doors: [] };
}

/** Steps 1 to 5: zones, templates, rooms, links, loops. null = this draw broke a rule. */
function buildStructure(rng: Rng, roomCount: number, round: DungeonRoundId, bossFloor: boolean): Structure | null {
  // 1. Zones: a connected set grown from a random start zone (4-neighbour growth).
  const zones: { zc: number; zr: number; parent: number; dir: number }[] = [];
  const dirOf = (from: { zc: number; zr: number }, to: { zc: number; zr: number }): number => DIRS.findIndex((d) => d.dc === to.zc - from.zc && d.dr === to.zr - from.zr);
  if (roomCount >= 4) {
    // A floor with a loop starts from a 2 x 2 square of zones (a loop needs a cycle of neighbours), walked round from a random corner.
    const ox = rngInt(rng, 0, DUNGEON_ZONES - 2);
    const oy = rngInt(rng, 0, DUNGEON_ZONES - 2);
    const corners = [{ zc: ox, zr: oy }, { zc: ox + 1, zr: oy }, { zc: ox + 1, zr: oy + 1 }, { zc: ox, zr: oy + 1 }];
    const first = rngInt(rng, 0, 3);
    const step = rng() < 0.5 ? 1 : 3;
    for (let k = 0; k < 4; k++) {
      const z = corners[(first + k * step) % 4]!;
      zones.push({ ...z, parent: k - 1, dir: k === 0 ? -1 : dirOf(zones[k - 1]!, z) });
    }
  } else {
    zones.push({ zc: rngInt(rng, 0, DUNGEON_ZONES - 1), zr: rngInt(rng, 0, DUNGEON_ZONES - 1), parent: -1, dir: -1 });
  }
  for (let tries = 0; zones.length < roomCount && tries < 500; tries++) {
    const p = rngInt(rng, 0, zones.length - 1);
    const dir = rngInt(rng, 0, 3);
    const zc = zones[p]!.zc + DIRS[dir]!.dc;
    const zr = zones[p]!.zr + DIRS[dir]!.dr;
    if (zc < 0 || zr < 0 || zc >= DUNGEON_ZONES || zr >= DUNGEON_ZONES || zones.some((z) => z.zc === zc && z.zr === zr)) continue;
    zones.push({ zc, zr, parent: p, dir });
  }
  if (zones.length < roomCount) return null;

  // 2. Templates: by weight, none more than DUNGEON_TEMPLATE_MAX_PER_FLOOR times; the boss floor ends in the arena.
  const counts = new Map<string, number>();
  const rooms: Placed[] = zones.map((z, i) => {
    const t = bossFloor && i === zones.length - 1 ? getRoomTemplate('arena') : pickTemplate(rng, counts);
    counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
    return makeRoom(rng, t, z.zc, z.zr);
  });
  if (roomCount >= 4 && counts.size < 3) return null;

  // 3 and 4. Rooms beside their parent in the zone direction, joined by a straight corridor.
  const blocks: DungeonBlock[] = new Array<DungeonBlock>(COLS * ROWS).fill('wall');
  const links: MapLink[] = [];
  const root = rooms[0]!;
  root.rect.x = 1 + root.zc * PITCH + rngInt(rng, 0, ZONE - root.rect.w);
  root.rect.y = 1 + root.zr * PITCH + rngInt(rng, 0, ZONE - root.rect.h);
  carve(blocks, roomCells(root));
  for (let i = 1; i < rooms.length; i++) {
    const room = rooms[i]!;
    const parent = rooms[zones[i]!.parent]!;
    const dir = zones[i]!.dir;
    const horizontal = dir === 0 || dir === 2;
    const zx = 1 + room.zc * PITCH;
    const zy = 1 + room.zr * PITCH;
    let placed = false;
    for (let t = 0; t < PLACE_TRIES && !placed; t++) {
      const g = rngInt(rng, DUNGEON_LINK_GAP_MIN, DUNGEON_LINK_GAP_MAX);
      const { w, h } = room.rect;
      const p = parent.rect;
      if (horizontal) {
        room.rect.x = dir === 0 ? p.x + p.w + g : p.x - g - w;
        room.rect.y = rngInt(rng, p.y - h + 1, p.y + p.h - 1);
      } else {
        room.rect.y = dir === 1 ? p.y + p.h + g : p.y - g - h;
        room.rect.x = rngInt(rng, p.x - w + 1, p.x + p.w - 1);
      }
      const cx = room.rect.x + Math.floor(w / 2);
      const cy = room.rect.y + Math.floor(h / 2);
      if (cx < zx || cy < zy || cx >= zx + ZONE || cy >= zy + ZONE) continue;
      if (rooms.slice(0, i).some((o) => overlaps(o.rect, room.rect))) continue;
      if (!cellsFree(blocks, roomCells(room))) continue;
      const lo = dir === 0 || dir === 1 ? parent : room;
      const hi = lo === parent ? room : parent;
      const plan = planLink(rng, lo, hi, horizontal, blocks, [...rooms.slice(0, i), room]);
      if (!plan) continue;
      carve(blocks, roomCells(room));
      carve(blocks, plan.cells);
      lo.doors.push(...plan.lo);
      hi.doors.push(...plan.hi);
      links.push({ a: zones[i]!.parent, b: i, cells: plan.cells });
      placed = true;
    }
    if (!placed) return null;
  }

  // 5. Loops: extra corridors between zone neighbours that are not joined yet.
  let loops = 0;
  if (roomCount >= 4) {
    const [lmin, lmax] = DUNGEON_LOOPS[round];
    const want = rngInt(rng, lmin, lmax);
    for (let k = 0; k < want; k++) {
      const found: { i: number; j: number; horizontal: boolean; plan: LinkPlan; lo: number; hi: number }[] = [];
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          if (links.some((l) => (l.a === i && l.b === j) || (l.a === j && l.b === i))) continue;
          const dc = rooms[j]!.zc - rooms[i]!.zc;
          const dr = rooms[j]!.zr - rooms[i]!.zr;
          if (Math.abs(dc) + Math.abs(dr) !== 1) continue;
          const horizontal = dr === 0;
          const iIsLo = horizontal ? dc > 0 : dr > 0;
          const lo = iIsLo ? i : j;
          const hi = iIsLo ? j : i;
          // The plan draws from the rng, so only plan the pairs that can work at all.
          const plan = planLink(rng, rooms[lo]!, rooms[hi]!, horizontal, blocks, rooms);
          if (plan) found.push({ i, j, horizontal, plan, lo, hi });
        }
      }
      if (found.length === 0) break;
      const f = rngPick(rng, found);
      carve(blocks, f.plan.cells);
      rooms[f.lo]!.doors.push(...f.plan.lo);
      rooms[f.hi]!.doors.push(...f.plan.hi);
      links.push({ a: f.i, b: f.j, cells: f.plan.cells });
      loops++;
    }
  }
  return { rooms, blocks, links, loops };
}

interface Attach {
  c: number;
  r: number;
  dc: number;
  dr: number;
}

/** A floor block next to a wall: the start of a nook or stub. */
function attachPoints(map: DungeonMap, cells: readonly Cell[]): Attach[] {
  const out: Attach[] = [];
  for (const p of cells) {
    for (const d of DIRS) {
      if (map.blocks[idx(p.c + d.dc, p.r + d.dr)] === 'wall') out.push({ c: p.c, r: p.r, dc: d.dc, dr: d.dr });
    }
  }
  return out;
}

function rectOf(cells: readonly Cell[]): BlockRect {
  const x = Math.min(...cells.map((p) => p.c));
  const y = Math.min(...cells.map((p) => p.r));
  return { x, y, w: Math.max(...cells.map((p) => p.c)) - x + 1, h: Math.max(...cells.map((p) => p.r)) - y + 1 };
}

export function generateCryptLayout(seed: number, n: number, round: DungeonRoundId): FloorPlan {
  const rules = DUNGEON_ROUNDS[round];
  const rng = floorRng(seed, n);
  const bossFloor = rules.boss && n === BOSS_FLOOR;
  const roomCount = rngInt(rng, rules.roomsMin, rules.roomsMax);

  let s: Structure | null = null;
  let spawn: Cell = { c: 0, r: 0 };
  let exit: Cell = { c: 0, r: 0 };
  let exitRoom = 0;
  let route: Cell[] = [];
  let partial: DungeonMap | null = null;
  let fallback: { s: Structure; spawn: Cell; exit: Cell; exitRoom: number; route: Cell[]; partial: DungeonMap } | null = null;
  for (let attempt = 0; attempt < DUNGEON_LAYOUT_ATTEMPTS; attempt++) {
    const built = buildStructure(rng, roomCount, round, bossFloor);
    if (!built) continue;
    const r0 = built.rooms[0]!;
    // The spawn: the floor block of the spawn room nearest its middle.
    const mid = { c: r0.rect.x + (r0.rect.w - 1) / 2, r: r0.rect.y + (r0.rect.h - 1) / 2 };
    let sp = roomCells(r0)[0]!;
    for (const p of roomCells(r0)) if (Math.hypot(p.c - mid.c, p.r - mid.r) < Math.hypot(sp.c - mid.c, sp.r - mid.r)) sp = p;
    const pm: DungeonMap = {
      seed, n, round, cols: COLS, rows: ROWS, blocks: built.blocks, rooms: built.rooms.map((r) => r.rect), spawn: blockCenter(sp.c, sp.r), exit: sp,
    };
    // The exit: the floor block farthest from the spawn (walking) in a room that is not the spawn room (the arena on the boss floor).
    const dist = blockDistances(pm, sp.c, sp.r);
    let ex = sp;
    let exr = 0;
    built.rooms.forEach((room, ri) => {
      if (ri === 0 || (bossFloor && ri !== built.rooms.length - 1)) return;
      for (const p of roomCells(room)) {
        if ((dist[key(p)] ?? -1) > (dist[key(ex)] ?? -1)) {
          ex = p;
          exr = ri;
        }
      }
    });
    pm.exit = ex;
    const steps = dist[key(ex)] ?? -1;
    const rt = routeBetween(pm, sp, ex);
    if (steps < 0 || rt.length === 0) continue;
    fallback = { s: built, spawn: sp, exit: ex, exitRoom: exr, route: rt, partial: pm };
    if (roomCount >= 4 && built.loops < 1) continue;
    if (steps < ROUTE_LEN_MIN || steps > ROUTE_LEN_MAX) continue;
    s = built;
    spawn = sp;
    exit = ex;
    exitRoom = exr;
    route = rt;
    partial = pm;
    break;
  }
  if (!s || !partial) {
    // Nothing fit the rules: take the last connected draw, else the old layout (practically never; a test counts it).
    if (!fallback) return generateLegacyCrypt(seed, n, round);
    s = fallback.s;
    spawn = fallback.spawn;
    exit = fallback.exit;
    exitRoom = fallback.exitRoom;
    route = fallback.route;
    partial = fallback.partial;
  }
  const { rooms, blocks, links } = s;
  const map = partial;
  const extras: BlockRect[] = [];
  const decor: DecorProp[] = [];
  const used = new Set<number>([key(spawn), key(exit)]);
  const addDecor = (kind: string, p: Cell): void => {
    decor.push({ id: decor.length + 1, kind, c: p.c, r: p.r, solid: false });
    used.add(key(p));
  };
  const isDoor = (p: Cell): boolean => rooms.some((room) => room.doors.some((d) => d.c === p.c && d.r === p.r));
  const outsideRooms = (cells: readonly Cell[]): boolean => cells.every((p) => !rooms.some((room) => inRect(room.rect, p.c, p.r)));
  const allRoomCells = rooms.map(roomCells);
  const dist = blockDistances(map, spawn.c, spawn.r);

  // 6. Nooks, vault, secrets.
  const roomAttach = (ri: number): Attach[] => attachPoints(map, allRoomCells[ri]!).filter((a) => !isDoor({ c: a.c, r: a.r }));
  const carveExtra = (cells: Cell[], rects: BlockRect[]): void => {
    carve(map.blocks, cells);
    extras.push(...rects);
  };
  const bigNook = (a: Attach, side: number): { cells: Cell[]; mouth: Cell; pocket: Cell[] } | null => {
    const mouth = { c: a.c + a.dc, r: a.r + a.dr };
    const px = a.dr !== 0 ? 1 : 0;
    const py = a.dc !== 0 ? 1 : 0;
    const pocket: Cell[] = [];
    for (let k = 2; k <= 3; k++) {
      pocket.push({ c: a.c + a.dc * k, r: a.r + a.dr * k });
      pocket.push({ c: a.c + a.dc * k + px * side, r: a.r + a.dr * k + py * side });
    }
    const cells = [mouth, ...pocket];
    return cellsFree(map.blocks, cells, [{ c: a.c, r: a.r }]) && outsideRooms(cells) ? { cells, mouth, pocket } : null;
  };
  const stubFits = (a: Attach, len: number): Cell[] | null => {
    const cells: Cell[] = [];
    for (let k = 1; k <= len; k++) cells.push({ c: a.c + a.dc * k, r: a.r + a.dr * k });
    return cellsFree(map.blocks, cells, [{ c: a.c, r: a.r }]) && outsideRooms(cells) ? cells : null;
  };

  // Side nooks: a 2 deep stub, or a 1 block mouth with a 2 x 2 pocket behind it.
  const nookCount = rngInt(rng, 1, DUNGEON_NOOKS_MAX);
  for (let k = 0; k < nookCount; k++) {
    const ri = rngInt(rng, 0, rooms.length - 1);
    const big = rng() < 0.5;
    const side = rng() < 0.5 ? 1 : -1;
    for (const a of shuffle(rng, roomAttach(ri)).slice(0, 12)) {
      if (big) {
        const nook = bigNook(a, side);
        if (!nook) continue;
        carveExtra(nook.cells, [{ x: nook.mouth.c, y: nook.mouth.r, w: 1, h: 1 }, rectOf(nook.pocket)]);
        if (rng() < 0.6) addDecor(rngPick(rng, NOOK_PROPS), nook.pocket[0]!);
        break;
      }
      const cells = stubFits(a, 2);
      if (!cells) continue;
      carveExtra(cells, [rectOf(cells)]);
      break;
    }
  }

  // Vault: a 1 block mouth and a 2 x 2 pocket in a mid-distance room that is not the spawn or exit room.
  const goldenRoll = !bossFloor && rng() < GOLDEN_CHEST_CHANCE;
  const wooden = rngInt(rng, WOODEN_CHESTS_MIN, WOODEN_CHESTS_MAX);
  let woodenLeft = wooden;
  const chests: Chest[] = [];
  const chestBlocks: Cell[] = [];
  const addChest = (kind: ChestKind, b: Cell, mimic = false): void => {
    const p = blockCenter(b.c, b.r);
    chests.push({ id: chests.length + 1, kind, mimic, opened: false, x: p.x, y: p.y });
    chestBlocks.push(b);
    used.add(key(b));
  };
  const spawnRect = rooms[0]!.rect;
  const woodenChest = (b: Cell): void => {
    addChest('wooden', b, rules.mimics && rng() < 1 / MIMIC_ONE_IN);
    woodenLeft--;
  };
  const mid = rooms
    .map((_, i) => i)
    .filter((i) => i !== 0 && i !== exitRoom)
    .sort((a, b) => (dist[key(allRoomCells[a]![0]!)] ?? 0) - (dist[key(allRoomCells[b]![0]!)] ?? 0));
  const vaultOrder = mid.length > 0 ? [...mid.slice(Math.floor(mid.length / 2)), ...mid.slice(0, Math.floor(mid.length / 2))] : [];
  let vaultChestAt: Cell | null = null;
  for (const ri of vaultOrder) {
    for (const a of shuffle(rng, roomAttach(ri)).slice(0, 16)) {
      const nook = bigNook(a, rng() < 0.5 ? 1 : -1);
      if (!nook) continue;
      const spot = nook.pocket.find((p) => chestSpotOk(p, spawnRect, []));
      if (!spot) continue;
      carveExtra(nook.cells, [{ x: nook.mouth.c, y: nook.mouth.r, w: 1, h: 1 }, rectOf(nook.pocket)]);
      vaultChestAt = spot;
      used.add(key(spot));
      addDecor('vault_arch', nook.mouth);
      break;
    }
    if (vaultChestAt) break;
  }

  // Secrets: dead-end stubs of 2 to 3 blocks off a room or corridor, marked by a crack prop at the mouth.
  const secretCells: Cell[] = [...allRoomCells.slice(1).flat(), ...links.flatMap((l) => l.cells)];
  const secretSpots: Cell[] = [];
  const secretCount = rngInt(rng, 1, DUNGEON_SECRETS_MAX);
  const secretAttach = shuffle(rng, attachPoints(map, secretCells).filter((a) => !isDoor({ c: a.c, r: a.r })));
  let at = 0;
  for (let k = 0; k < secretCount; k++) {
    const len = rngInt(rng, 2, 3);
    for (; at < secretAttach.length; at++) {
      const a = secretAttach[at]!;
      if (used.has(key({ c: a.c, r: a.r }))) continue;
      const cells = stubFits(a, len);
      if (!cells) continue;
      carveExtra(cells, [rectOf(cells)]);
      addDecor('crack', { c: a.c, r: a.r });
      secretSpots.push(cells[cells.length - 1]!);
      at++;
      break;
    }
  }

  // 7. Themes: spawn = campfire, the boss floor's exit room = arena, the rest by weight (a calm room only on floors of 4 or more rooms, one per floor, so the enemy total holds).
  const themes: RoomTheme[] = [];
  rooms.forEach((room, i) => {
    if (i === 0) return void themes.push(getTheme('campfire'));
    if (bossFloor && i === rooms.length - 1) return void themes.push(getTheme('arena'));
    let t = pickTheme(rng, round, room.template);
    for (let tries = 0; t.enemies === 'none' && tries < 8 && (rooms.length < 4 || themes.some((x, j) => j > 0 && x.enemies === 'none')); tries++) t = pickTheme(rng, round, room.template);
    themes.push(t);
  });
  const propKinds = themes.map((t) => rollProps(rng, t));

  // 8. Things. Landmark first (it keeps its block), then enemies, chests, props.
  const farFromSpawn = (p: Cell): boolean => cheb(p, spawn) >= 4;
  const freeCells = (ri: number, filter: (p: Cell) => boolean = () => true): Cell[] => allRoomCells[ri]!.filter((p) => !used.has(key(p)) && !isDoor(p) && filter(p));
  const landmarkRooms = rooms.map((_, i) => i).filter((i) => i !== 0 && !(bossFloor && i === rooms.length - 1));
  const lmRoom = rngPick(rng, landmarkRooms.length > 0 ? landmarkRooms : [0]);
  const lmKind = rngPick(rng, LANDMARK_KINDS);
  {
    const room = rooms[lmRoom]!;
    const cx = room.rect.x + (room.rect.w - 1) / 2;
    const cy = room.rect.y + (room.rect.h - 1) / 2;
    const free = freeCells(lmRoom).sort((a, b) => Math.hypot(a.c - cx, a.r - cy) - Math.hypot(b.c - cx, b.r - cy));
    if (free[0]) addDecor(lmKind, free[0]);
  }

  interface PlacedEnemy {
    kind: EnemyKind;
    c: number;
    r: number;
  }
  const enemies: PlacedEnemy[] = [];
  const bossFor = (): void => {
    const b = rngPick(rng, freeCells(exitRoom));
    used.add(key(b));
    enemies.push({ kind: 'bone_king', c: b.c, r: b.r });
  };
  if (bossFloor) {
    // A golden chest right next to the exit, inside the arena (a floor block of the room), then the king.
    const next = DIRS.map((d) => ({ c: exit.c + d.dc, r: exit.r + d.dr })).find((b) => floorAt(rooms[exitRoom]!, b.c, b.r) && !used.has(key(b)));
    if (next) addChest('golden', next);
    if (freeCells(exitRoom).length > 0) bossFor();
  }
  const counts = rooms.map((_, i) => (i === 0 ? 0 : rngInt(rng, ENEMIES_PER_ROOM_MIN, ENEMIES_PER_ROOM_MAX)));
  themes.forEach((t, i) => {
    if (i === 0 || t.enemies !== 'none') return;
    let moved = counts[i]!;
    counts[i] = 0;
    while (moved-- > 0) {
      const open = rooms.map((_, j) => j).filter((j) => j !== 0 && themes[j]!.enemies !== 'none' && counts[j]! < ENEMIES_PER_ROOM_MAX);
      if (open.length === 0) break;
      counts[rngPick(rng, open)]!++;
    }
  });
  const pillarNeighbour = (ri: number, p: Cell): boolean => DIRS.some((d) => inRect(rooms[ri]!.rect, p.c + d.dc, p.r + d.dr) && !floorAt(rooms[ri]!, p.c + d.dc, p.r + d.dr));
  const nearDoor = (ri: number, p: Cell): boolean => rooms[ri]!.doors.some((d) => cheb(p, d) <= 2);
  rooms.forEach((_, ri) => {
    for (let k = 0; k < counts[ri]!; k++) {
      const kind = rngPick(rng, rules.enemies);
      const style = themes[ri]!.enemies;
      let free = freeCells(ri, farFromSpawn);
      const styled = style === 'ambush' ? free.filter((p) => pillarNeighbour(ri, p)) : style === 'guard' ? free.filter((p) => nearDoor(ri, p)) : free;
      if (styled.length > 0) free = styled;
      if (free.length === 0) break;
      const b = rngPick(rng, free);
      used.add(key(b));
      enemies.push({ kind, c: b.c, r: b.r });
    }
  });

  // Chests are spread: never close to the spawn room and never close together; the vault and the secrets take theirs first.
  const others = rooms.slice(1);
  if (vaultChestAt) {
    if (goldenRoll) addChest('golden', vaultChestAt);
    else if (woodenLeft > 0) woodenChest(vaultChestAt);
    else addChest('wooden', vaultChestAt);
  }
  for (const spot of secretSpots) {
    if (woodenLeft > 1 && chestSpotOk(spot, spawnRect, chestBlocks)) woodenChest(spot);
    else addDecor('gem_pile', spot);
  }
  const chestSpot = (): Cell | null => {
    const first = rngPick(rng, others);
    const firstIndex = rooms.indexOf(first);
    for (const relax of [0, 1, 2]) {
      for (const pool of [[firstIndex], others.map((_, i) => i + 1)]) {
        const free = pool.flatMap((ri) => freeCells(ri)).filter((b) => chestSpotOk(b, spawnRect, chestBlocks, relax));
        if (free.length === 0) continue;
        return rngPick(rng, free);
      }
    }
    return null;
  };
  while (woodenLeft > 0) {
    const b = chestSpot();
    if (!b) break;
    woodenChest(b);
  }
  if (!bossFloor && goldenRoll && !vaultChestAt) {
    const b = chestSpot();
    if (b) addChest('golden', b);
  }

  // Props of the themes, one per free block, never on a door block.
  propKinds.forEach((kinds, ri) => {
    for (const kind of kinds) {
      const free = freeCells(ri, (p) => propSpotOk(kind, floorFn(map), p));
      if (free.length === 0) continue;
      addDecor(kind, rngPick(rng, free));
    }
  });

  // 9. Pacing. A block of the main route with no enemy within PACE_NEAR_BLOCKS for PACE_ENEMY_GAP_BLOCKS steps gets one: an enemy that
  // stands away from the route moves there (totals stay). Then every route block with no beat near gets a prop.
  const enemyCells = (): Cell[] => enemies.map((e) => ({ c: e.c, r: e.r }));
  const roomIndexOf = (p: Cell): number => rooms.findIndex((room) => floorAt(room, p.c, p.r));
  for (let guard = 0; guard < enemies.length * 2 + 2; guard++) {
    const cur = longestStretchWithout(route, enemyCells(), PACE_NEAR_BLOCKS);
    if (cur <= PACE_ENEMY_GAP_BLOCKS) break;
    // The middle of the first stretch that is too long.
    let start = 0;
    let target: Cell | null = null;
    const ec = enemyCells();
    route.forEach((p, i) => {
      if (target) return;
      if (nearest(p, ec) <= PACE_NEAR_BLOCKS) start = i;
      else if (i - start > PACE_ENEMY_GAP_BLOCKS) target = route[start + Math.floor(PACE_ENEMY_GAP_BLOCKS / 2)]!;
    });
    if (!target) break;
    const tgt: Cell = target;
    // The enemy whose move to that block shortens the longest stretch most.
    let move: { k: number; dest: Cell; stretch: number } | null = null;
    enemies.forEach((e, k) => {
      if (e.kind === 'bone_king') return;
      let dest: Cell | null = null;
      rooms.forEach((_, ri) => {
        if (ri === 0) return;
        if (enemies.filter((o, j) => j !== k && roomIndexOf(o) === ri).length >= ENEMIES_PER_ROOM_MAX) return;
        for (const p of freeCells(ri, farFromSpawn)) if (!dest || cheb(p, tgt) < cheb(dest, tgt)) dest = p;
      });
      if (!dest) return;
      const stretch = longestStretchWithout(route, ec.map((p, j) => (j === k ? dest! : p)), PACE_NEAR_BLOCKS);
      if (stretch < cur && (!move || stretch < move.stretch)) move = { k, dest, stretch };
    });
    if (!move) break;
    const mv: { k: number; dest: Cell } = move;
    const donor = enemies[mv.k]!;
    used.delete(key(donor));
    used.add(key(mv.dest));
    donor.c = mv.dest.c;
    donor.r = mv.dest.r;
  }
  const beats: Cell[] = [...enemyCells(), ...chestBlocks, ...decor];
  for (const p of route) {
    if (nearest(p, beats) <= PACE_NEAR_BLOCKS) continue;
    let spot: Cell | null = null;
    for (let radius = 0; radius <= PACE_NEAR_BLOCKS && !spot; radius++) {
      const ring: Cell[] = [];
      for (let r = p.r - radius; r <= p.r + radius; r++) {
        for (let c = p.c - radius; c <= p.c + radius; c++) {
          if (Math.max(Math.abs(c - p.c), Math.abs(r - p.r)) !== radius) continue;
          if (map.blocks[idx(c, r)] === 'floor' && !used.has(idx(c, r))) ring.push({ c, r });
        }
      }
      if (ring.length > 0) spot = rngPick(rng, ring);
    }
    if (!spot) continue;
    const here: Cell = spot;
    addDecor(rngPick(rng, CORRIDOR_PROPS.filter((k) => propSpotOk(k, floorFn(map), here))), spot);
    beats.push(spot);
  }

  const enemyList: Enemy[] = enemies.map((e, i) => {
    const pos = blockCenter(e.c, e.r);
    return makeEnemy(i + 1, e.kind, e.kind === 'bone_king' && !BOSS_HP_FLOOR_SCALING ? 1 : n, pos.x, pos.y);
  });
  map.links = links;
  map.extras = extras;
  map.decor = decor;
  map.roomInfo = rooms.map((room, i) => ({ template: room.template, theme: themes[i]!.id }));
  return { map, enemies: enemyList, chests, rocks: [] };
}
