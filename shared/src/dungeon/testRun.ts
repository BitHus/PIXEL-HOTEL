// Test helpers (not exported): a run on a hand-made map with chosen enemies and chests.

import { DUNGEON_BLOCK } from '../config.ts';
import { blockCenter } from './grid.ts';
import { makeEnemy } from './generate.ts';
import { newRun, type Chest, type DungeonBlock, type DungeonMap, type DungeonRun, type Enemy } from './run.ts';
import type { EnemyKind } from '../config.ts';
import type { GearId } from '../types.ts';

/** One open room of floor blocks (cols x rows inside a 1 block wall ring); exit in the far corner. */
export function openMap(cols = 12, rows = 12): DungeonMap {
  const blocks: DungeonBlock[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) blocks.push(c > 0 && r > 0 && c < cols - 1 && r < rows - 1 ? 'floor' : 'wall');
  return {
    seed: 1,
    n: 1,
    round: 2,
    cols,
    rows,
    blocks,
    rooms: [{ x: 1, y: 1, w: cols - 2, h: rows - 2 }],
    spawn: blockCenter(2, 2),
    exit: { c: cols - 2, r: rows - 2 },
  };
}

export interface TestRunOptions {
  enemies?: Enemy[];
  chests?: Chest[];
  gear?: GearId[];
  xp?: number;
  potions?: number;
  at?: { x: number; y: number };
  floor?: number;
  maxFloors?: number;
  map?: DungeonMap;
}

export function testRun(o: TestRunOptions = {}): DungeonRun {
  const run = newRun({ seed: 7, round: 2, xp: o.xp ?? 0, gear: o.gear ?? [], potions: o.potions ?? 0 });
  const map = o.map ?? openMap();
  const at = o.at ?? map.spawn;
  return {
    ...run,
    map,
    floor: o.floor ?? 1,
    maxFloors: o.maxFloors ?? 3,
    enemies: o.enemies ?? [],
    chests: o.chests ?? [],
    player: { ...run.player, x: at.x, y: at.y },
  };
}

/** An enemy with a big hp pool (so it does not die by accident) at a world point. */
export function enemyAt(id: number, x: number, y: number, kind: EnemyKind = 'slime', hp?: number): Enemy {
  const e = makeEnemy(id, kind, 1, x, y);
  return hp === undefined ? e : { ...e, hp, maxHp: hp };
}

export const B = DUNGEON_BLOCK;
