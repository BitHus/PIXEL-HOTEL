// The farm's looks that are NOT rules (pure part): which grass look a cell gets and where the decor stands (bushes,
// flowers, stones, mushrooms, tufts, a few trees along the back hedge). Pure client decoration: a seeded hash of the
// room id, no state, no save, no nav; the view hides a spot whose cell the player uses (soil, block, plant).

import { BUILD_CELL, cellOnFloor, doorZoneRect, type Room } from '@pixel-hotel/shared';
import { hash01 } from '../render/atmosphere.ts';

export type FarmDecorKind = 'bush' | 'flower' | 'stone' | 'mushroom' | 'tuft' | 'tree';

export interface FarmDecorSpot {
  kind: FarmDecorKind;
  c: number;
  r: number;
  /** World px of the base (whole px, inside the cell). */
  x: number;
  y: number;
  /** Seed for the art variant (petal colour, tree kind, size). */
  variant: number;
}

/** One grass cell's look: which of `variants` tile textures, which quarter of that 64 px tile, and a tint step. */
export interface GrassRoll {
  variant: number;
  /** Quarter of the 64 px tile to show (0 = the cell's own quarter, else another one: breaks the repeat rhythm). */
  shift: 0 | 1 | 2 | 3;
  /** -1 slightly darker, 0 none, 1 slightly lighter. */
  tint: -1 | 0 | 1;
}

export const GRASS_VARIANT_MAX = 3;
/** Tint overlay strength (alpha), kept tiny so it reads as variation, not a checkerboard. */
export const GRASS_TINT_ALPHA = 0.035;
export const FARM_DECOR_EDGE_CHANCE = 0.2;
export const FARM_DECOR_INNER_CHANCE = 0.035;
export const FARM_TREE_CHANCE = 0.2;
export const FARM_TREE_MIN_GAP = 3;

/** A stable look per cell. `variants` = how many grass textures exist (1 to 3). */
export function grassRoll(roomId: number, c: number, r: number, variants: number): GrassRoll {
  const key = c * 1009 + r * 9176;
  const h = hash01(roomId + 17, key);
  const v = Math.min(variants, GRASS_VARIANT_MAX);
  const variant = Math.min(v - 1, Math.floor(hash01(roomId + 31, key) * v));
  const shift = (h < 0.5 ? 0 : Math.floor(((h - 0.5) / 0.5) * 3) + 1) as 0 | 1 | 2 | 3;
  const t = hash01(roomId + 53, key);
  const tint = t < 0.22 ? -1 : t > 0.78 ? 1 : 0;
  return { variant, shift, tint };
}

/** Where decor stands in this room (a function of room id, size and door only). */
export function farmDecorSpots(room: Room): FarmDecorSpot[] {
  const cols = Math.ceil(room.w / BUILD_CELL);
  const rows = Math.ceil(room.h / BUILD_CELL);
  const dz = doorZoneRect(room);
  const pad = BUILD_CELL;
  const out: FarmDecorSpot[] = [];
  let lastTree = -99;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!cellOnFloor(room, c, r)) continue;
      const x0 = c * BUILD_CELL;
      const y0 = r * BUILD_CELL;
      // Keep the door and the way in clear (the door zone plus one cell around it).
      if (x0 + BUILD_CELL > dz.x - pad && x0 < dz.x + dz.w + pad && y0 + BUILD_CELL > dz.y - pad) continue;
      const key = c * 131 + r * 7919;
      const edge = c <= 1 || c >= cols - 2 || r === 0 || r >= rows - 2;
      const roll = hash01(room.id + 101, key);
      if (r === 0 && roll < FARM_TREE_CHANCE && c - lastTree >= FARM_TREE_MIN_GAP && c >= 1 && c <= cols - 2) {
        lastTree = c;
        out.push({ kind: 'tree', c, r, x: x0 + 16, y: y0 + 28, variant: Math.floor(hash01(room.id + 7, key) * 6) });
        continue;
      }
      if (roll >= (edge ? FARM_DECOR_EDGE_CHANCE : FARM_DECOR_INNER_CHANCE)) continue;
      const pick = hash01(room.id + 211, key);
      const kind: FarmDecorKind = pick < 0.3 ? 'tuft' : pick < 0.55 ? 'flower' : pick < 0.72 ? 'bush' : pick < 0.88 ? 'stone' : 'mushroom';
      const dx = 6 + Math.floor(hash01(room.id + 307, key) * 20);
      const dy = 14 + Math.floor(hash01(room.id + 401, key) * 14);
      out.push({ kind, c, r, x: x0 + dx, y: y0 + dy, variant: Math.floor(hash01(room.id + 503, key) * 4096) });
    }
  }
  return out;
}
