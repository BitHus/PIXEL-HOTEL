// The cobweb hangs in the corner the layout put it in (placement.ts cobwebCorner: wall north + wall west or east).
// propArt cobweb variant 0 = west corner (fan opens to the east), variant 1 = east corner (fan opens to the west).

import { cobwebCorner, floorFn, type DungeonMap } from '@pixel-hotel/shared';

/** Pure: the variant for a corner ('w' -> 0, 'e' -> 1); no corner (old runs) keeps the hash variant's parity. */
export function cobwebVariant(corner: 'w' | 'e' | null, fallbackHash: number): number {
  if (corner === 'w') return 0;
  if (corner === 'e') return 1;
  return fallbackHash & 1;
}

/** The variant for the cobweb at block (c, r) of this map. */
export function cobwebVariantAt(map: DungeonMap, c: number, r: number, fallbackHash: number): number {
  return cobwebVariant(cobwebCorner(floorFn(map), { c, r }), fallbackHash);
}
