// Goods on a table, shelf or case (step 7): each filled slot shows its item small on top of the
// furniture, spread evenly along the top. Placeholder art: a material is a small box in its
// colour, a furniture item a tiny version of its boxes.

import { Graphics } from 'pixi.js';
import { PALETTE, footprintSize, getFurnitureType, getMaterialType, type Facing, type FurnitureType, type LootRef } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';
import { furnitureRects, surfaceHeight, type ArtRect } from './furnitureArt.ts';
import { fitRects } from '../ui/itemIcon.ts';

/** Goods are drawn in a square this many px wide. */
const GOOD_PX = 12;

function goodRects(loot: LootRef): ArtRect[] {
  if (loot.kind === 'material') {
    const c = PALETTE[getMaterialType(loot.id).color] ?? PALETTE[0];
    return [
      [-1, -1, 10, 9, DARK_WARM],
      [0, 0, 8, 3, c],
      [0, 3, 8, 4, shade(c, 0.72)],
    ];
  }
  return fitRects(furnitureRects(getFurnitureType(loot.typeId), 'down'), GOOD_PX);
}

/** Where slot i of n sits on top of the item, relative to its anchor (bottom middle of the good). */
export function goodSpot(type: FurnitureType, facing: Facing, i: number, n: number): { x: number; y: number } {
  const { w, d } = footprintSize(type, facing);
  const top = surfaceHeight(type);
  return { x: Math.round(-w / 2 + ((i + 0.5) * w) / n), y: Math.round(-top - d / 2 + 3) };
}

/** The goods for the item's slots (null = empty slot), relative to its anchor. */
export function drawGoods(type: FurnitureType, facing: Facing, slots: readonly (LootRef | null)[]): Graphics {
  const g = new Graphics();
  slots.forEach((loot, i) => {
    if (!loot) return;
    const rects = goodRects(loot);
    const minX = Math.min(...rects.map((r) => r[0]));
    const maxX = Math.max(...rects.map((r) => r[0] + r[2]));
    const maxY = Math.max(...rects.map((r) => r[1] + r[3]));
    const at = goodSpot(type, facing, i, slots.length);
    const ox = at.x - Math.round((minX + maxX) / 2);
    const oy = at.y - maxY;
    for (const [x, y, w, h, c] of rects) g.rect(x + ox, y + oy, w, h).fill(c);
  });
  return g;
}
