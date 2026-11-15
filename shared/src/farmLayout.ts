// The farm's fixed place (brief section 10b): only the cooking pot is fixed now (step BG6 made the plots
// free-form soil cells, see farm.ts). Plain geometry from config, used by the placement rules (nothing
// is placed on the pot) and the navigation grid (the pot blocks walking). Pure.

import { COOKING_POT } from './config.ts';
import type { Rect } from './types.ts';
import { lakeFixedBlockers } from './lakeLayout.ts';
import type { Room } from './room.ts';

/** The cooking pot's footprint. */
export function potRect(): Rect {
  return { x: COOKING_POT.x - COOKING_POT.w / 2, y: COOKING_POT.y - COOKING_POT.d, w: COOKING_POT.w, h: COOKING_POT.d };
}

/** Fixed things in a room that block walking (the farm's pot, the lakeside's water and trees), besides the furniture. */
export function fixedBlockers(room: Room): Rect[] {
  return room.kind === 'farm' ? [potRect()] : lakeFixedBlockers(room);
}

/** Where no furniture may stand (any part of it): the farm's pot. */
export function noPlaceRects(room: Room): Rect[] {
  return room.kind === 'farm' ? [potRect()] : [];
}
