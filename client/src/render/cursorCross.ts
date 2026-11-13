// A small cross in screen space that marks a world position (debug, step 2).
// Lines are filled 1 px rectangles, so they stay sharp.

import { Graphics } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';

const ARM = 6;

export function createCursorCross(): Graphics {
  const g = new Graphics();
  // Dark outline, then the light cross on top. The center pixel is at (0, 0).
  g.rect(-ARM - 1, -1, ARM * 2 + 3, 3).fill(PALETTE[25]);
  g.rect(-1, -ARM - 1, 3, ARM * 2 + 3).fill(PALETTE[25]);
  g.rect(-ARM, 0, ARM * 2 + 1, 1).fill(PALETTE[19]);
  g.rect(0, -ARM, 1, ARM * 2 + 1).fill(PALETTE[19]);
  g.visible = false;
  return g;
}
