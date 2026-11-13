// The farm's placeholder art (step 9b), drawn in code from boxes like the furniture: tilled soil
// plots, the crop on top in its stage (sprout, half, ripe; the crop's colour from crops.json), the
// cooking pot and the bouncing ripe marker. Light from the top-left: top faces lighter, fronts darker.

import { Graphics } from 'pixi.js';
import { COOKING_POT, PALETTE, getCropType, type CropId, type CropStage, type Rect } from '@pixel-hotel/shared';
import { DARK_WARM } from '../render/bareStyles.ts';
import { shade } from '../render/colors.ts';

const SOIL = PALETTE[5];
const LEAF = PALETTE[12];

/** A box: a top face (w x d) above a front face (w x h), with the front's bottom edge at y. */
function box(g: Graphics, x: number, y: number, w: number, d: number, h: number, color: string): void {
  g.rect(x - 1, y - h - d - 1, w + 2, h + d + 2).fill(DARK_WARM);
  g.rect(x, y - h - d, w, d).fill(shade(color, 1.15));
  g.rect(x, y - h, w, h).fill(shade(color, 0.75));
}

/** One plot's tilled soil with furrows. */
export function drawPlot(g: Graphics, r: Rect): void {
  g.rect(r.x - 1, r.y - 1, r.w + 2, r.h + 2).fill(DARK_WARM);
  g.rect(r.x, r.y, r.w, r.h).fill(SOIL);
  for (let y = r.y + 4; y < r.y + r.h; y += 8) {
    g.rect(r.x + 2, y, r.w - 4, 2).fill(shade(SOIL, 0.7));
    g.rect(r.x + 2, y + 2, r.w - 4, 1).fill(shade(SOIL, 1.2));
  }
}

/** The crop on a plot in its stage: little sprouts, bigger leaves, then the ripe crop showing. */
export function drawCrop(g: Graphics, r: Rect, crop: CropId, stage: CropStage): void {
  const color = PALETTE[getCropType(crop).color] ?? PALETTE[0];
  const cx = r.x + r.w / 2;
  const spots = [
    { x: r.x + 9, y: r.y + 12 },
    { x: r.x + r.w - 9, y: r.y + 12 },
    { x: cx, y: r.y + r.h - 6 },
  ];
  if (stage === 'sprout') {
    for (const s of spots) {
      g.rect(s.x - 1, s.y - 4, 2, 4).fill(LEAF);
      g.rect(s.x - 3, s.y - 5, 2, 2).fill(shade(LEAF, 1.2));
      g.rect(s.x + 1, s.y - 5, 2, 2).fill(shade(LEAF, 1.2));
    }
    return;
  }
  if (stage === 'half') {
    for (const s of spots) {
      box(g, s.x - 4, s.y, 8, 4, 4, LEAF);
      g.rect(s.x - 1, s.y - 11, 2, 3).fill(shade(LEAF, 1.25));
    }
    return;
  }
  // Ripe: the crop itself, big and in its colour, with leaves on top.
  if (crop === 'pumpkin') {
    box(g, cx - 11, r.y + r.h - 4, 22, 10, 10, color);
    g.rect(cx - 1, r.y + r.h - 28, 3, 5).fill(PALETTE[14]);
    return;
  }
  for (const s of spots) {
    box(g, s.x - 5, s.y, 10, 5, 5, color);
    g.rect(s.x - 3, s.y - 14, 2, 4).fill(LEAF);
    g.rect(s.x + 1, s.y - 15, 2, 5).fill(shade(LEAF, 1.2));
  }
}

/** The cooking pot at its fixed spot: a dark iron pot on three stones, with a little steam. */
export function drawPot(): Graphics {
  const g = new Graphics();
  const { w, d } = COOKING_POT;
  // Drawn relative to the anchor (bottom middle of the footprint).
  box(g, -w / 2, 0, w, d - 4, 4, PALETTE[22]);
  box(g, -w / 2 + 2, -4, w - 4, d - 8, 18, PALETTE[24]);
  g.rect(-w / 2 + 5, -4 - 18 - (d - 8) + 2, w - 10, d - 12).fill(PALETTE[1]);
  g.rect(-4, -40, 2, 4).fill(PALETTE[20]);
  g.rect(1, -46, 2, 5).fill(PALETTE[20]);
  // A warm glow under the pot.
  g.rect(-6, -3, 12, 2).fill(PALETTE[9]);
  return g;
}

/** The ripe marker: a small warm arrow pointing down, its tip at (0, 0). */
export function drawRipeMarker(): Graphics {
  const g = new Graphics();
  g.rect(-5, -13, 10, 8).fill(DARK_WARM);
  g.rect(-4, -12, 8, 6).fill(PALETTE[10]);
  g.rect(-3, -6, 6, 3).fill(DARK_WARM);
  g.rect(-2, -6, 4, 2).fill(PALETTE[10]);
  g.rect(-1, -3, 2, 3).fill(DARK_WARM);
  return g;
}

