// The tavern kitchen zone (step T1). Pure.
//
// - THE ZONE: a cell rectangle per tavern shape and level (shared/data/roomShapes.json "kitchen"), staff only like the strip
//   behind the bar: guests never walk or sit there (npcNav.guestZones feeds npcGrid and the seats). The owner may put blocks and
//   furniture in it. Only a room of kind 'shop' has one.
// - PREP BONUS: a prep table (FurnitureType.preps) standing inside the zone and cell-adjacent (a shared edge) to a stove that
//   also stands inside the zone adds PREP_BONUS.perTable dishes to that stove's batch, at most PREP_BONUS.max. A stove outside the
//   zone works as before, without the bonus.

import { BUILD_CELL, PREP_BONUS } from './config.ts';
import { footprintRect, getFurnitureType } from './furniture.ts';
import { getRoomShape, type Room } from './room.ts';
import type { FurnitureItem, Rect } from './types.ts';

/** The kitchen zone of a tavern room in world px, or null (no tavern, or a shape without one). */
export function kitchenZone(room: Room | undefined): Rect | null {
  if (!room) return null;
  // CEL-2: in the attached kitchen room the whole room is the zone (the numbers of the prep bonus stay the same).
  if (room.kind === 'kitchen') return { x: 0, y: 0, w: room.w, h: room.h };
  if (room.kind !== 'shop') return null;
  const r = getRoomShape(room.shape).kitchen?.[room.level - 1];
  return r ? { x: r.x * BUILD_CELL, y: r.y * BUILD_CELL, w: r.w * BUILD_CELL, h: r.h * BUILD_CELL } : null;
}

/** True if a rect lies completely inside the zone. */
export function rectInZone(zone: Rect | null, r: Rect): boolean {
  return zone !== null && r.x >= zone.x && r.y >= zone.y && r.x + r.w <= zone.x + zone.w && r.y + r.h <= zone.y + zone.h;
}

/** True if two cell rectangles share an edge (not only a corner) and do not overlap. */
export function edgeAdjacent(a: Rect, b: Rect): boolean {
  const touchX = a.x + a.w === b.x || b.x + b.w === a.x;
  const touchY = a.y + a.h === b.y || b.y + b.h === a.y;
  const overlapX = a.x < b.x + b.w && b.x < a.x + a.w;
  const overlapY = a.y < b.y + b.h && b.y < a.y + a.h;
  return (touchX && overlapY) || (touchY && overlapX);
}

function floorOf(items: readonly FurnitureItem[], roomId: number): FurnitureItem[] {
  return items.filter((i) => i.roomId === roomId && i.onItemUid === null);
}

/** The prep tables that count for a stove: inside the zone, next to the stove, the stove inside the zone too. */
export function prepTablesFor(items: readonly FurnitureItem[], room: Room, stoveUid: number): FurnitureItem[] {
  const zone = kitchenZone(room);
  const stove = floorOf(items, room.id).find((i) => i.uid === stoveUid);
  if (!zone || !stove) return [];
  const sr = footprintRect(stove, getFurnitureType(stove.typeId));
  if (!rectInZone(zone, sr)) return [];
  return floorOf(items, room.id).filter((i) => {
    const t = getFurnitureType(i.typeId);
    if (!t.preps) return false;
    const r = footprintRect(i, t);
    return rectInZone(zone, r) && edgeAdjacent(r, sr);
  });
}

/** Extra dishes per batch on this stove: PREP_BONUS.perTable per counted prep table, at most PREP_BONUS.max. */
export function prepBonus(items: readonly FurnitureItem[], room: Room | undefined, stoveUid: number): number {
  if (!room) return 0;
  return Math.min(PREP_BONUS.max, prepTablesFor(items, room, stoveUid).length * PREP_BONUS.perTable);
}
