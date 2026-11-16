// Helpers every dungeon layout shares (brief section 10): the floor's rng, enemies, walking
// distances, the chest spacing rule. Moved out of generate.ts in DG1; generate.ts re-exports them.

import { CHEST_SPACING, CHEST_SPAWN_ROOM_GAP, ENEMIES, ENEMY_HP_PER_FLOOR, MITHRIL_FROM_VISIT, ROCK_WEIGHTS, type EnemyKind, type RockKind } from '../config.ts';
import { seededRng } from '../rng.ts';
import type { Rng } from '../types.ts';
import { isFloorBlock } from './grid.ts';
import type { BlockRect, Chest, DungeonMap, Enemy, Rock } from './run.ts';

export interface FloorPlan {
  map: DungeonMap;
  enemies: Enemy[];
  chests: Chest[];
  /** The mine's rocks (none in the crypt). */
  rocks: Rock[];
}

/** What a layout has: the crypt's round rules, or the mine's. */
export interface LayoutRules {
  roomsMin: number;
  roomsMax: number;
  enemies: readonly EnemyKind[];
  enemiesPerRoomMax: number;
  /** Crypt: chests (wooden, golden, mimics) and an exit. Mine: rocks, no exit. */
  kind: 'crypt' | 'mine';
  mimics: boolean;
  boss: boolean;
  /** Mine visit number (mithril rocks from MITHRIL_FROM_VISIT on). */
  visit: number;
}

/** No exit block: the mine is left with the Leave button (or when the lantern runs out). */
export const NO_EXIT = { c: -1, r: -1 } as const;

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

/** The kind of a new rock: by ROCK_WEIGHTS, mithril only from MITHRIL_FROM_VISIT on. */
export function rollRockKind(rng: Rng, visit: number): RockKind {
  const kinds = (Object.keys(ROCK_WEIGHTS) as RockKind[]).filter((k) => k !== 'mithril' || visit >= MITHRIL_FROM_VISIT);
  const total = kinds.reduce((a, k) => a + ROCK_WEIGHTS[k], 0);
  let roll = rng() * total;
  for (const k of kinds) {
    roll -= ROCK_WEIGHTS[k];
    if (roll < 0) return k;
  }
  return kinds[kinds.length - 1]!;
}

export function roomBlocks(room: BlockRect): { c: number; r: number }[] {
  const out: { c: number; r: number }[] = [];
  for (let r = room.y; r < room.y + room.h; r++) for (let c = room.x; c < room.x + room.w; c++) out.push({ c, r });
  return out;
}

/** Blocks between a block and a rectangle of blocks (0 = inside, 1 = right next to it; diagonals count as 1). */
export function blocksFromRect(b: { c: number; r: number }, rect: BlockRect): number {
  const dc = Math.max(rect.x - b.c, 0, b.c - (rect.x + rect.w - 1));
  const dr = Math.max(rect.y - b.r, 0, b.r - (rect.y + rect.h - 1));
  return Math.max(dc, dr);
}

/**
 * True if a chest may stand on this block: at least CHEST_SPAWN_ROOM_GAP blocks from the spawn room
 * and at least CHEST_SPACING blocks from every other chest (both counted with diagonals as 1).
 * `relax` lowers both by that many blocks (a floor too small for the rule still gets its chests),
 * but a chest is never in or right next to the spawn room, and never touches another chest.
 */
export function chestSpotOk(b: { c: number; r: number }, spawnRoom: BlockRect, chests: readonly { c: number; r: number }[], relax = 0): boolean {
  if (blocksFromRect(b, spawnRoom) < Math.max(2, CHEST_SPAWN_ROOM_GAP - relax)) return false;
  const gap = Math.max(2, CHEST_SPACING - relax);
  return chests.every((o) => Math.max(Math.abs(o.c - b.c), Math.abs(o.r - b.r)) >= gap);
}

