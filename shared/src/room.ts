// Room geometry (brief section 5). Pure functions on plain data.
//
// World coordinates: the floor runs from (0, 0) to (w, h). The back wall band sits above it
// (y from -WALL_BAND to 0). Thin borders run down the left and right sides (from the top of the
// wall band to the bottom border) and along the bottom. The door is a gap in the bottom border.

import {
  DOOR_WIDTH,
  DOOR_ZONE_H,
  DOOR_ZONE_W,
  ROOM_SIZES,
  SIDE_BORDER,
  START_FLOOR_STYLE,
  START_WALL_STYLE,
  WALL_BAND,
  type RoomLevel,
} from './config.ts';
import type { Rect } from './types.ts';

export type RoomKind = 'hotel' | 'shop';

export interface Room {
  /** Room ids are integers. */
  id: number;
  kind: RoomKind;
  level: RoomLevel;
  /** Floor size in px. */
  w: number;
  h: number;
  floorStyle: string;
  wallStyle: string;
  ownerId: number;
  /** Owners can set a room to private (section 13). */
  private: boolean;
}

/** A new room of the given kind and level, with the bare styles. */
export function createRoom(id: number, kind: RoomKind, level: RoomLevel, ownerId: number): Room {
  const size = ROOM_SIZES[kind][level];
  return {
    id,
    kind,
    level,
    w: size.w,
    h: size.h,
    floorStyle: START_FLOOR_STYLE,
    wallStyle: START_WALL_STYLE,
    ownerId,
    private: false,
  };
}

/** The walkable floor. */
export function floorRect(room: Room): Rect {
  return { x: 0, y: 0, w: room.w, h: room.h };
}

/** The back wall band along the top, above the floor. */
export function wallBandRect(room: Room): Rect {
  return { x: 0, y: -WALL_BAND, w: room.w, h: WALL_BAND };
}

/** Left side border, from the top of the wall band to the bottom of the bottom border. */
export function leftBorderRect(room: Room): Rect {
  return { x: -SIDE_BORDER, y: -WALL_BAND, w: SIDE_BORDER, h: WALL_BAND + room.h + SIDE_BORDER };
}

/** Right side border. */
export function rightBorderRect(room: Room): Rect {
  return { x: room.w, y: -WALL_BAND, w: SIDE_BORDER, h: WALL_BAND + room.h + SIDE_BORDER };
}

/** The door opening: a gap in the bottom border, centered. */
export function doorRect(room: Room): Rect {
  return { x: room.w / 2 - DOOR_WIDTH / 2, y: room.h, w: DOOR_WIDTH, h: SIDE_BORDER };
}

/** The bottom border pieces left and right of the door. */
export function bottomBorderRects(room: Room): [Rect, Rect] {
  const door = doorRect(room);
  return [
    { x: 0, y: room.h, w: door.x, h: SIDE_BORDER },
    { x: door.x + door.w, y: room.h, w: room.w - (door.x + door.w), h: SIDE_BORDER },
  ];
}

/** The door zone: on the floor just inside the door. Nothing can be placed here. */
export function doorZoneRect(room: Room): Rect {
  return { x: room.w / 2 - DOOR_ZONE_W / 2, y: room.h - DOOR_ZONE_H, w: DOOR_ZONE_W, h: DOOR_ZONE_H };
}

/** Everything that is drawn for the room: floor, wall band and borders. */
export function roomBoundsRect(room: Room): Rect {
  return {
    x: -SIDE_BORDER,
    y: -WALL_BAND,
    w: room.w + 2 * SIDE_BORDER,
    h: WALL_BAND + room.h + SIDE_BORDER,
  };
}

/** True if rect a lies fully inside rect b (touching the edges counts as inside). */
export function rectInside(a: Rect, b: Rect): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

/** True if the rectangle lies fully inside the floor. */
export function rectInsideFloor(room: Room, rect: Rect): boolean {
  return rectInside(rect, floorRect(room));
}

/** True if two rectangles overlap or share an edge. */
export function rectsTouch(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}
