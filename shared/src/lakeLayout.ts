// The lakeside's fixed places (brief section 10d, step 9f; POND A3 19 Nov): the pond, the pier, the trees. Plain geometry from
// config, like farmLayout.ts. The pond is a VERTEX grid of terrain levels (config LAKE_LEVELS: 0 grass, 1 sand, 2 shallow,
// 3 deep); a cell whose four corners are all water (2+) is a WATER cell and blocks walking (the pier cells do not); the shore
// cells (some corners water, some land) stay walkable. The cast spots are the free cells next to the water and the pier. Pure.

import { CAST_AIM_WEIGHT, CAST_MIN_PX, CAST_REACH_PX, LAKE_CELL, LAKE_LEVELS, LAKE_PIER, LAKE_TREES, TREE_FOOTPRINT } from './config.ts';
import { cellCenter, cellAt, isCellFree, pathCosts, type NavGrid } from './nav.ts';
import type { Room } from './room.ts';
import type { Point, Rect } from './types.ts';

/** The pond's size in cells (the vertex grid is one bigger each way). */
export const LAKE_COLS = (LAKE_LEVELS[0]?.length ?? 1) - 1;
export const LAKE_ROWS = LAKE_LEVELS.length - 1;

/** Terrain level of vertex (c, r): 0 grass, 1 sand, 2 shallow, 3 deep; 0 outside the grid. */
export function lakeLevel(c: number, r: number): number {
  const row = LAKE_LEVELS[r];
  if (!row || c < 0 || c >= row.length) return 0;
  return Number(row[c]) || 0;
}

/** The four corner levels of cell (c, r) in the order NW, NE, SE, SW (the tile pick order of the art). */
export function cellCorners(c: number, r: number): [number, number, number, number] {
  return [lakeLevel(c, r), lakeLevel(c + 1, r), lakeLevel(c + 1, r + 1), lakeLevel(c, r + 1)];
}

/** True if cell (c, r) is a pier cell. */
export function isPierCell(c: number, r: number): boolean {
  const p = LAKE_PIER;
  const x = c * LAKE_CELL;
  const y = r * LAKE_CELL;
  return x >= p.x && x < p.x + p.w && y >= p.y && y < p.y + p.h;
}

/** True if cell (c, r) is open water: all four corners are water (shallow or deep). Pier cells may be water cells too (the deck is above). */
export function isWaterCell(c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= LAKE_COLS || r >= LAKE_ROWS) return false;
  return Math.min(...cellCorners(c, r)) >= 2;
}

/** Runs of cells in a row that pass `ok`, as rectangles (floor px). */
function rowRuns(ok: (c: number, r: number) => boolean): Rect[] {
  const out: Rect[] = [];
  for (let r = 0; r < LAKE_ROWS; r++) {
    for (let c = 0; c < LAKE_COLS; c++) {
      if (!ok(c, r)) continue;
      let e = c;
      while (e + 1 < LAKE_COLS && ok(e + 1, r)) e++;
      out.push({ x: c * LAKE_CELL, y: r * LAKE_CELL, w: (e - c + 1) * LAKE_CELL, h: LAKE_CELL });
      c = e;
    }
  }
  return out;
}

