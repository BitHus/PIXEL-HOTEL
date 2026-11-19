// KITCHEN-ABOVE (owner 19 Nov, SAVE 42): the tavern's kitchen annex sits ABOVE the main floor, behind the back wall and the bar (room.ts annexAbove,
// roomShapes.json `kitchen`; the old annex below is `kitchenBelow`). Pure:
// - remapRoomContents: moves everything of one room (floor and wall pieces with their riders, blocks, plants, painted cells, guests and table mess) by a
//   point map, then puts every piece that no longer fits on the nearest free spot (else the bag). Used by the migration and by a room upgrade.
// - moveKitchenAbove: migration 41 -> 42 for every old tavern (no annexAbove): the main floor moves down by the new annex height, the old annex's contents
//   move into the new annex (bottom rows aligned, so the cells at its far side stay far), the door spots are cleared, batches of machines that went to the
//   bag give their crops back.
// - annexUpgradeMap: the point map of a room upgrade (an above annex can grow; everything keeps its distance to the annex's open bottom edge).

import { BUILD_CELL } from './config.ts';
import { canPlace, footprintRect, getFurnitureType, nearestValidPlacement, pickUpItem, ridersOf, snapToWallSpot } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { clearDoorSpots } from './innDoorClear.ts';
import { innDoorSpotRects } from './innDoors.ts';
import { returnOrphanBrews } from './brewing.ts';
import { returnOrphanCasks } from './casks.ts';
import { returnOrphanCooks } from './cooking.ts';
import { returnOrphanTaps } from './taps.ts';
import { doorZoneRect, mainShiftOf, rectInsideFloor, rectsOverlap, roomAnnex, roomAtLevel, type Room } from './room.ts';
import type { FurnitureItem, Point, Rect } from './types.ts';

/** Maps a world point of the room before the change to the room after it. */
export type PointMap = (p: Point) => Point;

const inside = (r: Rect, p: Point): boolean => p.x >= r.x && p.x < r.x + r.w && p.y >= r.y && p.y < r.y + r.h;

/** The map for a tavern: points in `annexFrom` keep their place to its bottom-left corner in `annexTo`; every other point moves down by `mainDy`. */
function annexMap(annexFrom: Rect | null, annexTo: Rect | null, mainDy: number): PointMap {
  return (p) => {
    if (annexFrom && annexTo && inside(annexFrom, p)) return { x: p.x - annexFrom.x + annexTo.x, y: p.y - (annexFrom.y + annexFrom.h) + (annexTo.y + annexTo.h) };
    return { x: p.x, y: p.y + mainDy };
  };
}

/** True if a floor piece stands well in the room: on the floor, off the door zone and the Inn door spots, not over another blocking piece. */
function standsWell(room: Room, items: readonly FurnitureItem[], it: FurnitureItem): boolean {
  const t = getFurnitureType(it.typeId);
  const fp = footprintRect(it, t);
  if (!rectInsideFloor(room, fp) || rectsOverlap(fp, doorZoneRect(room)) || innDoorSpotRects(room).some((r) => rectsOverlap(fp, r))) return false;
  if (!t.blocks) return true;
  return !items.some((o) => o.uid !== it.uid && o.roomId === room.id && o.onItemUid === null && !getFurnitureType(o.typeId).wall && getFurnitureType(o.typeId).blocks && rectsOverlap(fp, footprintRect(o, getFurnitureType(o.typeId))));
}

/**
 * Moves the contents of room `from` (its id) into `to` (the same room after the change) by `map`. Floor pieces are judged by the middle of their footprint,
 * riders move with what they stand on, wall pieces by their anchor; blocks, plants and painted cells by the middle of their cell; guests (and their paths)
 * and table mess by their point. Then every piece that does not stand well goes to the nearest free spot, else the bag (riders come along).
 */
