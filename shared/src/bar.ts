// The bar (the counter, step 9t): where the start coins fly out of in the new-game intro. Pure.

import { getFurnitureType } from './furniture.ts';
import type { FurnitureItem, Point } from './types.ts';

/** How high an item's top stands above the floor (its tallest box), px. */
function topOf(typeId: string): number {
  const art = getFurnitureType(typeId).art;
  return Math.max(0, ...('boxes' in art ? art.boxes : []).map((b) => b.z + b.h));
}

/** The register on top of the bar (step T1): the point coins fly into, world px (the top of the till); null without a register in this room. */
export function registerPoint(items: readonly FurnitureItem[], roomId: number): Point | null {
  const reg = items.find((i) => i.roomId === roomId && getFurnitureType(i.typeId).till === true);
  if (!reg) return null;
  const bar = items.find((i) => i.uid === reg.onItemUid);
  // The till stands on the bar's top: half a cell into the footprint, up the bar's height and a bit of the till.
  return { x: reg.x, y: reg.y - 16 - (bar ? topOf(bar.typeId) : 0) - topOf(reg.typeId) / 2 };
}

/** The till box on top of the bar (where the intro's coins start), world px; null when there is no bar. */
export function barCoinPoint(bar: FurnitureItem | undefined): Point | null {
  if (!bar) return null;
  const t = getFurnitureType(bar.typeId);
  // The register stands left of the middle (step T1: TAVERN_START_RIDERS), turned with the bar.
  // A one-cell bar piece (MODULAR BAR) carries the register itself: no side step.
  const side = t.w <= 32 ? 0 : bar.facing === 'down' ? -32 : bar.facing === 'up' ? 32 : 0;
  return { x: bar.x + side, y: bar.y - 16 - topOf(t.id) - 12 };
}
