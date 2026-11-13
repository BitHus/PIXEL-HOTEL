// Placing rules (step 4b). A placing session is the ghost of one item that the player moves
// around until they press Place or Cancel. Nothing in the room changes until Place:
// - startNewPlacing: an item from the list (an inventory item, or a brand new one).
// - startMovePlacing: a placed item; the ghost starts where it is, facing the same way.
// - confirmPlacing returns null (refused) while the ghost is in an invalid spot.
// - cancelPlacing puts a moved item back at its exact previous position and facing.
// - rotateInPlace turns a placed item to its next facing, refused (null) when that does not fit.
// Pure functions on plain data.

import {
  footprintSize,
  getFurnitureType,
  moveItem,
  nextFacing,
  planPlacement,
  ridersOf,
  snapCoord,
  type FurnitureLookup,
  type MoveTo,
  type Placement,
} from './furniture.ts';
import type { Room } from './room.ts';
import type { Facing, FurnitureItem, Point } from './types.ts';

export interface PlacingSession {
  typeId: string;
  /** The item being placed: a placed item (moving), an inventory item, or null for a new one. */
  uid: number | null;
  /** Where a moved item stood before (cancel puts it back there); null when it is not moving. */
  origin: MoveTo | null;
  /** Footprint center the ghost aims at, world px (unsnapped). */
  center: Point;
  facing: Facing;
}

/** The middle of an item's footprint. */
export function footprintCenter(pose: { x: number; y: number; facing: Facing }, typeId: string, types: FurnitureLookup = getFurnitureType): Point {
  return { x: pose.x, y: pose.y - footprintSize(types(typeId), pose.facing).d / 2 };
}

/** A ghost for an item from the list, shown at `center` with the type's first facing. */
export function startNewPlacing(typeId: string, center: Point, inventoryUid: number | null, types: FurnitureLookup = getFurnitureType): PlacingSession {
  return { typeId, uid: inventoryUid, origin: null, center, facing: types(typeId).facings[0] ?? 'down' };
}

/** A ghost for a placed item, starting exactly where it stands. */
export function startMovePlacing(item: FurnitureItem, types: FurnitureLookup = getFurnitureType): PlacingSession {
  const origin: MoveTo = { x: item.x, y: item.y, facing: item.facing, onItemUid: item.onItemUid, roomId: item.roomId };
  return { typeId: item.typeId, uid: item.uid, origin, center: footprintCenter(item, item.typeId, types), facing: item.facing };
}

export function moveGhost(s: PlacingSession, center: Point): PlacingSession {
  return { ...s, center };
}

/** The ghost turns to the next facing (it may become invalid: then it shows red). */
export function rotateGhost(s: PlacingSession, types: FurnitureLookup = getFurnitureType): PlacingSession {
  return { ...s, facing: nextFacing(types(s.typeId), s.facing) };
}

/**
 * Where the ghost would go: anchor snapped to SNAP (or whole px with snap off), on a surface or
 * on the floor, and whether it fits. `items` are all items (the one being placed is left out).
 */
export function planGhost(room: Room, items: readonly FurnitureItem[], s: PlacingSession, snap = true, types: FurnitureLookup = getFurnitureType): Placement {
  const type = types(s.typeId);
  const fd = footprintSize(type, s.facing).d;
  const x = snapCoord(s.center.x, snap);
  const y = snapCoord(s.center.y + fd / 2, snap);
  const others = items.filter((i) => i.uid !== s.uid);
  const carrying = s.origin !== null && s.uid !== null && ridersOf(items, s.uid).length > 0;
  return planPlacement(room, others, type, x, y, s.facing, carrying, types);
}

/**
 * Places the ghost. Returns the new items, or null (refused) when the ghost does not fit.
 * A brand new item gets the uid from newUid (only called when one is needed).
 */
export function confirmPlacing(
  room: Room,
  items: readonly FurnitureItem[],
  s: PlacingSession,
  owner: { ownerId: number; newUid: () => number },
  snap = true,
  types: FurnitureLookup = getFurnitureType,
): FurnitureItem[] | null {
  const plan = planGhost(room, items, s, snap, types);
  if (!plan.ok) return null;
  const to: MoveTo = { x: plan.x, y: plan.y, facing: plan.facing, onItemUid: plan.onItemUid, roomId: room.id };
  if (s.uid !== null) return moveItem(items, s.uid, to, types);
  return [...items, { uid: owner.newUid(), typeId: s.typeId, ownerId: owner.ownerId, ...to }];
}

/**
 * Ends the session without placing: a moved item stands exactly where it stood before (same
 * position, facing and surface); a new or inventory item stays where it was (not in the room).
 */
export function cancelPlacing(items: readonly FurnitureItem[], s: PlacingSession): FurnitureItem[] {
  const origin = s.origin;
  if (s.uid === null || !origin) return [...items];
  return items.map((i) => (i.uid === s.uid ? { ...i, ...origin } : i));
}

/**
 * Turns a placed item to its next facing around its footprint center. Returns the new items, or
 * null when the type has only one facing, the turned item does not fit there, or something
 * standing on it would fall off.
 */
export function rotateInPlace(room: Room, items: readonly FurnitureItem[], uid: number, types: FurnitureLookup = getFurnitureType): FurnitureItem[] | null {
  const item = items.find((i) => i.uid === uid && i.roomId === room.id);
  if (!item) return null;
  const type = types(item.typeId);
  const facing = nextFacing(type, item.facing);
  if (facing === item.facing) return null;
  const c = footprintCenter(item, item.typeId, types);
  const y = type.wall ? 0 : Math.round(c.y + footprintSize(type, facing).d / 2);
  const others = items.filter((i) => i.uid !== uid);
  const carrying = ridersOf(items, uid).length > 0;
  const plan = planPlacement(room, others, type, item.x, y, facing, carrying, types);
  if (!plan.ok || plan.onItemUid !== item.onItemUid) return null;
  const next = moveItem(items, uid, { x: plan.x, y: plan.y, facing, onItemUid: plan.onItemUid, roomId: room.id }, types);
  const fellOff = ridersOf(items, uid).some((r) => next.find((n) => n.uid === r.uid)?.roomId !== room.id);
  return fellOff ? null : next;
}
