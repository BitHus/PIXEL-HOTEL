// The dig mine's generator (MG-3, docs/PLAN-MINIGAMES.md 1.2). generateDigMine(seed, depth) is pure: the same seed and depth
// give the same cave. A cave is DIG_COLS x DIG_ROWS blocks; every block is solid (a kind from mineBlocks.json) except the open
// pockets. Steps: (a) stone with a dirt band on top and a bedrock border, (b) 4 to 7 open pockets from the spawn (top) to the
// exit (bottom), (c) ore veins by weights per depth, (d) the cheapest dig route spawn -> exit (hard blocks on it become stone,
// so bare hands always get through), (e) 0 to 2 rare blocks at least DIG_RARE_ROUTE_GAP blocks off that route, (f) slimes and
// bats and cave-in tiles in the pockets, none within DIG_SPAWN_CLEAR blocks of the spawn.

import {
  DIG_CAVEINS_PER_POCKET_MAX,
  DIG_COLS,
  DIG_DIRT_BAND,
  DIG_ENEMIES_PER_POCKET_MAX,
  DIG_POCKETS_MAX,
  DIG_POCKETS_MIN,
  DIG_RARE_MAX,
  DIG_RARE_ROUTE_GAP,
  DIG_ROWS,
  DIG_SPAWN_CLEAR,
  MINE_ENEMIES,
} from '../config.ts';
import { rngInt, rngPick } from '../rng.ts';
import type { Rng } from '../types.ts';
import { blockCenter } from './grid.ts';
import { floorRng, makeEnemy, type FloorPlan } from './layoutCommon.ts';
import { getMineBlock, rareWeights, veinWeights, type MineBlockId } from './mineBlocks.ts';
import type { BlockRect, DigHazard, DigState, DungeonBlock, DungeonMap, Enemy } from './run.ts';

/** A generated dig floor: the usual plan (no chests, no rocks) plus the dig state and what tests and art may want to know. */
export interface DigPlan extends FloorPlan {
  dig: DigState;
  /** The cheapest dig route from the spawn to the exit (cell indexes, spawn first). */
  route: number[];
  /** The open pockets (rects in blocks; [0] is the spawn pocket, the last one the exit pocket). */
  pockets: BlockRect[];
}

const idx = (c: number, r: number): number => r * DIG_COLS + c;
const NEIGH: readonly (readonly [number, number])[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

function pickWeighted<T extends { id: MineBlockId; weight: number }>(rng: Rng, list: readonly T[]): T {
  const total = list.reduce((a, x) => a + x.weight, 0);
  let roll = rng() * total;
  for (const x of list) {
    roll -= x.weight;
    if (roll < 0) return x;
  }
  return list[list.length - 1]!;
}

/** Carves a pocket: a rectangle with rounded (cut) corners. Cells stay inside the bedrock border. */
function carve(kinds: (MineBlockId | '')[], rect: BlockRect): void {
  for (let r = rect.y; r < rect.y + rect.h; r++) {
    for (let c = rect.x; c < rect.x + rect.w; c++) {
      if (c < 1 || r < 1 || c >= DIG_COLS - 1 || r >= DIG_ROWS - 1) continue;
      const corner = (c === rect.x || c === rect.x + rect.w - 1) && (r === rect.y || r === rect.y + rect.h - 1);
      if (corner && rect.w > 3 && rect.h > 3) continue;
      kinds[idx(c, r)] = '';
    }
  }
}

const rectCenter = (p: BlockRect): { c: number; r: number } => ({ c: p.x + Math.floor(p.w / 2), r: p.y + Math.floor(p.h / 2) });

/** A tiny binary heap of [cost, cell] pairs for the route search. */
class MinHeap {
  private readonly a: [number, number][] = [];
  get size(): number {
    return this.a.length;
  }
  push(cost: number, cell: number): void {
    const a = this.a;
    a.push([cost, cell]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p]![0] < a[i]![0] || (a[p]![0] === a[i]![0] && a[p]![1] <= a[i]![1])) break;
      [a[p], a[i]] = [a[i]!, a[p]!];
      i = p;
    }
  }
  pop(): [number, number] {
    const a = this.a;
    const top = a[0]!;
    const last = a.pop()!;
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        const less = (x: number, y: number): boolean => a[x]![0] < a[y]![0] || (a[x]![0] === a[y]![0] && a[x]![1] < a[y]![1]);
        if (l < a.length && less(l, m)) m = l;
        if (r < a.length && less(r, m)) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i]!, a[m]!];
        i = m;
      }
    }
    return top;
  }
}

/** The cost of walking onto a cell on the cheapest route: open = 1, a block = 2 + its hits, a hard block (steel pickaxe) a lot more, bedrock never. */
function stepCost(kind: MineBlockId | ''): number {
  if (kind === '') return 1;
  const b = getMineBlock(kind);
  if (b.unbreakable) return Infinity;
  return 2 + b.hits + (b.hard ? 100 : 0);
}

