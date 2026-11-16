// The OLD dungeon layout (random rectangles, nearest-room corridors). Kept unchanged for the mine
// (step 9c) and as the baseline of the DG1 tests; the crypt uses layout.ts. Same rng order as before.

import {
  BOSS_FLOOR,
  BOSS_HP_FLOOR_SCALING,
  DUNGEON_BLOCKS_H,
  DUNGEON_BLOCKS_W,
  DUNGEON_ROOM_BLOCKS_MAX,
  DUNGEON_ROOM_BLOCKS_MIN,
  DUNGEON_ROUNDS,
  ENEMIES_PER_ROOM_MIN,
  GOLDEN_CHEST_CHANCE,
  MIMIC_ONE_IN,
  MINE_ROCKS_PER_ROOM_MAX,
  MINE_ROCKS_PER_ROOM_MIN,
  ROCK_HITS,
  WOODEN_CHESTS_MAX,
  WOODEN_CHESTS_MIN,
  ENEMIES_PER_ROOM_MAX,
} from '../config.ts';
import { rngInt, rngPick } from '../rng.ts';
import type { Rng } from '../types.ts';
import { blockAt, blockCenter, isFloorBlock } from './grid.ts';
import { NO_EXIT, blockDistances, chestSpotOk, floorRng, makeEnemy, rollRockKind, roomBlocks, type FloorPlan, type LayoutRules } from './layoutCommon.ts';
import type { BlockRect, Chest, ChestKind, DungeonBlock, DungeonMap, DungeonRoundId, Enemy, Rock } from './run.ts';

/** The old crypt layout (kept for tests that compare totals). */
export function generateLegacyCrypt(seed: number, n: number, round: DungeonRoundId): FloorPlan {
  const r = DUNGEON_ROUNDS[round];
  return generateLegacyLayout(seed, n, round, { ...r, enemiesPerRoomMax: ENEMIES_PER_ROOM_MAX, kind: 'crypt', visit: 0 });
}

const GAP = 1; // wall blocks kept between rooms

function overlapsWithGap(a: BlockRect, b: BlockRect): boolean {
  return a.x - GAP < b.x + b.w && b.x - GAP < a.x + a.w && a.y - GAP < b.y + b.h && b.y - GAP < a.y + a.h;
}

function roomCenter(room: BlockRect): { c: number; r: number } {
  return { c: room.x + Math.floor(room.w / 2), r: room.y + Math.floor(room.h / 2) };
}

function placeRooms(rng: Rng, count: number, cols: number, rows: number): BlockRect[] {
  const rooms: BlockRect[] = [];
  for (let tries = 0; rooms.length < count; tries++) {
    // Start again if the rooms placed so far leave no space (practically never on 40 x 40).
    if (tries > 0 && tries % 400 === 0) rooms.length = 0;
    const w = rngInt(rng, DUNGEON_ROOM_BLOCKS_MIN, DUNGEON_ROOM_BLOCKS_MAX);
    const h = rngInt(rng, DUNGEON_ROOM_BLOCKS_MIN, DUNGEON_ROOM_BLOCKS_MAX);
    const room = { x: rngInt(rng, 1, cols - w - 1), y: rngInt(rng, 1, rows - h - 1), w, h };
    if (!rooms.some((r) => overlapsWithGap(room, r))) rooms.push(room);
  }
  return rooms;
}