export function remapRoomContents(state: GameState, from: Room, to: Room, map: PointMap): GameState {
  const id = from.id;
  const delta = new Map<number, Point>();
  for (const i of state.items) {
    if (i.roomId !== id || i.onItemUid !== null) continue;
    const t = getFurnitureType(i.typeId);
    const fp = footprintRect(i, t);
    const p = t.wall ? { x: i.x, y: i.y - 1 } : { x: fp.x + fp.w / 2, y: fp.y + fp.h / 2 };
    const q = map(p);
    delta.set(i.uid, { x: q.x - p.x, y: q.y - p.y });
  }
  let items = state.items.map((i) => {
    if (i.roomId !== id) return i;
    const d = delta.get(i.onItemUid ?? i.uid);
    return d ? { ...i, x: i.x + d.x, y: i.y + d.y } : i;
  });
  const cellKeyMap = (k: string): string => {
    const [c, r] = k.split(',').map(Number) as [number, number];
    const q = map({ x: c * BUILD_CELL + BUILD_CELL / 2, y: r * BUILD_CELL + BUILD_CELL / 2 });
    return `${Math.floor(q.x / BUILD_CELL)},${Math.floor(q.y / BUILD_CELL)}`;
  };
  const remap = <T>(m: Record<string, T> | undefined): Record<string, T> => {
    const out: Record<string, T> = {};
    for (const [k, v] of Object.entries(m ?? {})) out[cellKeyMap(k)] = v;
    return out;
  };
  const room: Room = { ...to, blocks: remap(from.blocks), plants: remap(from.plants), ...(from.floorCells ? { floorCells: remap(from.floorCells) } : {}) };
  // Fit check, in uid order (the older piece keeps its spot).
  for (const it of items.filter((i) => i.roomId === id && i.onItemUid === null).sort((a, b) => a.uid - b.uid)) {
    const t = getFurnitureType(it.typeId);
    const rest = items.filter((o) => o.uid !== it.uid && o.onItemUid !== it.uid);
    if (t.wall ? canPlace(room, rest, t, it.x, it.y, it.facing) : standsWell(room, items, it)) continue;
    const pose = t.wall
      ? (() => {
          const p = snapToWallSpot(room, t, it.x, it.y);
          return canPlace(room, rest, t, p.x, p.y, it.facing) ? { ...p, facing: it.facing } : null;
        })()
      : nearestValidPlacement(room, rest, t, it.facing, { x: it.x, y: it.y });
    if (!pose) {
      items = pickUpItem(items, it.uid);
      continue;
    }
    const dx = pose.x - it.x;
    const dy = pose.y - it.y;
    const riders = new Set(ridersOf(items, it.uid).map((r) => r.uid));
    items = items.map((i) => (i.uid === it.uid ? { ...i, x: pose.x, y: pose.y, facing: pose.facing } : riders.has(i.uid) ? { ...i, x: i.x + dx, y: i.y + dy } : i));
  }
  let next: GameState = { ...state, items, rooms: state.rooms.map((r) => (r.id === id ? room : r)) };
  if (state.tavern.roomId === id) {
    const t = state.tavern;
    const guests = t.guests.map((g) => ({ ...g, ...map({ x: g.x, y: g.y }), path: g.path.map((p) => map(p)), ...(g.barSpot ? { barSpot: { ...g.barSpot, ...cellOf(map, g.barSpot) } } : {}) }));
    const mess = t.mess.map((m) => ({ ...m, ...map({ x: m.x, y: m.y }), ...(m.seatIndex >= 1000 ? { seatIndex: spotIndexMap(map, m.seatIndex) } : {}) }));
    next = { ...next, tavern: { ...t, guests, mess } };
  }
  return next;
}

function cellOf(map: PointMap, k: { c: number; r: number }): { c: number; r: number } {
  const q = map({ x: k.c * BUILD_CELL + BUILD_CELL / 2, y: k.r * BUILD_CELL + BUILD_CELL / 2 });
  return { c: Math.floor(q.x / BUILD_CELL), r: Math.floor(q.y / BUILD_CELL) };
}

/** A bar-spot mess index (barSpots.barSpotIndex = 1000 + r * 1000 + c) after the map. */
function spotIndexMap(map: PointMap, idx: number): number {
  const k = cellOf(map, { c: (idx - 1000) % 1000, r: Math.floor((idx - 1000) / 1000) });
  return 1000 + k.r * 1000 + k.c;
}

/** Crops, casks and mugs of machines and tap stands that went to the bag come back (the rules of picking them up). */
function settle(state: GameState, at: number): GameState {
  return returnOrphanTaps(returnOrphanCasks(returnOrphanCooks(returnOrphanBrews(state, at), at), at), at);
}

/** The point map of an upgrade of an annex-above tavern from `from` to `to` (the identity when nothing moves). */
export function annexUpgradeMap(from: Room, to: Room): PointMap | null {
  const a = roomAnnex(from);
  const b = roomAnnex(to);
  const dy = mainShiftOf(to) - mainShiftOf(from);
  if (dy === 0 && (!a || !b || (a.x === b.x && a.y + a.h === b.y + b.h))) return null;
  return annexMap(a, b, dy);
}

/** Migration 41 -> 42: every tavern without annexAbove gets its kitchen on top (see the file head). */
export function moveKitchenAbove(state: GameState): GameState {
  let next = state;
  for (const old of state.rooms.filter((r) => r.kind === 'shop' && r.annexAbove !== true)) {
    const above = roomAtLevel({ ...old, annexAbove: true }, old.level);
    next = remapRoomContents(next, old, above, annexMap(roomAnnex(old), roomAnnex(above), mainShiftOf(above)));
    next = clearDoorSpots(next, old.id, next.tavern.updatedAt).state;
  }
  return next === state ? state : settle(next, next.tavern.updatedAt);
}