/** The cheapest dig route between two cells (4 directions, fixed neighbour order = deterministic). Cell indexes, from first to last; null if none. */
export function cheapestRoute(kinds: readonly (MineBlockId | '')[], from: number, to: number): number[] | null {
  const dist = new Float64Array(kinds.length).fill(Infinity);
  const prev = new Int32Array(kinds.length).fill(-1);
  const heap = new MinHeap();
  dist[from] = 0;
  heap.push(0, from);
  while (heap.size > 0) {
    const [d, cell] = heap.pop();
    if (d > dist[cell]!) continue;
    if (cell === to) break;
    const c = cell % DIG_COLS;
    const r = (cell - c) / DIG_COLS;
    for (const [dc, dr] of NEIGH) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= DIG_COLS || nr >= DIG_ROWS) continue;
      const n = idx(nc, nr);
      const cost = stepCost(kinds[n]!);
      if (!Number.isFinite(cost)) continue;
      const nd = d + cost;
      if (nd < dist[n]!) {
        dist[n] = nd;
        prev[n] = cell;
        heap.push(nd, n);
      }
    }
  }
  if (!Number.isFinite(dist[to]!)) return null;
  const out: number[] = [];
  for (let c = to; c !== -1; c = prev[c]!) out.push(c);
  return out.reverse();
}

/** Distance in blocks (4 directions, through anything) from the nearest of the given cells to every cell. */
function distanceField(sources: readonly number[]): Int32Array {
  const dist = new Int32Array(DIG_COLS * DIG_ROWS).fill(-1);
  const queue: number[] = [];
  for (const s of sources) {
    dist[s] = 0;
    queue.push(s);
  }
  for (let k = 0; k < queue.length; k++) {
    const cell = queue[k]!;
    const c = cell % DIG_COLS;
    const r = (cell - c) / DIG_COLS;
    for (const [dc, dr] of NEIGH) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= DIG_COLS || nr >= DIG_ROWS) continue;
      const n = idx(nc, nr);
      if (dist[n] !== -1) continue;
      dist[n] = dist[cell]! + 1;
      queue.push(n);
    }
  }
  return dist;
}

/** Blocks away (4 directions, through anything) between two cells: the plain Manhattan distance. */
export const blockSteps = (a: number, b: number): number => Math.abs((a % DIG_COLS) - (b % DIG_COLS)) + Math.abs(Math.floor(a / DIG_COLS) - Math.floor(b / DIG_COLS));

