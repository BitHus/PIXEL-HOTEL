// The catches of the lakeside (brief section 10d, step 9f): fish and the things fished up, data in
// shared/data/fish.json. Data only (the rolling is in fishing.ts), so materials.ts can build the
// stackable goods from it. Fish are shop goods of the category 'food'; fished-up things are
// materials. Both stack in Player.materials and are in the Book's Fish tab.

import type { Icon } from './icons.ts';
import fishData from '../data/fish.json';
import type { FishId, Rank, ThingId } from './types.ts';

export interface CatchType {
  id: FishId | ThingId;
  name: string;
  kind: 'fish' | 'thing';
  rank: Rank;
  baseValue: number;
  /** Placeholder icon colour (palette index). */
  color: number;
  icon: Icon;
  /** Fish only: the size range of a catch in cm. */
  minCm?: number;
  maxCm?: number;
  /** The weight among the catches of the same rank (fish 3, things 1). */
  weight: number;
}

export const CATCH_TYPES = fishData as CatchType[];
export const FISH_TYPES = CATCH_TYPES.filter((c) => c.kind === 'fish');
export const THING_TYPES = CATCH_TYPES.filter((c) => c.kind === 'thing');

export function getCatchType(id: string): CatchType {
  const c = CATCH_TYPES.find((x) => x.id === id);
  if (!c) throw new Error(`unknown catch ${id}`);
  return c;
}

export function isCatchId(id: string): boolean {
  return CATCH_TYPES.some((x) => x.id === id);
}
