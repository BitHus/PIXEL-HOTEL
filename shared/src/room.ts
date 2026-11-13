// Room geometry (brief section 5, room shapes in step 7b). Pure functions on plain data.
//
// A room's floor is a union of rectangles (16 px aligned), taken from its shape and level in
// shared/data/roomShapes.json. room.w and room.h are the size of the floor's bounding box, which
// starts at (0, 0). Every floor edge that faces up gets the 64 px back wall band above it; every
// other outside edge gets the thin 16 px border. The door is a 64 px gap in the border under a
// bottom edge, centered on the shape's door x; the door zone is the 64 x 48 px floor just inside it.

import roomShapeData from '../data/roomShapes.json';
import {
  DOOR_WIDTH,
  DOOR_ZONE_H,
  DOOR_ZONE_W,
  FARM_FLOOR_STYLE,
  FARM_WALL_STYLE,
  ROOM_GRID,
  SIDE_BORDER,
  START_FLOOR_STYLE,
  START_WALL_STYLE,
  WALL_BAND,
  type RoomLevel,
} from './config.ts';
import type { Point, Rect } from './types.ts';

/** The hotel room, the shop and (step 9b) the farm. */
export type RoomKind = 'hotel' | 'shop' | 'farm';

export interface Room {
  /** Room ids are integers. */
  id: number;
  kind: RoomKind;
  level: RoomLevel;
  /** The room shape id (roomShapes.json). */
  shape: string;
  /** Size of the floor's bounding box in px (the floor starts at 0, 0). */
  w: number;
  h: number;
  floorStyle: string;
  wallStyle: string;
  ownerId: number;
  /** Owners can set a room to private (section 13). */
  private: boolean;
}

export interface ShapeLevel {
  rects: Rect[];
  door: { x: number };
}

export interface RoomShape {
  id: string;
  name: string;
  kind: RoomKind | 'both';
  /** Levels 1, 2 and 3; each floor contains the one before. */
  levels: ShapeLevel[];
  /** Where a new shop's counter and stall_table stand (level 1), for shapes a shop can use. */
  shopStart?: Record<'counter' | 'stall_table', Point>;
}

export const ROOM_SHAPES = roomShapeData as RoomShape[];

export function getRoomShape(id: string): RoomShape {
  const s = ROOM_SHAPES.find((x) => x.id === id);
  if (!s) throw new Error(`unknown room shape ${id}`);
  return s;
}

/** The shapes a room of this kind can have. */
export function shapesFor(kind: RoomKind): RoomShape[] {
  return ROOM_SHAPES.filter((s) => s.kind === kind || s.kind === 'both');
}

/** The plain rectangle every room had before step 7b. */
export function defaultShape(kind: RoomKind): string {
  return kind === 'hotel' ? 'square' : kind === 'shop' ? 'square_shop' : 'farm';
}

function shapeLevel(shape: string, level: RoomLevel): ShapeLevel {
  const l = getRoomShape(shape).levels[level - 1];
  if (!l) throw new Error(`room shape ${shape} has no level ${level}`);
  return l;
}

