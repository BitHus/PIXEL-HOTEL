// One item drawn small (the order in the avatar's hands, step 9t). Since step BG2 it is the item's
// square icon (render/drawIcon.ts) sampled down to GOOD_PX, bottom middle at its spot. (The goods on
// stall slots went in step S1.)

import { Container, Sprite } from 'pixi.js';
import type { LootRef } from '@pixel-hotel/shared';
import { iconTexture, lootIcon } from './drawIcon.ts';

/** Goods are drawn in a square this many px wide. */
const GOOD_PX = 12;

/** One good as a sprite with its bottom middle at (0, 0). */
function goodSprite(loot: LootRef): Sprite {
  const s = new Sprite(iconTexture(lootIcon(loot), undefined, GOOD_PX));
  s.position.set(-GOOD_PX / 2, -GOOD_PX);
  return s;
}

/** One good on its own (the order in the hands), bottom middle at (0, 0). */
export function drawGood(loot: LootRef): Container {
  const g = new Container();
  g.addChild(goodSprite(loot));
  return g;
}
