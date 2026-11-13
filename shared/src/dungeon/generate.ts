// Dungeon floors (brief section 10): DUNGEON_BLOCKS_W x DUNGEON_BLOCKS_H blocks, rooms of 4 to 8
// blocks joined by 1 block wide corridors, from an integer seed (same seed and floor = same
// floor). Pure: the floor's own rng is made from the seed and the floor number.
//
// - Rooms never overlap and keep at least one wall block between them. Room 0 is the spawn room:
//   no enemies and no chests there, so nothing starts on the player.
// - Every room is joined to the nearest room placed before it (L-shaped corridors), so all rooms
//   are connected. The exit is the floor block in the room farthest (walking) from the spawn.
// - Each room but the spawn room gets 0 to 2 enemies of the round's kinds, hp * (1 + 0.25 (n - 1))
//   rounded up. 3 to 5 wooden chests (1 in 8 a mimic when the round has mimics) and a 40% chance of
//   one golden chest. The boss floor (round 2, floor 3) has the Bone King in the exit room and
//   always a golden chest next to the exit.

import {
  BOSS_FLOOR,
  BOSS_HP_FLOOR_SCALING,
  DUNGEON_BLOCKS_H,
  DUNGEON_BLOCKS_W,
  DUNGEON_ROOM_BLOCKS_MAX,
  DUNGEON_ROOM_BLOCKS_MIN,
  DUNGEON_ROUND,
  DUNGEON_ROUNDS,
  ENEMIES,
  ENEMIES_PER_ROOM_MAX,
  ENEMIES_PER_ROOM_MIN,
  ENEMY_HP_PER_FLOOR,
  GOLDEN_CHEST_CHANCE,
  MIMIC_ONE_IN,
  WOODEN_CHESTS_MAX,
  WOODEN_CHESTS_MIN,
  type EnemyKind,
} from '../config.ts';
import { rngInt, rngPick, seededRng } from '../rng.ts';
import type { Rng } from '../types.ts';
import { blockCenter, isFloorBlock } from './grid.ts';
import type { BlockRect, Chest, ChestKind, DungeonBlock, DungeonMap, DungeonRoundId, Enemy } from './run.ts';

export interface FloorPlan {
  map: DungeonMap;
  enemies: Enemy[];
  chests: Chest[];
}

/** The rng of one floor: mixes the run seed and the floor number. */
export function floorRng(seed: number, n: number): Rng {
  let h = Math.imul(seed >>> 0, 0x9e3779b1) ^ Math.imul(n, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d);
  return seededRng((h ^ (h >>> 15)) >>> 0);
}

/** Enemy hp on floor n: base hp * (1 + 0.25 (n - 1)), rounded up. */
export function enemyHp(kind: EnemyKind, n: number): number {
  return Math.ceil(ENEMIES[kind].hp * (1 + ENEMY_HP_PER_FLOOR * (n - 1)));
}

export function makeEnemy(id: number, kind: EnemyKind, n: number, x: number, y: number, mimic = false): Enemy {
  const hp = enemyHp(kind, n);
  return { id, kind, mimic, hp, maxHp: hp, x, y, windupMs: 0, cooldownMs: 0, path: [], repathMs: 0 };
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

/** Block steps from a start block over floor blocks (4 directions). -1 = not reachable. */
export function blockDistances(map: DungeonMap, c: number, r: number): number[] {
  const dist = new Array<number>(map.cols * map.rows).fill(-1);
  dist[r * map.cols + c] = 0;
  const queue = [r * map.cols + c];
  for (let k = 0; k < queue.length; k++) {
    const i = queue[k]!;
    const ic = i % map.cols;
    const ir = (i - ic) / map.cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const j = (ir + dr) * map.cols + ic + dc;
      if (isFloorBlock(map, ic + dc, ir + dr) && dist[j] === -1) {
        dist[j] = dist[i]! + 1;
        queue.push(j);
      }
    }
  }
  return dist;
}

export function generateFloor(seed: number, n: number, round: DungeonRoundId = DUNGEON_ROUND): FloorPlan {
  const rules = DUNGEON_ROUNDS[round];
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
  const map: DungeonMap = { ...partial, exit };

  // Things stand in the middle of a free room block; one thing per block.
  const used = new Set<number>([spawnBlock.r * cols + spawnBlock.c, exit.r * cols + exit.c]);
  const freeBlock = (room: BlockRect): { c: number; r: number } | null => {
    const free: { c: number; r: number }[] = [];
    for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) if (!used.has(r * cols + c)) free.push({ c, r });
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
    const count = rngInt(rng, ENEMIES_PER_ROOM_MIN, ENEMIES_PER_ROOM_MAX);
    for (let k = 0; k < count; k++) {
      const kind = rngPick(rng, rules.enemies);
      const b = freeBlock(room);
      if (!b) break;
      const p = blockCenter(b.c, b.r);
      enemies.push(makeEnemy(enemies.length + 1, kind, n, p.x, p.y));
    }
  });
  const others = rooms.slice(1);
  const wooden = rngInt(rng, WOODEN_CHESTS_MIN, WOODEN_CHESTS_MAX);
  for (let k = 0; k < wooden; k++) {
    const b = freeBlock(rngPick(rng, others));
    if (b) addChest('wooden', b, rules.mimics && rng() < 1 / MIMIC_ONE_IN);
  }
  if (!bossFloor && rng() < GOLDEN_CHEST_CHANCE) {
    const b = freeBlock(rngPick(rng, others));
    if (b) addChest('golden', b);
  }
  return { map, enemies, chests };
}
