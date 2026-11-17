// Navigation in the hotel and the shop (brief section 6). Pure functions on plain data.
//
// - The grid has NAV_CELL px cells over the floor: in rooms it IS the build grid (BUILD_CELL, step
//   BG1). A cell is blocked if any part of it is outside the floor, or if it overlaps a blocking
//   footprint (whole cells, so a blocked cell is simply a cell with furniture on it; there is no
//   avatar radius). The dungeon builds its own grid (dungeon/grid.ts).
// - A* with 8 directions and no corner cutting (a diagonal step needs both side cells free).
// - Smoothing: a waypoint is removed when the straight line between its neighbours does not
//   touch a blocked cell. The result is a list of world points.

import { NAV_CELL, NAV_STEP_MAX } from './config.ts';
import { MinHeap } from './minHeap.ts';
import { rectInsideFloor, rectsOverlap, type Room } from './room.ts';
import type { Point, Rect } from './types.ts';

export interface NavGrid {
  cols: number;
  rows: number;
  /** Cell size in px. */
  cell: number;
  /** Row-major, cols * rows. true = blocked. */
  blocked: boolean[];
  /**
   * ST3: the height level of every cell (row-major, 0 = floor; the size of its block stack). Missing = flat. A step between two
   * neighbour cells needs a level difference of at most NAV_STEP_MAX, so a stack of 1, 2, 3 blocks is a stair.
   */
  level?: number[];
}

/** ST3: the level of cell index i (0 when the grid is flat). */
export function levelOf(grid: NavGrid, i: number): number {
  return grid.level?.[i] ?? 0;
}

/** ST3: true if an avatar can step from cell index a to its neighbour b (at most NAV_STEP_MAX levels up or down). */
export function canStep(grid: NavGrid, a: number, b: number): boolean {
  return Math.abs(levelOf(grid, a) - levelOf(grid, b)) <= NAV_STEP_MAX;
}

/** Grows a rectangle by r on every side. */
export function inflateRect(rect: Rect, r: number): Rect {
  return { x: rect.x - r, y: rect.y - r, w: rect.w + 2 * r, h: rect.h + 2 * r };
}

export function buildNavGrid(room: Room, blockers: readonly Rect[], radius = 0, cell = NAV_CELL): NavGrid {
  const cols = Math.ceil(room.w / cell);
  const rows = Math.ceil(room.h / cell);
  const grown = blockers.map((b) => inflateRect(b, radius));
  const blocked: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect = cellRect({ cols, rows, cell, blocked }, c, r);
      // Outside the floor (the union of the shape's rectangles) or covered by a blocker.
      blocked.push(!rectInsideFloor(room, rect) || grown.some((g) => rectsOverlap(rect, g)));
    }
  }
  return { cols, rows, cell, blocked };
}

export function cellRect(grid: NavGrid, c: number, r: number): Rect {
  return { x: c * grid.cell, y: r * grid.cell, w: grid.cell, h: grid.cell };
}

export function cellCenter(grid: NavGrid, c: number, r: number): Point {
  return { x: (c + 0.5) * grid.cell, y: (r + 0.5) * grid.cell };
}

/** True if the cell is inside the grid and not blocked. */
export function isCellFree(grid: NavGrid, c: number, r: number): boolean {
  return c >= 0 && r >= 0 && c < grid.cols && r < grid.rows && !grid.blocked[r * grid.cols + c];
}

/** The cell that contains a world point (may be outside the grid). */
export function cellAt(grid: NavGrid, p: Point): { c: number; r: number } {
  return { c: Math.floor(p.x / grid.cell), r: Math.floor(p.y / grid.cell) };
}

/** True if the closed segment a-b touches the closed rectangle (Liang-Barsky clipping). */
export function segmentTouchesRect(a: Point, b: Point, rect: Rect): boolean {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const p = [-dx, dx, -dy, dy];
  const q = [a.x - rect.x, rect.x + rect.w - a.x, a.y - rect.y, rect.y + rect.h - a.y];
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < 4; i++) {
    const pi = p[i]!;
    const qi = q[i]!;
    if (pi === 0) {
      if (qi < 0) return false;
    } else {
      const t = qi / pi;
      if (pi < 0) {
        if (t > t1) return false;
        if (t > t0) t0 = t;
      } else {
        if (t < t0) return false;
        if (t < t1) t1 = t;
      }
    }
  }
  return true;
}

/** True if the straight line a-b touches no blocked cell (and no cell outside the grid). */
export function lineOfSight(grid: NavGrid, a: Point, b: Point): boolean {
  const c0 = Math.floor(Math.min(a.x, b.x) / grid.cell) - 1;
  const c1 = Math.floor(Math.max(a.x, b.x) / grid.cell) + 1;
  const r0 = Math.floor(Math.min(a.y, b.y) / grid.cell) - 1;
  const r1 = Math.floor(Math.max(a.y, b.y) / grid.cell) + 1;
  // ST3: a straight line stays on one level (a stair is walked cell by cell, never cut across).
  const here = grid.level ? cellAt(grid, a) : null;
  const level = here && isCellFree(grid, here.c, here.r) ? levelOf(grid, here.r * grid.cols + here.c) : 0;
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!segmentTouchesRect(a, b, cellRect(grid, c, r))) continue;
      if (!isCellFree(grid, c, r)) return false;
      if (grid.level && levelOf(grid, r * grid.cols + c) !== level) return false;
    }
  }
  return true;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/**
 * Free neighbour cells (8 directions, no corner cutting) of cell index i. ST3: each step is at most NAV_STEP_MAX levels up or
 * down (a diagonal needs both side cells passable by step too). `dropFrom` = the start cell: it may step DOWN any height, so an
 * avatar left on a stack whose neighbours were broken is never stuck.
 */
