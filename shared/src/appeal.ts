// The tavern's appeal (brief section 9): it sets how fast guests come (tavern.ts guestIntervalMs).
// Pure.

import { APPEAL_MAX_PER_TYPE, SHOP_APPEAL_MAX } from './config.ts';
import { getFurnitureType } from './furniture.ts';
import { dominantFloorStyle, type Room } from './room.ts';
import { styleAppeal } from './styles.ts';
import type { FurnitureItem } from './types.ts';

/**
 * tavernAppeal = min(100, sum of the appeal of the placed items (decor too; each type counted at
 * most 3 times) + the appeal of the floor and wall styles).
 */
export function tavernAppeal(room: Room, items: readonly FurnitureItem[]): number {
  const counted = new Map<string, number>();
  let sum = 0;
  for (const i of items) {
    if (i.roomId !== room.id) continue;
    const n = counted.get(i.typeId) ?? 0;
    if (n >= APPEAL_MAX_PER_TYPE) continue;
    counted.set(i.typeId, n + 1);
    sum += getFurnitureType(i.typeId).appeal;
  }
  sum += styleAppeal('floor', dominantFloorStyle(room)) + styleAppeal('wall', room.wallStyle);
  return Math.min(SHOP_APPEAL_MAX, sum);
}
