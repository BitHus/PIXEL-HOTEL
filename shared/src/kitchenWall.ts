// THE KITCHEN ANNEX (owner 18 Nov, replaces the walled ring): a small rectangle of floor ATTACHED to the tavern's bottom edge (data
// shared/data/roomShapes.json "kitchen", added to the floor by room.ts; same room id and map, no room switch). Its top row is the PARTITION wall
// between the tavern and the kitchen, with ONE 2-cell doorway (art sprites/doors/door_kitchen.png); the rest is the INSIDE (stove, barrel, prep tables,
// pantry, sink, hatch), stone-tile floor. Staff only: guests never enter (npcNav.guestZones). The partition blocks walking and placing like a fixed
// thing (farmLayout.fixedBlockers / noPlaceRects). The annex grows with the room level and moves down with the main floor (annexShift, upgradeRoom). Pure.

import { BUILD_CELL, type RoomLevel } from './config.ts';
import { annexRectOf, roomAnnex, type Room } from './room.ts';
import type { Point, Rect } from './types.ts';

/** How many cells wide the doorway in the partition is. */
export const KITCHEN_DOOR_CELLS = 2;

export interface KitchenWall {
  /** The whole annex (partition row + inside) in world px. */
  annex: Rect;
  /** The inside of the kitchen in world px (staff only). */
  inside: Rect;
  /** The partition wall cells (one cell each), without the doorway. */
  walls: Rect[];
  /** The doorway: KITCHEN_DOOR_CELLS cells in the partition row, the only way in. */
  door: Rect;
  /** The cells of the tavern floor just outside the doorway: kept free of furniture so the doorway stays usable. */
  doorOut: Rect;
}

/** The kitchen annex geometry of a tavern, or null (not a tavern, or a shape without an annex). */
export function kitchenWall(room: Room | undefined): KitchenWall | null {
  const a = roomAnnex(room);
  if (!a) return null;
  return annexGeometry(a);
}

function annexGeometry(a: Rect): KitchenWall {
  const cols = a.w / BUILD_CELL;
  const doorCol = Math.floor((cols - KITCHEN_DOOR_CELLS) / 2);
  const door: Rect = { x: a.x + doorCol * BUILD_CELL, y: a.y, w: KITCHEN_DOOR_CELLS * BUILD_CELL, h: BUILD_CELL };
  const walls: Rect[] = [];
  for (let c = 0; c < cols; c++) {
    if (c >= doorCol && c < doorCol + KITCHEN_DOOR_CELLS) continue;
    walls.push({ x: a.x + c * BUILD_CELL, y: a.y, w: BUILD_CELL, h: BUILD_CELL });
  }
  return {
    annex: a,
    inside: { x: a.x, y: a.y + BUILD_CELL, w: a.w, h: a.h - BUILD_CELL },
    walls,
    door,
    doorOut: { x: door.x, y: a.y - BUILD_CELL, w: door.w, h: BUILD_CELL },
  };
}

/** The wall cells as blockers (empty when there is no kitchen). */
export function kitchenWallRects(room: Room): Rect[] {
  return kitchenWall(room)?.walls ?? [];
}

/** Where nothing may be placed: the partition, the doorway and the floor right outside it (empty without a kitchen). */
export function kitchenNoPlace(room: Room): Rect[] {
  const k = kitchenWall(room);
  return k ? [...k.walls, k.door, k.doorOut] : [];
}

/**
 * How far the annex moves when the room grows from `from` to `to` (the main floor grows right and down, the annex hangs under it): px offset, or null
 * when the shape has no annex. Whatever stands in the old annex moves by this much (economy.upgradeRoom).
 */
export function annexShift(shape: string, from: RoomLevel, to: RoomLevel): Point | null {
  const a = annexRectOf(shape, from);
  const b = annexRectOf(shape, to);
  return a && b ? { x: b.x - a.x, y: b.y - a.y } : null;
}
