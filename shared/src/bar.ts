// The bar (the counter, step 9t): where the start coins fly out of in the new-game intro. Pure.
// Since step T1 the till is the REGISTER item standing on the bar; the counter's art has no till of its own.

import { getFurnitureType } from './furniture.ts';
import type { FurnitureItem, Point } from './types.ts';

/** The bar top above its anchor for art without boxes (the counter sprite), px. */
const BAR_SPRITE_SURFACE_PX = 32;
/** How far above the register's anchor the coins start (about the middle of its body), px. */
const REGISTER_COIN_LIFT_PX = 12;

/** The height of the bar's top surface above its anchor, px (the lift of what stands on it). */
export function barSurfaceHeight(bar: FurnitureItem): number {
  const art = getFurnitureType(bar.typeId).art;
  // Art that is only a sprite has no boxes: the counter sprite's top sits 32 px above the anchor.
  return 'boxes' in art ? Math.max(0, ...art.boxes.map((b) => b.z + b.h)) : BAR_SPRITE_SURFACE_PX;
}

/**
 * Where the intro's coins start, world px: on the register standing on the bar. `items` are the room's items; with no register on the
 * bar (a bar it was picked up from, an old save whose register went to the bag) the middle of the bar's top is used. Null without a bar.
 */
export function barCoinPoint(bar: FurnitureItem | undefined, items: readonly FurnitureItem[] = []): Point | null {
  if (!bar) return null;
  const lift = barSurfaceHeight(bar);
  const register = items.find((i) => i.typeId === 'register' && i.onItemUid === bar.uid && i.roomId === bar.roomId);
  if (register) return { x: register.x, y: register.y - lift - REGISTER_COIN_LIFT_PX };
  return { x: bar.x, y: bar.y - lift };
}