export function generateDigMine(seed: number, depth: number): DigPlan {
  const rng = floorRng(seed, 1000 + depth);
  const kinds: (MineBlockId | '')[] = new Array(DIG_COLS * DIG_ROWS).fill('stone');

  // (a) the dirt band and the bedrock border.
  for (let r = 0; r < DIG_ROWS; r++) {
    for (let c = 0; c < DIG_COLS; c++) {
      if (c === 0 || r === 0 || c === DIG_COLS - 1 || r === DIG_ROWS - 1) kinds[idx(c, r)] = 'bedrock';
      else if (r <= DIG_DIRT_BAND) kinds[idx(c, r)] = rng() < 0.3 ? 'clay' : 'dirt';
    }
  }

  // (b) the pockets: the spawn pocket at the top, the exit pocket at the bottom, the others spread between.
  const n = rngInt(rng, DIG_POCKETS_MIN, DIG_POCKETS_MAX);
  const pockets: BlockRect[] = [];
  for (let i = 0; i < n; i++) {
    const w = i === 0 || i === n - 1 ? rngInt(rng, 5, 7) : rngInt(rng, 4, 8);
    const h = i === 0 || i === n - 1 ? rngInt(rng, 3, 4) : rngInt(rng, 3, 5);
    const row = i === 0 ? 7 : i === n - 1 ? DIG_ROWS - 8 : Math.round(7 + ((DIG_ROWS - 15) * i) / (n - 1)) + rngInt(rng, -3, 3);
    const col = i === 0 ? Math.floor(DIG_COLS / 2) + rngInt(rng, -6, 6) : rngInt(rng, 6, DIG_COLS - 7);
    const x = Math.max(2, Math.min(DIG_COLS - 2 - w, col - Math.floor(w / 2)));
    const y = Math.max(DIG_DIRT_BAND + 2, Math.min(DIG_ROWS - 2 - h, row - Math.floor(h / 2)));
    const rect = { x, y, w, h };
    pockets.push(rect);
    carve(kinds, rect);
  }
  const spawnCell = rectCenter(pockets[0]!);
  const exitCell = rectCenter(pockets[n - 1]!);
  const spawn = idx(spawnCell.c, spawnCell.r);
  const exit = idx(exitCell.c, exitCell.r);

  // (c) ore veins: a few random-walk blobs of one kind, the kinds by weight at this depth.
  const veins = veinWeights(depth);
  const veinCount = 28 + depth * 3;
  for (let v = 0; v < veinCount; v++) {
    const kind = pickWeighted(rng, veins).id;
    let c = rngInt(rng, 2, DIG_COLS - 3);
    let r = rngInt(rng, DIG_DIRT_BAND + 1, DIG_ROWS - 3);
    const size = rngInt(rng, 2, 5);
    for (let k = 0; k < size; k++) {
      const i = idx(c, r);
      if (kinds[i] === 'stone') kinds[i] = kind;
      const [dc, dr] = rngPick(rng, NEIGH);
      c = Math.max(1, Math.min(DIG_COLS - 2, c + dc));
      r = Math.max(1, Math.min(DIG_ROWS - 2, r + dr));
    }
  }

  // (d) the cheapest dig route; a hard block on it becomes stone (a bare-handed player always gets through).
  const route = cheapestRoute(kinds, spawn, exit) ?? [spawn, exit];
  for (const cell of route) if (kinds[cell] !== '' && getMineBlock(kinds[cell] as MineBlockId).hard) kinds[cell] = 'stone';
  const routeDist = distanceField(route);

  // (e) rare blocks: 0 to DIG_RARE_MAX, far from the route and the spawn, from the kinds this depth allows.
  const rares = rareWeights(depth);
  const rare: number[] = [];
  if (rares.length > 0) {
    const want = rngInt(rng, 0, DIG_RARE_MAX);
    for (let k = 0; k < want; k++) {
      for (let tries = 0; tries < 200; tries++) {
        const c = rngInt(rng, 2, DIG_COLS - 3);
        const r = rngInt(rng, DIG_DIRT_BAND + 1, DIG_ROWS - 3);
        const i = idx(c, r);
        if (kinds[i] === '' || kinds[i] === 'bedrock' || rare.includes(i)) continue;
        if (routeDist[i]! < DIG_RARE_ROUTE_GAP || blockSteps(i, spawn) < DIG_SPAWN_CLEAR + DIG_RARE_ROUTE_GAP) continue;
        kinds[i] = pickWeighted(rng, rares).id;
        rare.push(i);
        break;
      }
    }
  }

  const blocks: DungeonBlock[] = kinds.map((k) => (k === '' ? 'floor' : 'wall'));
  const openIn = (p: BlockRect): number[] => {
    const out: number[] = [];
    for (let r = p.y; r < p.y + p.h; r++) for (let c = p.x; c < p.x + p.w; c++) if (kinds[idx(c, r)] === '') out.push(idx(c, r));
    return out;
  };
  const farFromSpawn = (cell: number): boolean => blockSteps(cell, spawn) >= DIG_SPAWN_CLEAR;

  // (f) enemies and cave-in tiles in the pockets (not near the spawn, never on the exit).
  const enemies: Enemy[] = [];
  const hazards: DigHazard[] = [];
  const taken = new Set<number>([spawn, exit]);
  for (let i = 1; i < n; i++) {
    const cells = openIn(pockets[i]!).filter((cell) => farFromSpawn(cell));
    if (cells.length === 0) continue;
    const enemyCount = rngInt(rng, 0, DIG_ENEMIES_PER_POCKET_MAX);
    for (let k = 0; k < enemyCount; k++) {
      const cell = rngPick(rng, cells);
      if (taken.has(cell)) continue;
      taken.add(cell);
      const at = blockCenter(cell % DIG_COLS, Math.floor(cell / DIG_COLS));
      enemies.push(makeEnemy(enemies.length + 1, rngPick(rng, MINE_ENEMIES), depth, at.x, at.y));
    }
    const caveCount = rngInt(rng, 0, DIG_CAVEINS_PER_POCKET_MAX);
    for (let k = 0; k < caveCount; k++) {
      const cell = rngPick(rng, cells);
      if (taken.has(cell)) continue;
      taken.add(cell);
      hazards.push({ c: cell % DIG_COLS, r: Math.floor(cell / DIG_COLS), kind: 'cavein', state: 'armed', crackMs: 0 });
    }
  }

  const map: DungeonMap = {
    seed,
    n: depth,
    round: 1,
    cols: DIG_COLS,
    rows: DIG_ROWS,
    blocks,
    rooms: pockets,
    spawn: blockCenter(spawnCell.c, spawnCell.r),
    exit: exitCell,
    dig: true,
  };
  return { map, enemies, chests: [], rocks: [], dig: { depth, kinds, hits: {}, hazards, rare, rev: 0 }, route, pockets };
}
