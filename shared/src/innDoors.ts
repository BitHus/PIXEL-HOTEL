// Inn doors (step MB-2, INN-PLAN M-B): one connected Inn. Walking order suite (hotel) - tavern (shop) - garden (farm), and (CEL-2) the tavern's
// back wall also leads to the attached kitchen and, once built, the cellar; the lakeside, the mine
// and the dungeon stay on the Map. Pure rules on plain data.
//
// A door is a 2-cell wide doorway in the BACK WALL BAND; its SPOT is the 2 x 1 floor cells right in front of it (shared/data/innDoors.json:
// per room kind, shape and level: { id, col, row, w } with the spot's top-left cell). Floor furniture, blocks and plants never stand on a spot,
// wall items never hang over the doorway, guests never walk through it (npcNav) and it never touches the main door zone, the kitchen zone, the
// bar's staff spot or the start items (tests). The spot itself is walkable: walking onto it is how you change rooms.

import innDoorData from '../data/innDoors.json';
import { BUILD_CELL, WALL_BAND } from './config.ts';
import type { GameState } from './gameState.ts';
import type { Room } from './room.ts';
import type { Facing, Point, Rect } from './types.ts';

export type InnDoorId =
  | 'suite_to_tavern'
  | 'tavern_to_suite'
  | 'tavern_to_garden'
  | 'garden_to_tavern'
  | 'tavern_to_kitchen'
  | 'kitchen_to_tavern'
  | 'tavern_to_cellar'
  | 'cellar_to_tavern';

/** One door as stored: the spot's top-left cell and its width in cells. */
export interface InnDoorData {
  id: InnDoorId;
  col: number;
  row: number;
  w: number;
}

/** A door of a room in world px. */
export interface InnDoorSpot extends InnDoorData {
  /** The 2 x 1 floor cells in front of the doorway (walkable, nothing may stand there). */
  spot: Rect;
  /** The doorway in the back wall band (wall items may not overlap it). */
  doorway: Rect;
}

interface InnDoorFile {
  /** Where each door leads: the room kind and the id of the matching door there. */
  links: Record<InnDoorId, { room: 'hotel' | 'shop' | 'farm' | 'kitchen' | 'cellar'; arrive: InnDoorId }>;
  /** kind -> shape -> doors per level (index 0 = level 1). */
  rooms: Record<string, Record<string, InnDoorData[][]>>;
}

const FILE = innDoorData as unknown as InnDoorFile;

/** Why a door cannot be used now (the client shows a text). */
export type InnTravelProblem = 'no_door' | 'in_run' | 'no_room';

/** The doors of a room (hotel, shop, farm; the lakeside has none). */
export function innDoorSpots(room: Pick<Room, 'kind' | 'shape' | 'level'>): InnDoorSpot[] {
  const shape = FILE.rooms[room.kind]?.[room.shape];
  const list = shape?.[room.level - 1] ?? [];
  return list.map((d) => ({
    ...d,
    spot: { x: d.col * BUILD_CELL, y: d.row * BUILD_CELL, w: d.w * BUILD_CELL, h: BUILD_CELL },
    doorway: { x: d.col * BUILD_CELL, y: d.row * BUILD_CELL - WALL_BAND, w: d.w * BUILD_CELL, h: WALL_BAND },
  }));
}

/** The spot rectangles of a room: where nothing may be placed. */
export function innDoorSpotRects(room: Pick<Room, 'kind' | 'shape' | 'level'>): Rect[] {
  return innDoorSpots(room).map((d) => d.spot);
}

/** The doorways in the wall band: where no wall item may hang. */
export function innDoorwayRects(room: Pick<Room, 'kind' | 'shape' | 'level'>): Rect[] {
  return innDoorSpots(room).map((d) => d.doorway);
}

/** The door whose spot contains this cell, or null. */
export function doorAt(room: Pick<Room, 'kind' | 'shape' | 'level'>, cell: { c: number; r: number }): InnDoorSpot | null {
  return innDoorSpots(room).find((d) => cell.r === d.row && cell.c >= d.col && cell.c < d.col + d.w) ?? null;
}

/** The point where a door leads to: the matching door's spot (its first cell, centred), facing down (the avatar then steps one cell down). */
export interface InnArrival {
  roomId: number;
  cell: { c: number; r: number };
  /** The centre of the arrival cell in world px. */
  point: Point;
  /** The centre of the cell below it, where the avatar steps to. */
  stepTo: Point;
  facing: Facing;
}

/**
 * Where a door leads. Null while a dungeon or mine run is in progress, when the door is not in the room, or when the other room is missing.
 * Pure: it changes nothing (the avatar's own state stays with the caller).
 */
export function innTravel(state: Pick<GameState, 'run' | 'rooms' | 'player'>, fromRoomId: number, doorId: string): InnArrival | null {
  if (state.run !== null) return null;
  const from = state.rooms.find((r) => r.id === fromRoomId);
  if (!from) return null;
  const door = innDoorSpots(from).find((d) => d.id === doorId);
  const link = door ? FILE.links[door.id] : undefined;
  if (!door || !link) return null;
  const to = state.rooms.find((r) => r.kind === link.room && r.ownerId === state.player.id);
  if (!to) return null;
  const arrive = innDoorSpots(to).find((d) => d.id === link.arrive);
  if (!arrive) return null;
  const point = { x: arrive.spot.x + BUILD_CELL / 2, y: arrive.spot.y + BUILD_CELL / 2 };
  return {
    roomId: to.id,
    cell: { c: arrive.col, r: arrive.row },
    point,
    stepTo: { x: point.x, y: point.y + BUILD_CELL },
    facing: 'down',
  };
}

/** The reason text key for a refused door (the client picks the words). */
export function innTravelProblem(state: Pick<GameState, 'run' | 'rooms' | 'player'>, fromRoomId: number, doorId: string): InnTravelProblem | null {
  if (state.run !== null) return 'in_run';
  const from = state.rooms.find((r) => r.id === fromRoomId);
  if (!from || !innDoorSpots(from).some((d) => d.id === doorId)) return 'no_door';
  return innTravel(state, fromRoomId, doorId) ? null : 'no_room';
}

/** All door data (tests, tools). */
export function innDoorFile(): InnDoorFile {
  return FILE;
}
