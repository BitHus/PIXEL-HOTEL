// Furniture rules (brief section 7). Pure functions on plain data.
//
// - (x, y) is the anchor: the bottom center of the footprint. The footprint runs from
//   (x - fw/2, y - fd) to (x + fw/2, y); fw, fd are w, d facing down/up and d, w facing left/right.
// - Placement: footprint inside the floor, no overlap with another blocking item (non-blocking
//   items such as rugs overlap anything), not touching the door zone, and the door can still
//   reach the middle of the room. Wall items stay on the back wall band (anchor y = 0).
// - onSurface items snap to the nearest free spot on top of a surface item (one level only)
//   and move and return together with the item under it ("riders").
// - Functions that need other items' types take a lookup (default: shared/data/furniture.json).

import furnitureData from '../data/furniture.json';
import { DOOR_ZONE_H, SNAP } from './config.ts';
import { buildNavGrid, cellAt, isCellFree, nearestFreeCell, reachableCells } from './nav.ts';
import { doorZoneRect, rectInsideFloor, rectsOverlap, rectsTouch, type Room } from './room.ts';
import type { Facing, FurnitureItem, FurnitureType, Point, Rect } from './types.ts';

/** The starter furniture types (step 4), from shared/data/furniture.json. */
export const FURNITURE_TYPES = furnitureData as FurnitureType[];

const TYPES_BY_ID = new Map(FURNITURE_TYPES.map((t) => [t.id, t]));

export type FurnitureLookup = (typeId: string) => FurnitureType;

export function getFurnitureType(typeId: string): FurnitureType {
  const t = TYPES_BY_ID.get(typeId);
  if (!t) throw new Error(`unknown furniture type ${typeId}`);
  return t;
}

/** Where an item stands (the parts of FurnitureItem that footprints need). */
export interface Pose {
  x: number;
  y: number;
  facing: Facing;
}

/** Footprint size for a facing: w and d swap when the item faces left or right. */
export function footprintSize(type: FurnitureType, facing: Facing): { w: number; d: number } {
  return facing === 'left' || facing === 'right' ? { w: type.d, d: type.w } : { w: type.w, d: type.d };
}

/** The footprint rectangle on the floor, in world px. */
export function footprintRect(item: Pose & { typeId?: string }, type?: FurnitureType): Rect {
  const t = type ?? getFurnitureType(item.typeId ?? '');
  const { w, d } = footprintSize(t, item.facing);
  return { x: item.x - w / 2, y: item.y - d, w, h: d };
}

/** Snaps a coordinate to SNAP px, or to a whole px when snapping is off (Shift). */
export function snapCoord(v: number, snap = true): number {
  return snap ? Math.round(v / SNAP) * SNAP : Math.round(v);
}

/** The next facing in the type's list (rotation cycles through them). */
export function nextFacing(type: FurnitureType, facing: Facing): Facing {
  const i = type.facings.indexOf(facing);
  return type.facings[(i + 1) % type.facings.length] ?? facing;
}

/** True if the type may be placed in this kind of room (placeIn). */
export function fitsRoomKind(type: FurnitureType, room: Room): boolean {
  return type.placeIn === 'both' || type.placeIn === room.kind;
}

/** Items standing on the item with this uid. */
export function ridersOf(items: readonly FurnitureItem[], uid: number): FurnitureItem[] {
  return items.filter((i) => i.onItemUid === uid && i.roomId !== null);
}

/** Items on the floor of the room (not in the inventory, not on a surface, not on the wall). */
function floorItems(items: readonly FurnitureItem[], roomId: number, types: FurnitureLookup): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && i.onItemUid === null && !types(i.typeId).wall);
}

/** Footprints of the items in the room that block walking (the navigation blockers). */
export function itemBlockers(
  items: readonly FurnitureItem[],
  roomId: number,
  types: FurnitureLookup = getFurnitureType,
): Rect[] {
  return floorItems(items, roomId, types)
    .filter((i) => types(i.typeId).blocks)
    .map((i) => footprintRect(i, types(i.typeId)));
}

/** Where avatars come in: the middle of the door zone. */
export function doorPoint(room: Room): Point {
  return { x: room.w / 2, y: room.h - DOOR_ZONE_H / 2 };
}

/**
 * True if an avatar walking in at the door can reach the middle of the room. When the middle
 * itself is covered, the free spot nearest to the middle must be reachable.
 */
