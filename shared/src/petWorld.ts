// The cat in a room (CAT HOOK wiring): where it lives, where it may stand, and what a tap hits. Pure; the client feeds items, grid and clock.
// The cat lives in a room that holds a placed pet basket (the pet basket is a hotel piece) once the player adopted it (Player.pet).

import { cellAt, isCellFree, type NavGrid } from './nav.ts';
import type { PetWorld } from './pet.ts';
import type { FurnitureItem, Point } from './types.ts';

/** Feet of a cat curled in the basket: a little above the basket's anchor. */
export const PET_BASKET_REST_DY = -10;
/** Half the width and the height of the tap target around the cat (world px). */
export const PET_HIT_HALF_W = 14;
export const PET_HIT_H = 28;

/** The pet basket of this room (the first by uid), as a rest point; null when there is none. */
export function petBasketPoint(items: readonly FurnitureItem[], roomId: number): Point | null {
  const b = items.filter((i) => i.typeId === 'pet_basket' && i.roomId === roomId).sort((a, c) => a.uid - c.uid)[0];
  return b ? { x: b.x, y: b.y + PET_BASKET_REST_DY } : null;
}

/** True when the cat should be in this room: adopted and a basket stands here. */
export function petLivesHere(adopted: boolean, items: readonly FurnitureItem[], roomId: number): boolean {
  return adopted && petBasketPoint(items, roomId) !== null;
}

/** The brain's world: free = a free nav cell (the basket does not block, so the cat can curl up in it). */
export function petWorldOf(grid: NavGrid, player: Point, basket: Point | null): PetWorld {
  return {
    player,
    basket,
    free: (p) => {
      const { c, r } = cellAt(grid, p);
      return isCellFree(grid, c, r);
    },
  };
}

/** Did a tap at world point `p` hit the cat standing at (x, y)? */
export function petHit(brain: { x: number; y: number }, p: Point): boolean {
  return Math.abs(p.x - brain.x) <= PET_HIT_HALF_W && p.y >= brain.y - PET_HIT_H && p.y <= brain.y + 4;
}
