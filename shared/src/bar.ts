// The bar (the counter, step 9t): where the start coins fly out of in the new-game intro. Pure.

import { getFurnitureType } from './furniture.ts';
import type { FurnitureItem, Point } from './types.ts';

/** The till box on top of the bar (where the intro's coins start), world px; null when there is no bar. */
export function barCoinPoint(bar: FurnitureItem | undefined): Point | null {
  if (!bar) return null;
  const t = getFurnitureType(bar.typeId);
  // The till box sits right of the middle (furniture.json: dx 10..32 facing down), turned with the bar.
  const side = bar.facing === 'down' ? 21 : bar.facing === 'up' ? -21 : 0;
  return { x: bar.x + side, y: bar.y - t.height };
}
