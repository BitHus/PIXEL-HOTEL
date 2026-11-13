// Sitting and lying (step 5b, brief sections 6-8). Pure functions on plain data.
//
// - A type's seats are { dx, dy, pose } for the 'down' facing, relative to the anchor; they turn
//   with the item like standPoint. A sitting avatar faces the way the item faces; a lying
//   avatar's head points to the pillow end (headDirection).
// - Every seat has four approach points, one on each side of the footprint, just outside it at
//   AVATAR_RADIUS distance and level with the seat. The avatar walks to the reachable one with
//   the shortest path, then slides onto the seat (no pathfinding for that last bit).
// - Long items have several seats: the free seat nearest to the tap is taken. `taken` lists the
//   seat indices other avatars use (prepared for more avatars).

import { APPROACH_REACH_PX, AVATAR_RADIUS } from './config.ts';
import { footprintRect, footprintSize, rotateQuarter, type Pose } from './furniture.ts';
import { cellAt, cellCenter, findPath, isCellFree, nearestFreeCell, type NavGrid } from './nav.ts';
import { pathLength } from './avatar.ts';
import type { Facing, FurnitureItem, FurnitureType, Point, SeatPoseKind } from './types.ts';

const TURN_ORDER: readonly Facing[] = ['down', 'right', 'up', 'left'];

/** A seat in the world: where the avatar is (feet, or the middle of the body when lying). */
export interface SeatSpot extends Pose {
  pose: SeatPoseKind;
  /** Index in type.seats. */
  index: number;
}

/** True if the item can be sat or lain on. */
export function hasSeats(type: FurnitureType): boolean {
  return type.seats.length > 0;
}

/** The type's seats in the world for this item (turned with it). */
export function seatSpots(item: Pose, type: FurnitureType): SeatSpot[] {
  const turns = TURN_ORDER.indexOf(item.facing);
  const cy = item.y - footprintSize(type, item.facing).d / 2;
  return type.seats.map((s, index) => {
    const off = rotateQuarter({ x: s.dx, y: s.dy + type.d / 2 }, turns);
    return { x: item.x + off.x, y: cy + off.y, facing: item.facing, pose: s.pose, index };
  });
}

/** Unit vector from a lying body's middle toward its head (the pillow end of the bed). */
export function headDirection(facing: Facing): Point {
  return rotateQuarter({ x: 0, y: -1 }, TURN_ORDER.indexOf(facing));
}

/** Where the head of an avatar lying on this spot is (floor px). */
export function headPoint(spot: SeatSpot, headPx: number): Point {
  const d = headDirection(spot.facing);
  return { x: spot.x + d.x * headPx, y: spot.y + d.y * headPx };
}

/** The four approach points of a seat: below, left, right and above the footprint. */
export function approachPoints(item: Pose, type: FurnitureType, seat: Point): Point[] {
  const fp = footprintRect(item, type);
  const r = AVATAR_RADIUS;
  const sx = Math.min(fp.x + fp.w, Math.max(fp.x, seat.x));
  const sy = Math.min(fp.y + fp.h, Math.max(fp.y, seat.y));
  return [
    { x: sx, y: fp.y + fp.h + r },
    { x: fp.x - r, y: sy },
    { x: fp.x + fp.w + r, y: sy },
    { x: sx, y: fp.y - r },
  ];
}

/** Free seat indices, nearest to the tap first (in data order without a tap). */
export function freeSeatsByTap(item: Pose, type: FurnitureType, tap: Point | null, taken: readonly number[]): SeatSpot[] {
  const free = seatSpots(item, type).filter((s) => !taken.includes(s.index));
  if (!tap) return free;
  const d = (s: SeatSpot): number => (s.x - tap.x) ** 2 + (s.y - tap.y) ** 2;
  return free.sort((a, b) => d(a) - d(b) || a.index - b.index);
}

/**
 * The shortest walk from `from` to an approach point of the seat, or null when none is reachable.
 * A point counts as reached when the walk ends within APPROACH_REACH_PX of it.
 */
export function approachPath(grid: NavGrid, from: Point, item: Pose, type: FurnitureType, seat: Point): Point[] | null {
  let best: Point[] | null = null;
  let bestLen = Infinity;
  for (const p of approachPoints(item, type, seat)) {
    const path = findPath(grid, from, p);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x - p.x, end.y - p.y) > APPROACH_REACH_PX) continue;
    const len = pathLength(path);
    if (len < bestLen) {
      bestLen = len;
      best = path;
    }
  }
  return best;
}

export interface SitPlan {
  /** The walk to the approach point (starts at `from`). */
  path: Point[];
  /** The seat to slide onto on arrival. */
  seat: SeatSpot;
}

/**
 * Plans sitting (or lying) on an item: the free seat nearest to the tap, reached by its nearest
 * approach point. If that seat cannot be reached, the next free seat is tried. Null = nothing.
 */
export function planSit(
  grid: NavGrid,
  from: Point,
  item: FurnitureItem,
  type: FurnitureType,
  tap: Point | null,
  taken: readonly number[] = [],
): SitPlan | null {
  for (const seat of freeSeatsByTap(item, type, tap, taken)) {
    const path = approachPath(grid, from, item, type, seat);
    if (path) return { path, seat };
  }
  return null;
}

/** True if the avatar is exactly on this item's seat (the item did not move or turn). */
export function onSeat(avatar: Pose, item: Pose | undefined, type: FurnitureType | undefined, index: number): boolean {
  if (!item || !type) return false;
  const s = seatSpots(item, type)[index];
  return s !== undefined && s.x === avatar.x && s.y === avatar.y && s.facing === avatar.facing;
}

/** Where an avatar stands up: p itself if its cell is free, else the nearest free cell center. */
export function standUpSpot(grid: NavGrid, p: Point): Point {
  const c = cellAt(grid, p);
  if (isCellFree(grid, c.c, c.r)) return { x: p.x, y: p.y };
  const i = nearestFreeCell(grid, p);
  if (i === null) return { x: p.x, y: p.y };
  const col = i % grid.cols;
  return cellCenter(grid, col, (i - col) / grid.cols);
}
