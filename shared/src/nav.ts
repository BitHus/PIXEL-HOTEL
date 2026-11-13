// Navigation in the hotel and the shop (brief section 6). Pure functions on plain data.
//
// - The grid has NAV_CELL px cells over the floor. A cell is blocked if any part of it is
//   outside the floor, or if it overlaps a blocking footprint made bigger by AVATAR_RADIUS on
//   every side. Because the whole cell area is tested, every point in a free cell is at least
//   AVATAR_RADIUS away from every blocker.
// - A* with 8 directions and no corner cutting (a diagonal step needs both side cells free).
// - Smoothing: a waypoint is removed when the straight line between its neighbours does not
//   touch a blocked cell. The result is a list of world points.

import { AVATAR_RADIUS, NAV_CELL } from './config.ts';
import { MinHeap } from './minHeap.ts';
import { floorRect, rectInside, rectsOverlap, type Room } from './room.ts';
import type { Point, Rect } from './types.ts';

export interface NavGrid {
  cols: number;
  rows: number;
  /** Cell size in px. */
  cell: number;
  /** Row-major, cols * rows. true = blocked. */
  blocked: boolean[];
}

/** Grows a rectangle by r on every side. */
export function inflateRect(rect: Rect, r: number): Rect {
  return { x: rect.x - r, y: rect.y - r, w: rect.w + 2 * r, h: rect.h + 2 * r };
}

export function buildNavGrid(room: Room, blockers: readonly Rect[], radius = AVATAR_RADIUS, cell = NAV_CELL): NavGrid {
  const cols = Math.ceil(room.w / cell);
  const rows = Math.ceil(room.h / cell);
  const floor = floorRect(room);
  const grown = blockers.map((b) => inflateRect(b, radius));
  const blocked: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const rect = cellRect({ cols, rows, cell, blocked }, c, r);
      blocked.push(!rectInside(rect, floor) || grown.some((g) => rectsOverlap(rect, g)));
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
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!isCellFree(grid, c, r) && segmentTouchesRect(a, b, cellRect(grid, c, r))) return false;
    }
  }
  return true;
}

const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];

/** Free neighbour cells (8 directions, no corner cutting) of cell index i. */
function neighbours(grid: NavGrid, i: number): number[] {
  const c = i % grid.cols;
  const r = (i - c) / grid.cols;
  const out: number[] = [];
  for (const [dc, dr] of DIRS) {
    if (!isCellFree(grid, c + dc, r + dr)) continue;
    if (dc !== 0 && dr !== 0 && (!isCellFree(grid, c + dc, r) || !isCellFree(grid, c, r + dr))) continue;
    out.push((r + dr) * grid.cols + c + dc);
  }
  return out;
}

function centerOf(grid: NavGrid, i: number): Point {
  const c = i % grid.cols;
  return cellCenter(grid, c, (i - c) / grid.cols);
}

/** Every cell reachable from cell index start. */
function reachable(grid: NavGrid, start: number): boolean[] {
  const seen = new Array<boolean>(grid.blocked.length).fill(false);
  seen[start] = true;
  const queue = [start];
  for (let k = 0; k < queue.length; k++) {
    for (const n of neighbours(grid, queue[k]!)) {
      if (!seen[n]) {
        seen[n] = true;
        queue.push(n);
      }
    }
  }
  return seen;
}

/** A* over cell indices. Returns the cells from start to goal, or null. */
function aStar(grid: NavGrid, start: number, goal: number): number[] | null {
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
    for (const nb of neighbours(grid, cur)) {
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
function nearestCell(grid: NavGrid, p: Point, ok: (i: number) => boolean): number | null {
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
  if (startMoved) start = nearestCell(grid, from, () => true);
  if (start === null) return null;

  const reach = reachable(grid, start);
  const tc = cellAt(grid, to);
  let goal: number | null;
  let end: Point;
  if (isCellFree(grid, tc.c, tc.r)) {
    goal = tc.r * grid.cols + tc.c;
    if (!reach[goal]) return null;
    end = { x: to.x, y: to.y };
  } else {
    goal = nearestCell(grid, to, (i) => reach[i] === true);
    if (goal === null) return null;
    end = centerOf(grid, goal);
  }

  const cells = aStar(grid, start, goal);
  if (!cells) return null;
  const middle = cells.slice(startMoved ? 0 : 1, -1).map((i) => centerOf(grid, i));
  return smoothPath(grid, [{ x: from.x, y: from.y }, ...middle, end]);
}