/** The bounding box of rectangles. */
export function boundsOf(rects: readonly Rect[]): Rect {
  const x0 = Math.min(...rects.map((r) => r.x));
  const y0 = Math.min(...rects.map((r) => r.y));
  const x1 = Math.max(...rects.map((r) => r.x + r.w));
  const y1 = Math.max(...rects.map((r) => r.y + r.h));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** A new room of the given kind, level and shape, with the bare styles (the farm: grass and hedge). */
export function createRoom(id: number, kind: RoomKind, level: RoomLevel, ownerId: number, shape = defaultShape(kind)): Room {
  const b = boundsOf(shapeLevel(shape, level).rects);
  return {
    id,
    kind,
    level,
    shape,
    w: b.x + b.w,
    h: b.y + b.h,
    floorStyle: kind === 'farm' ? FARM_FLOOR_STYLE : START_FLOOR_STYLE,
    wallStyle: kind === 'farm' ? FARM_WALL_STYLE : START_WALL_STYLE,
    ownerId,
    private: false,
  };
}

/** The same room at another level of its shape (the size follows). */
export function roomAtLevel(room: Room, level: RoomLevel): Room {
  const b = boundsOf(shapeLevel(room.shape, level).rects);
  return { ...room, level, w: b.x + b.w, h: b.y + b.h };
}

/** The floor's rectangles. */
export function floorRects(room: Room): Rect[] {
  return shapeLevel(room.shape ?? defaultShape(room.kind), room.level).rects.map((r) => ({ ...r }));
}

/** The floor's bounding box. */
export function floorRect(room: Room): Rect {
  return { x: 0, y: 0, w: room.w, h: room.h };
}

/** The x of the middle of the door. */
export function doorX(room: Room): number {
  return shapeLevel(room.shape ?? defaultShape(room.kind), room.level).door.x;
}

/** True if the point lies on the floor (edges count). */
export function pointOnFloor(room: Room, p: Point): boolean {
  return floorRects(room).some((r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h);
}

/** The y of the floor's bottom edge under the door (the lowest floor y at the door's x). */
export function doorY(room: Room): number {
  const x = doorX(room);
  return Math.max(...floorRects(room).filter((r) => x >= r.x && x <= r.x + r.w).map((r) => r.y + r.h));
}

// ---------- The floor as cells (for the walls and borders) ----------

interface Cells {
  cols: number;
  rows: number;
  floor: boolean[];
}

function cells(room: Room): Cells {
  const g = ROOM_GRID;
  const cols = Math.ceil(room.w / g);
  const rows = Math.ceil(room.h / g);
  const floor: boolean[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) floor.push(rectInsideFloor(room, { x: c * g, y: r * g, w: g, h: g }));
  }
  return { cols, rows, floor };
}

const isFloor = (k: Cells, c: number, r: number): boolean => c >= 0 && r >= 0 && c < k.cols && r < k.rows && k.floor[r * k.cols + c] === true;

/** Joins 1-cell-high pieces in a row into runs: [start column, end column) per run. */
function runs(cols: number, on: (c: number) => boolean): [number, number][] {
  const out: [number, number][] = [];
  for (let c = 0; c < cols; c++) {
    if (!on(c)) continue;
    const start = c;
    while (c + 1 < cols && on(c + 1)) c++;
    out.push([start, c + 1]);
  }
  return out;
}

/** The back wall band pieces: WALL_BAND px tall, above every floor edge that faces up. */
export function wallBands(room: Room): Rect[] {
  const k = cells(room);
  const g = ROOM_GRID;
  const out: Rect[] = [];
  for (let r = 0; r < k.rows; r++) {
    for (const [a, b] of runs(k.cols, (c) => isFloor(k, c, r) && !isFloor(k, c, r - 1))) {
      out.push({ x: a * g, y: r * g - WALL_BAND, w: (b - a) * g, h: WALL_BAND });
    }
  }
  return out;
}

/** Kept for the old single-rectangle code: the first (top) wall band piece. */
export function wallBandRect(room: Room): Rect {
  return wallBands(room)[0] ?? { x: 0, y: -WALL_BAND, w: room.w, h: WALL_BAND };
}

/** The door opening: a gap in the border under the bottom edge at the door. */
export function doorRect(room: Room): Rect {
  return { x: doorX(room) - DOOR_WIDTH / 2, y: doorY(room), w: DOOR_WIDTH, h: SIDE_BORDER };
}

/**
 * The thin borders: a 16 px ring around the floor and the wall bands, except above the bands
 * and in the door opening. Inner corners join cleanly (the ring is built from 16 px cells).
 */
export function borderRects(room: Room): Rect[] {
  const g = ROOM_GRID;
  const k = cells(room);
  const bandRows = WALL_BAND / g;
  // Drawn cells (floor and bands) on a grid with a margin around the bounding box.
  const m = bandRows + 1;
  const cols = k.cols + 2 * m;
  const rows = k.rows + 2 * m;
  const drawn = new Array<boolean>(cols * rows).fill(false);
  const floorAt = (c: number, r: number): boolean => isFloor(k, c - m, r - m);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (floorAt(c, r)) drawn[r * cols + c] = true;
    }
  }
  for (const b of wallBands(room)) {
    for (let y = b.y; y < b.y + b.h; y += g) {
      for (let x = b.x; x < b.x + b.w; x += g) drawn[(y / g + m) * cols + (x / g + m)] = true;
    }
  }
  const on = (c: number, r: number): boolean => c >= 0 && r >= 0 && c < cols && r < rows && drawn[r * cols + c] === true;
  const door = doorRect(room);
  const inDoor = (c: number, r: number): boolean => {
    const x = (c - m) * g;
    const y = (r - m) * g;
    return y === door.y && x >= door.x && x + g <= door.x + door.w;
  };
  const ring = (c: number, r: number): boolean =>
    !on(c, r) && !inDoor(c, r) && (on(c - 1, r) || on(c + 1, r) || floorAt(c, r - 1) || floorAt(c - 1, r - 1) || floorAt(c + 1, r - 1));
  const out: Rect[] = [];
  for (let r = 0; r < rows; r++) {
    for (const [a, b] of runs(cols, (c) => ring(c, r))) out.push({ x: (a - m) * g, y: (r - m) * g, w: (b - a) * g, h: g });
  }
  return out;
}

/** The door zone: on the floor just inside the door. Nothing can be placed here. */
export function doorZoneRect(room: Room): Rect {
  return { x: doorX(room) - DOOR_ZONE_W / 2, y: doorY(room) - DOOR_ZONE_H, w: DOOR_ZONE_W, h: DOOR_ZONE_H };
}

/** Everything that is drawn for the room: floor, wall bands and borders. */
export function roomBoundsRect(room: Room): Rect {
  return boundsOf([floorRect(room), ...wallBands(room), ...borderRects(room)]);
}

/** True if rect a lies fully inside rect b (touching the edges counts as inside). */
export function rectInside(a: Rect, b: Rect): boolean {
  return a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
}

function overlapArea(a: Rect, b: Rect): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/**
 * True if the rectangle lies fully inside the floor (the union of its rectangles, which never
 * overlap each other: tested). An empty rectangle counts when its corner is on the floor.
 */
export function rectInsideFloor(room: Room, rect: Rect): boolean {
  const rects = floorRects(room);
  if (rect.w <= 0 || rect.h <= 0) return pointOnFloor(room, rect);
  if (rects.some((r) => rectInside(rect, r))) return true;
  const covered = rects.reduce((a, r) => a + overlapArea(rect, r), 0);
  return Math.abs(covered - rect.w * rect.h) < 1e-6;
}

/** True if two rectangles overlap or share an edge. */
export function rectsTouch(a: Rect, b: Rect): boolean {
  return a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h;
}

/** True if two rectangles overlap with some area (sharing only an edge does not count). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
