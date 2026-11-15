// The farm's placeholder art (steps 9b, BG6), drawn in code from boxes like the furniture: a plant in
// its stage (sprout, small plant, full plant in the colours of its crop or block), the
// cooking pot and the bouncing ripe marker. Light from the top-left: top faces lighter, fronts darker.

import { Graphics } from 'pixi.js';
import { COOKING_POT, PALETTE, getMaterialType, paletteColor, seedProduct, type PaletteName, type PlantStage, type SeedId } from '@pixel-hotel/shared';
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

/** The two colours of what a seed grows (the icon colours of the crop or the block), as hex. */
function plantColors(seed: SeedId): { main: string; accent: string } {
  const [c0, c1] = getMaterialType(seedProduct(seed)).icon.colors as [PaletteName, PaletteName | undefined];
  return { main: paletteColor(c0), accent: paletteColor(c1 ?? c0) };
}

/**
 * A plant in its stage on one 32 x 32 cell (top-left at 0, 0; the stem stands at the bottom middle): a sprout, a
 * small plant, then the full plant with its crop or block colour showing. Placeholder art in code.
 */
export function drawPlantArt(g: Graphics, seed: SeedId, stage: PlantStage): void {
  const { main, accent } = plantColors(seed);
  const cx = 16;
  const base = 30;
  g.ellipse(cx, base, 8, 2).fill({ color: DARK_WARM, alpha: 0.35 });
  if (stage === 'sprout') {
    g.rect(cx - 1, base - 8, 2, 8).fill(LEAF);
    g.rect(cx - 5, base - 10, 4, 3).fill(shade(LEAF, 1.2));
    g.rect(cx + 1, base - 11, 4, 3).fill(shade(LEAF, 1.2));
    g.rect(cx - 1, base - 1, 2, 1).fill(shade(SOIL, 0.6));
    return;
  }
  if (stage === 'small') {
    g.rect(cx - 1, base - 16, 2, 16).fill(shade(LEAF, 0.85));
    box(g, cx - 9, base - 6, 8, 4, 3, LEAF);
    box(g, cx + 2, base - 11, 8, 4, 3, shade(LEAF, 1.1));
    g.rect(cx - 2, base - 21, 4, 4).fill(shade(accent, 0.9)); // the bud, in the colour to come
    return;
  }
  // Fully grown: a bush with the crop (or block) colour on it.
  g.rect(cx - 1, base - 18, 2, 18).fill(shade(LEAF, 0.8));
  box(g, cx - 11, base - 4, 22, 6, 5, shade(LEAF, 0.95));
  box(g, cx - 8, base - 12, 16, 6, 5, LEAF);
  box(g, cx - 6, base - 19, 12, 5, 4, shade(LEAF, 1.15));
  for (const [x, y] of [[-9, -2], [6, -3], [-3, -10], [2, -16]] as const) {
    box(g, cx + x, base + y, 5, 3, 3, main);
    g.rect(cx + x, base + y - 6, 3, 1).fill(shade(accent, 1.2));
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