export function doorReachesMiddle(room: Room, blockers: readonly Rect[]): boolean {
  const grid = buildNavGrid(room, blockers);
  const door = cellAt(grid, doorPoint(room));
  if (!isCellFree(grid, door.c, door.r)) return false;
  const reach = reachableCells(grid, door.r * grid.cols + door.c);
  const middle = nearestFreeCell(grid, { x: room.w / 2, y: room.h / 2 });
  return middle !== null && reach[middle] === true;
}

/**
 * True if an item of this type may stand on the floor (or the wall band) at (x, y). `items` are
 * the other items (leave out the one being moved); only those in this room count.
 */
export function canPlace(
  room: Room,
  items: readonly FurnitureItem[],
  type: FurnitureType,
  x: number,
  y: number,
  facing: Facing,
  types: FurnitureLookup = getFurnitureType,
): boolean {
  if (!fitsRoomKind(type, room) || !type.facings.includes(facing)) return false;
  const fp = footprintRect({ x, y, facing }, type);
  if (type.wall) {
    if (y !== 0 || fp.x < 0 || fp.x + fp.w > room.w) return false;
    return !items.some(
      (o) => o.roomId === room.id && types(o.typeId).wall && rectsOverlap(fp, footprintRect(o, types(o.typeId))),
    );
  }
  if (!rectInsideFloor(room, fp)) return false;
  if (rectsTouch(fp, doorZoneRect(room))) return false;
  if (!type.blocks) return true;
  const blockers = itemBlockers(items, room.id, types);
  if (blockers.some((b) => rectsOverlap(fp, b))) return false;
  return doorReachesMiddle(room, [...blockers, fp]);
}

export interface SurfaceSpot {
  x: number;
  y: number;
  onItemUid: number;
}

/**
 * For an onSurface item: the nearest free spot on top of the surface item under the footprint
 * center at (x, y). One level only: an item that stands on a surface is never a surface itself.
 * Returns null when there is no surface under that point, or no free spot on it.
 */
export function snapToSurface(
  room: Room,
  items: readonly FurnitureItem[],
  type: FurnitureType,
  x: number,
  y: number,
  facing: Facing,
  types: FurnitureLookup = getFurnitureType,
): SurfaceSpot | null {
  if (!type.onSurface || type.wall || !fitsRoomKind(type, room)) return null;
  const { w: fw, d: fd } = footprintSize(type, facing);
  const cx = x;
  const cy = y - fd / 2;
  const surface = floorItems(items, room.id, types).find((s) => {
    if (!types(s.typeId).surface) return false;
    const r = footprintRect(s, types(s.typeId));
    return cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h;
  });
  if (!surface) return null;
  const top = footprintRect(surface, types(surface.typeId));
  if (fw > top.w || fd > top.h) return null;
  const others = ridersOf(items, surface.uid).map((r) => footprintRect(r, types(r.typeId)));
  const minX = top.x + fw / 2;
  const maxX = top.x + top.w - fw / 2;
  const minY = top.y + fd;
  const maxY = top.y + top.h;
  const free = (px: number, py: number): boolean =>
    !others.some((o) => rectsOverlap(footprintRect({ x: px, y: py, facing }, type), o));
  const want = { x: clamp(x, minX, maxX), y: clamp(y, minY, maxY) };
  if (free(want.x, want.y)) return { ...want, onItemUid: surface.uid };
  let best: SurfaceSpot | null = null;
  let bestD = Infinity;
  for (const px of steps(minX, maxX)) {
    for (const py of steps(minY, maxY)) {
      const d = (px - want.x) ** 2 + (py - want.y) ** 2;
      if (d < bestD && free(px, py)) {
        bestD = d;
        best = { x: px, y: py, onItemUid: surface.uid };
      }
    }
  }
  return best;
}

export interface Placement extends Pose {
  onItemUid: number | null;
  /** True if the item may be put here. */
  ok: boolean;
}

/**
 * Where an item would go if dropped at (x, y): on a surface if it is an onSurface item over a
 * surface (and carries nothing itself: one level only), else on the floor or the wall band.
 * `carrying` is true when the item being moved has items standing on it.
 */