export function generateLegacyLayout(seed: number, n: number, round: DungeonRoundId, rules: LayoutRules): FloorPlan {
  const rng = floorRng(seed, n);
  const cols = DUNGEON_BLOCKS_W;
  const rows = DUNGEON_BLOCKS_H;
  const blocks: DungeonBlock[] = new Array<DungeonBlock>(cols * rows).fill('wall');
  const carve = (c: number, r: number): void => {
    blocks[r * cols + c] = 'floor';
  };

  const rooms = placeRooms(rng, rngInt(rng, rules.roomsMin, rules.roomsMax), cols, rows);
  for (const room of rooms) {
    for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) carve(c, r);
  }
  // Corridors: each room to the nearest earlier room, an L with a random bend.
  for (let i = 1; i < rooms.length; i++) {
    const a = roomCenter(rooms[i]!);
    let best = roomCenter(rooms[0]!);
    for (let j = 1; j < i; j++) {
      const b = roomCenter(rooms[j]!);
      if (Math.abs(b.c - a.c) + Math.abs(b.r - a.r) < Math.abs(best.c - a.c) + Math.abs(best.r - a.r)) best = b;
    }
    const horizontalFirst = rng() < 0.5;
    const bend = horizontalFirst ? { c: best.c, r: a.r } : { c: a.c, r: best.r };
    for (const [p, q] of [[a, bend], [bend, best]] as const) {
      for (let c = Math.min(p.c, q.c); c <= Math.max(p.c, q.c); c++) carve(c, p.r);
      for (let r = Math.min(p.r, q.r); r <= Math.max(p.r, q.r); r++) carve(p.c, r);
    }
  }

  const spawnBlock = roomCenter(rooms[0]!);
  const partial = { seed, n, round, cols, rows, blocks, rooms, spawn: blockCenter(spawnBlock.c, spawnBlock.r), exit: spawnBlock };
  // The exit: the room block farthest from the spawn (walking), outside the spawn room.
  const dist = blockDistances(partial, spawnBlock.c, spawnBlock.r);
  let exit = spawnBlock;
  let exitRoom = 0;
  rooms.forEach((room, ri) => {
    if (ri === 0) return;
    for (let r = room.y; r < room.y + room.h; r++) {
      for (let c = room.x; c < room.x + room.w; c++) {
        if ((dist[r * cols + c] ?? -1) > (dist[exit.r * cols + exit.c] ?? -1)) {
          exit = { c, r };
          exitRoom = ri;
        }
      }
    }
  });
  const map: DungeonMap = { ...partial, exit: rules.kind === 'mine' ? { ...NO_EXIT } : exit };

  // Things stand in the middle of a free room block; one thing per block.
  const used = new Set<number>([spawnBlock.r * cols + spawnBlock.c, exit.r * cols + exit.c]);
  const freeBlock = (room: BlockRect): { c: number; r: number } | null => {
    const free: { c: number; r: number }[] = [];
    for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) if (isFloorBlock(map, c, r) && !used.has(r * cols + c)) free.push({ c, r });
    if (free.length === 0) return null;
    const b = rngPick(rng, free);
    used.add(b.r * cols + b.c);
    return b;
  };

  const enemies: Enemy[] = [];
  const chests: Chest[] = [];
  const bossFloor = rules.boss && n === BOSS_FLOOR;
  const addChest = (kind: ChestKind, b: { c: number; r: number }, mimic = false): void => {
    const p = blockCenter(b.c, b.r);
    chests.push({ id: chests.length + 1, kind, mimic, opened: false, x: p.x, y: p.y });
  };

  if (bossFloor) {
    // A golden chest right next to the exit, inside the exit room.
    const room = rooms[exitRoom]!;
    const next = [[1, 0], [-1, 0], [0, 1], [0, -1]]
      .map(([dc, dr]) => ({ c: exit.c + dc!, r: exit.r + dr! }))
      .find((b) => b.c >= room.x && b.c < room.x + room.w && b.r >= room.y && b.r < room.y + room.h);
    if (next) {
      used.add(next.r * cols + next.c);
      addChest('golden', next);
    }
    const b = freeBlock(room);
    if (b) {
      const p = blockCenter(b.c, b.r);
      enemies.push(makeEnemy(enemies.length + 1, 'bone_king', BOSS_HP_FLOOR_SCALING ? n : 1, p.x, p.y));
    }
  }
  rooms.forEach((room, ri) => {
    if (ri === 0) return;
    const count = rngInt(rng, ENEMIES_PER_ROOM_MIN, rules.enemiesPerRoomMax);
    for (let k = 0; k < count; k++) {
      const kind = rngPick(rng, rules.enemies);
      const b = freeBlock(room);
      if (!b) break;
      const p = blockCenter(b.c, b.r);
      enemies.push(makeEnemy(enemies.length + 1, kind, n, p.x, p.y));
    }
  });
  if (rules.kind === 'mine') {
    // Rocks in every room (the spawn room too), one per free block.
    const rocks: Rock[] = [];
    for (const room of rooms) {
      const count = rngInt(rng, MINE_ROCKS_PER_ROOM_MIN, MINE_ROCKS_PER_ROOM_MAX);
      for (let k = 0; k < count; k++) {
        const b = freeBlock(room);
        if (!b) break;
        const kind = rollRockKind(rng, rules.visit);
        const p = blockCenter(b.c, b.r);
        rocks.push({ id: rocks.length + 1, kind, hitsLeft: ROCK_HITS[kind], x: p.x, y: p.y });
      }
    }
    return { map, enemies, chests, rocks };
  }
  // Chests are spread (owner, after 9d): never close to the spawn room and never close together.
  const others = rooms.slice(1);
  const chestBlocks: { c: number; r: number }[] = chests.map((c) => blockAt(c));
  const chestSpot = (): { c: number; r: number } | null => {
    const first = rngPick(rng, others);
    for (const relax of [0, 1, 2]) {
      for (const pool of [[first], others]) {
        const free = pool.flatMap((room) => roomBlocks(room)).filter((b) => !used.has(b.r * cols + b.c) && chestSpotOk(b, rooms[0]!, chestBlocks, relax));
        if (free.length === 0) continue;
        const b = rngPick(rng, free);
        used.add(b.r * cols + b.c);
        chestBlocks.push(b);
        return b;
      }
    }
    return null;
  };
  const wooden = rngInt(rng, WOODEN_CHESTS_MIN, WOODEN_CHESTS_MAX);
  for (let k = 0; k < wooden; k++) {
    const b = chestSpot();
    if (b) addChest('wooden', b, rules.mimics && rng() < 1 / MIMIC_ONE_IN);
  }
  if (!bossFloor && rng() < GOLDEN_CHEST_CHANCE) {
    const b = chestSpot();
    if (b) addChest('golden', b);
  }
  return { map, enemies, chests, rocks: [] };
}

