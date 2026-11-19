// Where the avatar stands after an Inn door trip (owner 19 Nov: 'I glitched in the door'). Pure.
// DOOR_ARRIVE_CELLS in front of the arrival spot; when that cell is taken, the nearest free cell that is reachable from the spot and is NOT a door spot
// (so the avatar never stands under an arch, never inside furniture or a wall). Falls back to the spot itself only when nothing else is reachable.

import { DOOR_ARRIVE_CELLS } from './config.ts';
import { doorAt } from './innDoors.ts';
import { cellAt, cellCenter, isCellFree, reachableCells, type NavGrid } from './nav.ts';
import type { Room } from './room.ts';
import type { Point } from './types.ts';

export function doorArrivalPoint(grid: NavGrid, room: Pick<Room, 'kind' | 'shape' | 'level'>, spot: Point): Point {
  const s = cellAt(grid, spot);
  if (!isCellFree(grid, s.c, s.r)) return spot;
  const reach = reachableCells(grid, s.r * grid.cols + s.c);
  const want = { c: s.c, r: s.r + DOOR_ARRIVE_CELLS };
  let best: Point | null = null;
  let bestD = Infinity;
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!reach[r * grid.cols + c] || r <= s.r || doorAt(room, { c, r }) !== null) continue;
      // Prefer straight below (rows), then sideways.
      const d = Math.abs(r - want.r) * 2 + Math.abs(c - want.c) * 3;
      if (d < bestD) {
        bestD = d;
        best = cellCenter(grid, c, r);
      }
    }
  }
  return best ?? spot;
}
