// Fixed things in a room (brief section 10b, 10d): the farm has none since step K1 (the cooking pot is gone:
// you cook on a stove in the tavern; the plots went in BG6), the lakeside has its water and trees. Plain geometry
// used by the placement rules and the navigation grid. Pure.

import type { Rect } from './types.ts';
import { lakeFixedBlockers } from './lakeLayout.ts';
import type { Room } from './room.ts';
import { kitchenNoPlace, kitchenWall } from './kitchenWall.ts';

/** Fixed things in a room that block walking (the lakeside's water and trees), besides the furniture. */
export function fixedBlockers(room: Room): Rect[] {
  // The partition wall of the tavern's kitchen annex (owner 18 Nov) blocks walking like a fixed thing (the doorway stays open).
  return room.kind === 'lakeside' ? lakeFixedBlockers(room) : (kitchenWall(room)?.walls ?? []);
}

/** Where no furniture may stand (any part of it). Nothing is fixed any more: the farm's pot is gone (step K1). */
export function noPlaceRects(room: Room): Rect[] {
  return kitchenNoPlace(room);
}