/** The water cells as rectangles: one per run of water cells in a row (floor px). The water under the pier is included. */
export function waterRects(): Rect[] {
  return rowRuns(isWaterCell);
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

function onPier(p: Point): boolean {
  const pier = LAKE_PIER;
  return p.x >= pier.x && p.x <= pier.x + pier.w && p.y >= pier.y && p.y <= pier.y + pier.h;
}

/**
 * The terrain level at a world point, blended between the four corners of its cell (bilinear): about what the tile art shows
 * there (the shoreline of a shore tile runs where this is about 1.5).
 */
export function terrainAt(p: Point): number {
  const fx = p.x / LAKE_CELL;
  const fy = p.y / LAKE_CELL;
  const c = Math.floor(fx);
  const r = Math.floor(fy);
  const u = fx - c;
  const v = fy - r;
  const [nw, ne, se, sw] = cellCorners(c, r);
  return nw * (1 - u) * (1 - v) + ne * u * (1 - v) + se * u * v + sw * (1 - u) * v;
}

/** True if a point is in the water: a water cell, or the watery part of a shore cell (the pier is above it, so a point on the pier is not). */
export function isWater(p: Point): boolean {
  if (onPier(p)) return false;
  const c = Math.floor(p.x / LAKE_CELL);
  const r = Math.floor(p.y / LAKE_CELL);
  if (c < 0 || r < 0 || c >= LAKE_COLS || r >= LAKE_ROWS) return false;
  if (isWaterCell(c, r)) return true;
  return Math.max(...cellCorners(c, r)) >= 2 && terrainAt(p) >= 1.5;
}

/** What blocks walking on the lakeside: the water cells (not the pier's) and the tree trunks. */
export function lakeBlockers(): Rect[] {
  return [...rowRuns((c, r) => isWaterCell(c, r) && !isPierCell(c, r)), ...Array.from({ length: TREE_COUNT }, (_, i) => treeRect(i))];
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

/** The distance from a point to the nearest water cell. */
export function distToWater(p: Point): number {
  return Math.min(...waterRects().map((r) => distToRect(p, r)));
}

/** The open water (a water cell, not under the pier) at cell (c, r). */
function openWater(c: number, r: number): boolean {
  return isWaterCell(c, r) && !isPierCell(c, r);
}

/** The nearest point in open water (inset 6 px from the cell edges that do not border open water, never on the pier) to a world point. */
export function nearestWaterPoint(p: Point): Point {
  let best: Point = { x: p.x, y: p.y };
  let bestD = Infinity;
  for (let r = 0; r < LAKE_ROWS; r++) {
    for (let c = 0; c < LAKE_COLS; c++) {
      if (!openWater(c, r)) continue;
      const x0 = c * LAKE_CELL + (openWater(c - 1, r) ? 0 : 6);
      const x1 = (c + 1) * LAKE_CELL - (openWater(c + 1, r) ? 0 : 6);
      const y0 = r * LAKE_CELL + (openWater(c, r - 1) ? 0 : 6);
      const y1 = (r + 1) * LAKE_CELL - (openWater(c, r + 1) ? 0 : 6);
      const q = { x: Math.min(Math.max(p.x, x0), x1), y: Math.min(Math.max(p.y, y0), y1) };
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bestD && isWater(q)) {
        bestD = d;
        best = q;
      }
    }
  }
  return best;
}

/**
 * The cast spots: the free cells with a water cell next to them (8 directions: their centres within CAST_REACH_PX of the
 * water) and the free pier cells. These are the spots the avatar casts from.
 */
export function castSpots(grid: NavGrid): Point[] {
  const out: Point[] = [];
  for (let r = 0; r < grid.rows; r++) {
    for (let c = 0; c < grid.cols; c++) {
      if (!isCellFree(grid, c, r)) continue;
      const p = cellCenter(grid, c, r);
      if (isPierCell(c, r) || distToWater(p) <= CAST_REACH_PX) out.push(p);
    }
  }
  return out;
}

/**
 * A3 (owner bug: tapping the water walked all around it): the cast spot for a tap on the water at `target`, walking from
 * `from`: the reachable spot with the least path length (px) + CAST_AIM_WEIGHT x its straight distance to the tap. So the
 * avatar walks to the NEAREST shore or pier spot BY PATH (turned a little toward the tap) and casts from there; standing on
 * a cast spot it casts at once. Null when `from` is not a free cell or no spot can be reached.
 */
export function nearestCastSpot(grid: NavGrid, from: Point, target: Point): Point | null {
  const sc = cellAt(grid, from);
  if (!isCellFree(grid, sc.c, sc.r)) return null;
  const costs = pathCosts(grid, sc.r * grid.cols + sc.c);
  let best: Point | null = null;
  let bestScore = Infinity;
  for (const p of castSpots(grid)) {
    const c = cellAt(grid, p);
    const walk = costs[c.r * grid.cols + c.c]!;
    if (!Number.isFinite(walk)) continue;
    const score = walk * grid.cell + CAST_AIM_WEIGHT * Math.hypot(p.x - target.x, p.y - target.y);
    if (score < bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return best;
}

/**
 * Where the bobber lands for a cast from `spot` at a tapped water point: the nearest water point to the tap, but at least
 * CAST_MIN_PX out from the avatar (along the line to the tap, or straight into the pond when the tap is right at the feet)
 * so the bobber never sits on the avatar.
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
  // CAST_MIN_PX out along the line, or a little farther when that point is on land (a curved shore).
  for (let k = 1; k <= 3; k += 0.25) {
    const q = { x: spot.x + dir.x * CAST_MIN_PX * k, y: spot.y + dir.y * CAST_MIN_PX * k };
    if (isWater(q)) return q;
  }
  return w;
}
