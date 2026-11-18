// Fixed things in a room (brief section 10b, 10d): the farm has none since step K1 (the cooking pot is gone:
// you cook on a stove in the tavern; the plots went in BG6), the lakeside has its water and trees; the tavern's kitchen annex is open floor (18 Nov). Plain geometry
// used by the placement rules and the navigation grid. Pure.

import type { Rect } from './types.ts';
import { lakeFixedBlockers } from './lakeLayout.ts';
import type { Room } from './room.ts';

/** Fixed things in a room that block walking (the lakeside's water and trees), besides the furniture. */
export function fixedBlockers(room: Room): Rect[] {
  return room.kind === 'lakeside' ? lakeFixedBlockers(room) : [];
}
