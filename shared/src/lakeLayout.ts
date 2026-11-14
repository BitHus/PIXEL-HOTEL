// The lakeside's fixed places (brief section 10d, step 9f): the lake, the pier, the trees. Plain
// geometry from config, like farmLayout.ts: the water and the tree trunks block walking (the pier
// does not), and the cast spots are the free cells next to the water. Pure.

import { CAST_MIN_PX, CAST_REACH_PX, LAKE_PIER, LAKE_TREES, LAKE_WATER, TREE_FOOTPRINT } from './config.ts';
import { cellCenter, reachableCells, cellAt, isCellFree, type NavGrid } from './nav.ts';
import type { Room } from './room.ts';
import type { Point, Rect } from './types.ts';

/** The water rectangles (the pier is not part of them). */
export function waterRects(): Rect[] {
  return LAKE_WATER.map((r) => ({ ...r }));
}

export function pierRect(): Rect {
  return { ...LAKE_PIER };
}

/** The number of trees. */
export const TREE_COUNT = LAKE_TREES.length;

/** Tree `index`: its anchor (the bottom middle of the trunk). */
export function treeAnchor(index: number): Point {
  const t = LAKE_TREES[index];
  if (!t) throw new Error(`no tree ${index}`);
  return { x: t.x, y: t.y };
}

/** The trunk's footprint on the floor. */
export function treeRect(index: number): Rect {
  const a = treeAnchor(index);
  return { x: a.x - TREE_FOOTPRINT.w / 2, y: a.y - TREE_FOOTPRINT.d, w: TREE_FOOTPRINT.w, h: TREE_FOOTPRINT.d };
}

/** Where the avatar stands to swing at a tree: just in front (below) of the trunk. */
export function treeStand(index: number): Point {
  const a = treeAnchor(index);
  return { x: a.x, y: a.y + 14 };
}

/** The tree whose trunk or crown is under a world point (the crown stands above the trunk), or null. */
export function treeAt(p: Point): number | null {
  for (let i = 0; i < TREE_COUNT; i++) {
    const a = treeAnchor(i);
    if (Math.abs(p.x - a.x) <= 22 && p.y >= a.y - 72 && p.y <= a.y + 6) return i;
  }
  return null;
}

/** True if a point is in the water (the pier is above it, so a point on the pier is not). */
export function isWater(p: Point): boolean {
  const pier = LAKE_PIER;
  if (p.x >= pier.x && p.x <= pier.x + pier.w && p.y >= pier.y && p.y <= pier.y + pier.h) return false;
  return LAKE_WATER.some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
}

/** What blocks walking on the lakeside: the water and the tree trunks. */
export function lakeBlockers(): Rect[] {
  return [...waterRects(), ...Array.from({ length: TREE_COUNT }, (_, i) => treeRect(i))];
}

/** Fixed things on the lakeside that block walking (see farmLayout fixedBlockers). */
export function lakeFixedBlockers(room: Room): Rect[] {
  return room.kind === 'lakeside' ? lakeBlockers() : [];
}

/** The distance from a point to a rectangle (0 inside). */
function distToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/** The distance from a point to the nearest water. */
export function distToWater(p: Point): number {
  return Math.min(...LAKE_WATER.map((r) => distToRect(p, r)));
}

/** The nearest point in the water (inset a little from the shore) to a world point. */
export function nearestWaterPoint(p: Point): Point {
  let best: Point = { x: p.x, y: p.y };
  let bestD = Infinity;
  for (const r of LAKE_WATER) {
    const q = { x: Math.min(Math.max(p.x, r.x + 6), r.x + r.w - 6), y: Math.min(Math.max(p.y, r.y + 6), r.y + r.h - 6) };
    const d = Math.hypot(q.x - p.x, q.y - p.y);
    if (d < bestD && isWater(q)) {
      bestD = d;
      best = q;
    }
  }
  return best;
}

/**
 * The free cells next to the water (their centres within CAST_REACH_PX of it): the shore and the
 * pier. These are the spots the avatar casts from.
 */
export function castSpots(grid: NavGrid): Point[] {
  const out: Point[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!isCellFree(grid, c, r)) continue;
      const p = cellCenter(grid, c, r);
      if (distToWater(p) <= CAST_REACH_PX) out.push(p);
    }
  }
  return out;
}

/**
 * The cast spot nearest to a tapped water point that the avatar can walk to from `from` (null if
 * there is none). Taps on the pier's water or the far shore pick the nearest shore or pier spot.
 */
export function nearestCastSpot(grid: NavGrid, from: Point, target: Point): Point | null {
  const sc = cellAt(grid, from);
  if (!isCellFree(grid, sc.c, sc.r)) return null;
  const reach = reachableCells(grid, sc.r * grid.cols + sc.c);
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of castSpots(grid)) {
    const c = cellAt(grid, p);
    if (!reach[c.r * grid.cols + c.c]) continue;
    const d = Math.hypot(p.x - target.x, p.y - target.y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

/**
 * Where the bobber lands for a cast from `spot` at a tapped water point: the nearest water point to
 * the tap, but at least CAST_MIN_PX out from the avatar (along the line to the tap, or straight
 * into the lake when the tap is right at the feet) so the bobber never sits on the avatar.
 */
export function bobberPoint(spot: Point, target: Point): Point {
  const w = nearestWaterPoint(target);
  const d = Math.hypot(w.x - spot.x, w.y - spot.y);
  if (d >= CAST_MIN_PX) return w;
  let dir = d > 0.5 ? { x: (w.x - spot.x) / d, y: (w.y - spot.y) / d } : null;
  if (!dir) {
    // Right at the feet: out toward the nearest water.
    const n = nearestWaterPoint(spot);
    const dn = Math.hypot(n.x - spot.x, n.y - spot.y) || 1;
    dir = { x: (n.x - spot.x) / dn, y: (n.y - spot.y) / dn };
  }
  const p = { x: spot.x + dir.x * CAST_MIN_PX, y: spot.y + dir.y * CAST_MIN_PX };
  return isWater(p) ? p : w;
}
