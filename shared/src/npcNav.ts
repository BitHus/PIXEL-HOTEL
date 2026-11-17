// The tavern's own nav grid (staff zone behind the bar blocked for guests) and the guests' paths.
// Pure. Guests never walk or stand where the player serves: the strip behind the bar is blocked
// for them (step 9d, kept by 9t and S1).

import { getFurnitureType, staffZone } from './furniture.ts';
import { cellAt, cellCenter, cellRect, findPath, isCellFree, nearestFreeCell, reachableCells, type NavGrid } from './nav.ts';
import { innDoorSpotRects } from './innDoors.ts';
import { kitchenZone } from './kitchen.ts';
import { rectsOverlap, type Room } from './room.ts';
import type { FurnitureItem, Point, Rect } from './types.ts';

/** The staff zones of a room: behind every item that is served from behind (the counter) and every bar extension piece (OA-6). */
export function staffZones(items: readonly FurnitureItem[], roomId: number): Rect[] {
  return items.flatMap((i) => {
    if (i.roomId !== roomId || i.onItemUid !== null) return [];
    const type = getFurnitureType(i.typeId);
    return type.servedFromBehind || type.barExtension ? [staffZone(i, type)] : [];
  });
}

/** Everything guests never enter: the staff zones behind the bar, the kitchen zone (step T1) and the Inn door spots (step MB-2). */
export function guestZones(items: readonly FurnitureItem[], room: Room): Rect[] {
  const kitchen = kitchenZone(room);
  return [...staffZones(items, room.id), ...(kitchen ? [kitchen] : []), ...innDoorSpotRects(room)];
}

/** True if a point is in a staff zone (edges count). */
export function inStaffZone(zones: readonly Rect[], p: Point): boolean {
  return zones.some((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
}

const NPC_GRIDS = new WeakMap<NavGrid, { key: string; grid: NavGrid }>();

/**
 * The nav grid for customers: the room's grid with every cell that touches a staff zone blocked.
 * Cached per grid (the room's grid is rebuilt when furniture changes).
 */
export function npcGrid(grid: NavGrid, zones: readonly Rect[]): NavGrid {
  const key = zones.map((z) => `${z.x},${z.y},${z.w},${z.h}`).join(';');
  const cached = NPC_GRIDS.get(grid);
  if (cached && cached.key === key) return cached.grid;
  const blocked = grid.blocked.slice();
  for (let i = 0; i < blocked.length; i++) {
    if (blocked[i]) continue;
    const c = i % grid.cols;
    const rect = cellRect(grid, c, (i - c) / grid.cols);
    if (zones.some((z) => rectsOverlap(rect, z))) blocked[i] = true;
  }
  const out = { ...grid, blocked };
  NPC_GRIDS.set(grid, { key, grid: out });
  return out;
}

/**
 * A customer's way to a point (without the start). If the point is blocked or cannot be reached
 * (staff only, furniture), it ends at the nearest free cell they can reach: in front of a
 * decoration behind the counter, on the customer side. Empty when there is no way at all.
 */
export function npcPath(grid: NavGrid, from: Point, to: Point): Point[] {
  const direct = findPath(grid, from, to);
  if (direct) return direct.slice(1);
  const sc = cellAt(grid, from);
  const start = isCellFree(grid, sc.c, sc.r) ? sc.r * grid.cols + sc.c : nearestFreeCell(grid, from);
  if (start === null) return [];
  const reach = reachableCells(grid, start);
  const goal = nearestFreeCell(grid, to, (i) => reach[i] === true);
  if (goal === null) return [];
  const c = goal % grid.cols;
  const p = findPath(grid, from, cellCenter(grid, c, (goal - c) / grid.cols));
  return p ? p.slice(1) : [];
}

const REACH = new WeakMap<NavGrid, Map<number, number[]>>();

/** The free cells (indices) a customer can reach from a point, cached per grid and start cell. */
export function reachableFrom(grid: NavGrid, from: Point): number[] {
  const c = cellAt(grid, from);
  if (!isCellFree(grid, c.c, c.r)) return [];
  const start = c.r * grid.cols + c.c;
  let per = REACH.get(grid);
  if (!per) REACH.set(grid, (per = new Map()));
  let cells = per.get(start);
  if (!cells) {
    const reach = reachableCells(grid, start);
    cells = [];
    for (let i = 0; i < reach.length; i++) if (reach[i]) cells.push(i);
    per.set(start, cells);
  }
  return cells;
}
