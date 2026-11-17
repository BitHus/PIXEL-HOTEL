// The first-steps guide's "walk here" spot: a free cell in the open, reachable from the avatar, about GUIDE_SPOT_CELLS cells away and toward the
// middle of the room (never a wall corner, never behind furniture). Pure on a nav grid.

import { cellAt, cellCenter, isCellFree, reachableCells, type NavGrid } from './nav.ts';
import type { Point } from './types.ts';

export const GUIDE_SPOT_CELLS = 3;

/** Free neighbours of a cell (0..8), to prefer open floor. */
function openness(grid: NavGrid, c: number, r: number): number {
  let n = 0;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if ((dc !== 0 || dr !== 0) && isCellFree(grid, c + dc, r + dr)) n++;
  return n;
}

/** The world point of the spot (null = nowhere sensible: the pointer hides). `middle` = the point it leans toward (the room's middle). */
export function guideFloorSpot(grid: NavGrid, avatar: Point, middle: Point): Point | null {
  const a = cellAt(grid, avatar);
  if (!isCellFree(grid, a.c, a.r)) return null;
  const reach = reachableCells(grid, a.r * grid.cols + a.c);
  let best: { c: number; r: number; score: number } | null = null;
  for (let r = a.r - GUIDE_SPOT_CELLS - 1; r <= a.r + GUIDE_SPOT_CELLS + 1; r++) {
    for (let c = a.c - GUIDE_SPOT_CELLS - 1; c <= a.c + GUIDE_SPOT_CELLS + 1; c++) {
      if (!isCellFree(grid, c, r) || !reach[r * grid.cols + c]) continue;
      const d = Math.max(Math.abs(c - a.c), Math.abs(r - a.r));
      if (d < 2) continue;
      const p = cellCenter(grid, c, r);
      const score = Math.abs(d - GUIDE_SPOT_CELLS) * 2 + (8 - openness(grid, c, r)) + Math.hypot(p.x - middle.x, p.y - middle.y) / grid.cell / 4;
      if (best === null || score < best.score) best = { c, r, score };
    }
  }
  return best === null ? null : cellCenter(grid, best.c, best.r);
}
