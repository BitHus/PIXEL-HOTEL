// The dungeon's blocks and its navigation grid (brief sections 6 and 10). The dungeon uses its
// own DUNGEON_BLOCK px block grid, never the room shapes. Navigation is the same NavGrid as in the
// hotel (NAV_CELL px cells, A*, smoothing; shared/nav.ts): a cell is blocked when it lies on a wall
// block. No avatar radius is added, because corridors are only one block (32 px) wide.

import { DUNGEON_BLOCK, NAV_CELL } from '../config.ts';
import type { NavGrid } from '../nav.ts';
import type { Point } from '../types.ts';
import type { DungeonMap } from './run.ts';

export function isFloorBlock(map: DungeonMap, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < map.cols && r < map.rows && map.blocks[r * map.cols + c] === 'floor';
}

/** The middle of a block, world px. */
export function blockCenter(c: number, r: number): Point {
  return { x: (c + 0.5) * DUNGEON_BLOCK, y: (r + 0.5) * DUNGEON_BLOCK };
}

/** The block that holds a world point. */
export function blockAt(p: Point): { c: number; r: number } {
  return { c: Math.floor(p.x / DUNGEON_BLOCK), r: Math.floor(p.y / DUNGEON_BLOCK) };
}

/** True if a world point stands on a floor block. */
export function onFloor(map: DungeonMap, p: Point): boolean {
  const b = blockAt(p);
  return isFloorBlock(map, b.c, b.r);
}

const GRIDS = new WeakMap<DungeonMap['blocks'], NavGrid>();

/** The nav grid of a map (cached per map). */
export function dungeonNavGrid(map: DungeonMap): NavGrid {
  const cached = GRIDS.get(map.blocks);
  if (cached) return cached;
  const per = DUNGEON_BLOCK / NAV_CELL;
  const cols = map.cols * per;
  const rows = map.rows * per;
  const blocked: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) blocked.push(!isFloorBlock(map, Math.floor(c / per), Math.floor(r / per)));
  }
  const grid = { cols, rows, cell: NAV_CELL, blocked };
  GRIDS.set(map.blocks, grid);
  return grid;
}