function neighbours(grid: NavGrid, i: number, dropFrom = -1): number[] {
  const c = i % grid.cols;
  const r = (i - c) / grid.cols;
  const out: number[] = [];
  const ok = (a: number, b: number): boolean => canStep(grid, a, b) || (a === dropFrom && levelOf(grid, b) < levelOf(grid, a));
  for (const [dc, dr] of DIRS) {
    if (!isCellFree(grid, c + dc, r + dr)) continue;
    const n = (r + dr) * grid.cols + c + dc;
    if (dc !== 0 && dr !== 0) {
      if (!isCellFree(grid, c + dc, r) || !isCellFree(grid, c, r + dr)) continue;
      const sa = r * grid.cols + c + dc;
      const sb = (r + dr) * grid.cols + c;
      if (!(ok(i, sa) && canStep(grid, sa, n) && ok(i, sb) && canStep(grid, sb, n))) continue;
    } else if (!ok(i, n)) continue;
    out.push(n);
  }
  return out;
}

function centerOf(grid: NavGrid, i: number): Point {
  const c = i % grid.cols;
  return cellCenter(grid, c, (i - c) / grid.cols);
}

/** Every cell reachable from cell index start (true = reachable). */
export function reachableCells(grid: NavGrid, start: number, dropFrom = -1): boolean[] {
  const seen = new Array<boolean>(grid.blocked.length).fill(false);
  seen[start] = true;
  const queue = [start];
  for (let k = 0; k < queue.length; k++) {
    for (const n of neighbours(grid, queue[k]!, dropFrom)) {
      if (!seen[n]) {
        seen[n] = true;
        queue.push(n);
      }
    }
  }
  return seen;
}

/** A* over cell indices. Returns the cells from start to goal, or null. */
function aStar(grid: NavGrid, start: number, goal: number, dropFrom = -1): number[] | null {
  const n = grid.blocked.length;
  const g = new Array<number>(n).fill(Infinity);
  const parent = new Array<number>(n).fill(-1);
  const closed = new Array<boolean>(n).fill(false);
  const gc = goal % grid.cols;
  const gr = (goal - gc) / grid.cols;
  const h = (i: number): number => {
    const c = i % grid.cols;
    const dx = Math.abs(c - gc);
    const dy = Math.abs((i - c) / grid.cols - gr);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  const open = new MinHeap();
  g[start] = 0;
  open.push(start, h(start));
  while (open.size > 0) {
    const cur = open.pop()!;
    if (cur === goal) {
      const cells = [cur];
      while (parent[cells[0]!]! >= 0) cells.unshift(parent[cells[0]!]!);
      return cells;
    }
    if (closed[cur]) continue;
    closed[cur] = true;
    const cc = cur % grid.cols;
    for (const nb of neighbours(grid, cur, dropFrom)) {
      const diagonal = nb % grid.cols !== cc && Math.abs(nb - cur) !== 1;
      const cost = g[cur]! + (diagonal ? Math.SQRT2 : 1);
      if (cost < g[nb]!) {
        g[nb] = cost;
        parent[nb] = cur;
        open.push(nb, cost + h(nb));
      }
    }
  }
  return null;
}

/** The free cell (index) whose center is nearest to p, among cells where ok(i) is true. */
export function nearestFreeCell(grid: NavGrid, p: Point, ok: (i: number) => boolean = () => true): number | null {
  let best: number | null = null;
  let bestD = Infinity;
  for (let i = 0; i < grid.blocked.length; i++) {
    if (grid.blocked[i] || !ok(i)) continue;
    const c = centerOf(grid, i);
    const d = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Removes waypoints whose neighbours can see each other (section 6). */
export function smoothPath(grid: NavGrid, points: readonly Point[]): Point[] {
  if (points.length <= 2) return [...points];
  const out = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    if (!lineOfSight(grid, out[out.length - 1]!, points[i + 1]!)) out.push(points[i]!);
  }
  out.push(points[points.length - 1]!);
  return out;
}

/**
 * A path of world points from `from` to `to`, starting with `from`. If `to` is blocked, the
 * path ends at the center of the nearest reachable free cell. Returns null when `to` is free
 * but cannot be reached, or when nothing free is reachable.
 */
export function findPath(grid: NavGrid, from: Point, to: Point): Point[] | null {
  const sc = cellAt(grid, from);
  let start: number | null = sc.r * grid.cols + sc.c;
  const startMoved = !isCellFree(grid, sc.c, sc.r);
  // Standing on a blocked cell (something was put on the avatar): leave via the nearest free cell.
  if (startMoved) start = nearestFreeCell(grid, from, () => true);
  if (start === null) return null;

  const reach = reachableCells(grid, start, start);
  const tc = cellAt(grid, to);
  let goal: number | null;
  let end: Point;
  if (isCellFree(grid, tc.c, tc.r)) {
    goal = tc.r * grid.cols + tc.c;
    if (!reach[goal]) return null;
    end = { x: to.x, y: to.y };
  } else {
    goal = nearestFreeCell(grid, to, (i) => reach[i] === true);
    if (goal === null) return null;
    end = centerOf(grid, goal);
  }

  const cells = aStar(grid, start, goal, start);
  if (!cells) return null;
  const middle = cells.slice(startMoved ? 0 : 1, -1).map((i) => centerOf(grid, i));
  return smoothPath(grid, [{ x: from.x, y: from.y }, ...middle, end]);
}
