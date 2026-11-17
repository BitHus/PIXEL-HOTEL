// The dungeon's blocks and its navigation grid (brief sections 6 and 10). The dungeon uses its
// own DUNGEON_BLOCK px block grid, never the room shapes. Navigation is the same NavGrid as in the
// hotel (DUNGEON_NAV_CELL px cells, A*, smoothing; shared/nav.ts): a cell is blocked when it lies on a wall
// block or on a solid prop (DG-P). No avatar radius is added, because corridors are only one block (32 px) wide.

import { DUNGEON_BLOCK, DUNGEON_NAV_CELL } from '../config.ts';
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
  const per = DUNGEON_BLOCK / DUNGEON_NAV_CELL;
  const cols = map.cols * per;
  const rows = map.rows * per;
  const solid = new Set<number>();
  for (const d of map.decor ?? []) if (d.solid) solid.add(d.r * map.cols + d.c);
  const blocked: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bc = Math.floor(c / per);
      const br = Math.floor(r / per);
      blocked.push(!isFloorBlock(map, bc, br) || solid.has(br * map.cols + bc));
    }
  }
  const grid = { cols, rows, cell: DUNGEON_NAV_CELL, blocked };
  GRIDS.set(map.blocks, grid);
  return grid;
}

/** True when a solid prop (barrel, crate, statue ...) stands on the block: it blocks walking like a wall. */
export function solidPropAt(map: Pick<DungeonMap, 'decor'>, c: number, r: number): boolean {
  return (map.decor ?? []).some((d) => d.solid && d.c === c && d.r === r);
}

/** Flood fill over floor blocks that hold no solid prop (keys r * cols + c): true when every one of them is reachable from `start`. */
export function floorStaysConnected(map: Pick<DungeonMap, 'cols' | 'rows' | 'blocks'>, solids: ReadonlySet<number>, start: { c: number; r: number }): boolean {
  const { cols, rows, blocks } = map;
  let total = 0;
  for (let i = 0; i < blocks.length; i++) if (blocks[i] === 'floor' && !solids.has(i)) total++;
  const seen = new Uint8Array(cols * rows);
  const si = start.r * cols + start.c;
  if (blocks[si] !== 'floor' || solids.has(si)) return false;
  const stack = [si];
  seen[si] = 1;
  let n = 0;
  while (stack.length > 0) {
    const i = stack.pop()!;
    n++;
    const c = i % cols;
    const r = (i - c) / cols;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= cols || nr >= rows) continue;
      const j = nr * cols + nc;
      if (seen[j] || blocks[j] !== 'floor' || solids.has(j)) continue;
      seen[j] = 1;
      stack.push(j);
    }
  }
  return n === total;
}
