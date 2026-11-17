// ST3 WALKABLE HEIGHTS (pure). A cell's height level = the size of its block stack (Room.blocks, 0 to BLOCK_STACK_MAX), so there is
// no new save field. The PLAYER walks on a grid whose block cells are free but carry a level (nav.ts steps at most NAV_STEP_MAX
// per move: 1, 2, 3 stacks are stairs, a taller step is a wall). GUESTS keep their own grid (blocks stay blockers there) and never
// leave level 0. Furniture, plants and fixed things stay blockers on both. Placement refusals (door, counter, seats) still treat
// blocks as walls, which is the safe side.

import { BLOCK_STACK_RISE_PX, BUILD_CELL, LEVEL_LIFT_TAU_MS } from './config.ts';
import { fixedBlockers } from './farmLayout.ts';
import { getFurnitureType, itemBlockers, type FurnitureLookup } from './furniture.ts';
import { buildNavGrid, type NavGrid } from './nav.ts';
import { blockStack, cellRectOf, plantList, type Room } from './room.ts';
import type { FurnitureItem, Point, Rect } from './types.ts';

/** The height level of a cell: the size of its block stack (0 = bare floor). */
export function cellLevel(room: Room, c: number, r: number): number {
  return blockStack(room, c, r).length;
}

/** The level under a world point (0 outside any block). */
export function levelAtPoint(room: Room, p: Point): number {
  return cellLevel(room, Math.floor(p.x / BUILD_CELL), Math.floor(p.y / BUILD_CELL));
}

/** What blocks the PLAYER: blocking furniture, fixed things and plants (a plant on a block still blocks). Blocks do not. */
export function walkBlockers(room: Room, items: readonly FurnitureItem[], types: FurnitureLookup = getFurnitureType): Rect[] {
  return [...itemBlockers(items, room.id, types), ...fixedBlockers(room), ...plantList(room).map((p) => cellRectOf(p.c, p.r))];
}

/** The player's nav grid: blocks are walkable cells with a level. `extra` = more blockers (debug rects). */
export function buildWalkGrid(room: Room, items: readonly FurnitureItem[], extra: readonly Rect[] = [], types: FurnitureLookup = getFurnitureType): NavGrid {
  const grid = buildNavGrid(room, [...extra, ...walkBlockers(room, items, types)]);
  const level: number[] = [];
  for (let r = 0; r < grid.rows; r++) for (let c = 0; c < grid.cols; c++) level.push(cellLevel(room, c, r));
  return { ...grid, level };
}

/** How many px an avatar standing on a level is drawn higher (rendering only). */
export function liftPxOfLevel(level: number): number {
  return level * BLOCK_STACK_RISE_PX;
}

/** Eases the drawn lift toward the target (exponential, frame-rate independent; snaps when close). */
export function easeLift(current: number, target: number, dtMs: number): number {
  const k = 1 - Math.exp(-Math.max(0, dtMs) / LEVEL_LIFT_TAU_MS);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.25 ? target : next;
}
