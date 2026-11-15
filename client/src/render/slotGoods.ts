// Goods on a table, shelf or case (step 7): each filled slot shows its item small on top of the
// furniture, spread evenly along the top. Since step BG2 a good is the item's square icon
// (render/drawIcon.ts) sampled down to GOOD_PX, bottom middle at its spot.

import { Container, Sprite } from 'pixi.js';
import { footprintSize, type Facing, type FurnitureType, type LootRef } from '@pixel-hotel/shared';
import { iconTexture, lootIcon } from './drawIcon.ts';
import { surfaceHeight } from './furnitureArt.ts';

/** Goods are drawn in a square this many px wide. */
const GOOD_PX = 12;

/** One good as a sprite with its bottom middle at (0, 0). */
function goodSprite(loot: LootRef): Sprite {
  const s = new Sprite(iconTexture(lootIcon(loot), undefined, GOOD_PX));
  s.position.set(-GOOD_PX / 2, -GOOD_PX);
  return s;
}

/** Where slot i of n sits on top of the item, relative to its anchor (bottom middle of the good). */
export function goodSpot(type: FurnitureType, facing: Facing, i: number, n: number): { x: number; y: number } {
  const spot = facing === 'down' ? type.slotSpots?.[i] : undefined;
  if (spot) return { x: spot.dx, y: spot.dy };
  const { w, d } = footprintSize(type, facing);
  const top = surfaceHeight(type);
  return { x: Math.round(-w / 2 + ((i + 0.5) * w) / n), y: Math.round(-top - d / 2 + 3) };
}

/** The goods for the item's slots (null = empty slot), relative to its anchor. */
export function drawGoods(type: FurnitureType, facing: Facing, slots: readonly (LootRef | null)[]): Container {
  const g = new Container();
  slots.forEach((loot, i) => {
    if (!loot) return;
    const at = goodSpot(type, facing, i, slots.length);
    const s = goodSprite(loot);
    s.position.set(at.x - GOOD_PX / 2, at.y - GOOD_PX);
    g.addChild(s);
  });
  return g;
}

/** One good on its own (the item a customer carries or that hops), bottom middle at (0, 0). */
export function drawGood(loot: LootRef): Container {
  const g = new Container();
  g.addChild(goodSprite(loot));
  return g;
}