export function planPlacement(
  room: Room,
  items: readonly FurnitureItem[],
  type: FurnitureType,
  x: number,
  y: number,
  facing: Facing,
  carrying = false,
  types: FurnitureLookup = getFurnitureType,
): Placement {
  if (type.wall) y = 0;
  if (!carrying) {
    const spot = snapToSurface(room, items, type, x, y, facing, types);
    if (spot) return { ...spot, facing, ok: true };
  }
  return { x, y, facing, onItemUid: null, ok: canPlace(room, items, type, x, y, facing, types) };
}

const TURN_ORDER: readonly Facing[] = ['down', 'right', 'up', 'left'];

/** Rotates a floor vector by quarter turns (one turn takes 'down' to 'right'). */
export function rotateQuarter(p: Point, turns: number): Point {
  let { x, y } = p;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) [x, y] = [y, -x];
  return { x: x + 0, y: y + 0 };
}

function turnsBetween(from: Facing, to: Facing): number {
  return TURN_ORDER.indexOf(to) - TURN_ORDER.indexOf(from);
}

function footprintCenter(item: Pose, type: FurnitureType): Point {
  return { x: item.x, y: item.y - footprintSize(type, item.facing).d / 2 };
}

export interface MoveTo extends Pose {
  roomId: number | null;
  onItemUid: number | null;
}

/**
 * Moves (or places) an item. Items standing on it move and turn with it; one that no longer
 * fits on top goes back to the inventory.
 */
export function moveItem(
  items: readonly FurnitureItem[],
  uid: number,
  to: MoveTo,
  types: FurnitureLookup = getFurnitureType,
): FurnitureItem[] {
  const item = items.find((i) => i.uid === uid);
  if (!item) return [...items];
  const type = types(item.typeId);
  const moved: FurnitureItem = { ...item, ...to };
  const oldCenter = footprintCenter(item, type);
  const newCenter = footprintCenter(moved, type);
  const top = footprintRect(moved, type);
  const turns = turnsBetween(item.facing, to.facing);
  const placed: Rect[] = [];
  const riders = new Map<number, FurnitureItem>();
  for (const r of ridersOf(items, uid)) {
    const rt = types(r.typeId);
    const { w: rw, d: rd } = footprintSize(rt, r.facing);
    const off = rotateQuarter({ x: r.x - oldCenter.x, y: r.y - rd / 2 - oldCenter.y }, turns);
    const rx = clamp(newCenter.x + off.x, top.x + rw / 2, top.x + top.w - rw / 2);
    const ry = clamp(newCenter.y + off.y + rd / 2, top.y + rd, top.y + top.h);
    const fp = footprintRect({ x: rx, y: ry, facing: r.facing }, rt);
    const fits = rw <= top.w && rd <= top.h && !placed.some((p) => rectsOverlap(p, fp));
    if (fits && to.roomId !== null) {
      placed.push(fp);
      riders.set(r.uid, { ...r, x: rx, y: ry, roomId: to.roomId });
    } else {
      riders.set(r.uid, { ...r, roomId: null, onItemUid: null });
    }
  }
  return items.map((i) => (i.uid === uid ? moved : (riders.get(i.uid) ?? i)));
}

/** Picks an item up into the inventory; the items standing on it go back with it. */
export function pickUpItem(items: readonly FurnitureItem[], uid: number): FurnitureItem[] {
  const back = new Set([uid, ...ridersOf(items, uid).map((r) => r.uid)]);
  return items.map((i) => (back.has(i.uid) ? { ...i, roomId: null, onItemUid: null } : i));
}

/** Where an avatar stands in front of the item (standPoint, turned with the item). */
export function standPointFor(item: Pose, type: FurnitureType): Point {
  const turns = TURN_ORDER.indexOf(item.facing);
  const off = rotateQuarter({ x: type.standPoint.dx, y: type.standPoint.dy + type.d / 2 }, turns);
  const c = footprintCenter(item, type);
  return { x: c.x + off.x, y: c.y + off.y };
}

/** Where a sitting avatar is (the middle of the seat) and which way it faces. */
export function seatFor(item: Pose, type: FurnitureType): Pose {
  const c = footprintCenter(item, type);
  return { x: c.x, y: c.y, facing: item.facing };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** lo, lo + SNAP, ... and hi itself. */
function steps(lo: number, hi: number): number[] {
  const out: number[] = [];
  for (let v = lo; v < hi; v += SNAP) out.push(v);
  out.push(hi);
  return out;
}
