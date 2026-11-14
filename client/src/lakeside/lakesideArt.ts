// The lakeside's placeholder art (step 9f), drawn in code like the farm's: the lake with a sandy
// rim and slow ripples, the wooden pier, trees (standing, a stump, a sapling while it grows
// back), bushes, and the bobber. Light from the top-left; dark warm outlines, no anti-aliasing.

import { Graphics } from 'pixi.js';
import { LAKE_BUSHES, LAKE_PIER, LAKE_WATER, PALETTE, type Point } from '@pixel-hotel/shared';
import { DARK_WARM } from '../render/bareStyles.ts';
import { shade } from '../render/colors.ts';
import { hash01 } from '../render/atmosphere.ts';

const WATER = shade(PALETTE[16], 1.25);
const WATER_LIGHT = shade(PALETTE[17], 0.95);
const WATER_DEEP = shade(PALETTE[16], 0.85);
const SAND = shade(PALETTE[2], 0.95);
const WOOD = PALETTE[4];
const LEAF = PALETTE[13];
const LEAF_RIM = PALETTE[15];

/** The water under the pier too (the pier's gap is water, but the pier is walkable on top). */
const UNDER_PIER = { x: LAKE_WATER[0]!.x, y: LAKE_WATER[0]!.y + LAKE_WATER[0]!.h, w: LAKE_PIER.x + LAKE_PIER.w - LAKE_WATER[0]!.x, h: LAKE_WATER[1]!.y - (LAKE_WATER[0]!.y + LAKE_WATER[0]!.h) };

/** A round pixel blob (whole rows, no smooth edge). */
function blob(g: Graphics, cx: number, cy: number, r: number, color: string): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    if (half > 0) g.rect(cx - half, cy + dy, half * 2, 1).fill(color);
  }
}

/** The lake: a sandy rim, the water, a lighter top edge and a darker bottom edge on every rectangle. */
export function drawLake(g: Graphics): void {
  g.clear();
  const rects = [...LAKE_WATER, UNDER_PIER];
  for (const r of rects) g.rect(r.x - 4, r.y - 4, r.w + 8, r.h + 8).fill(DARK_WARM);
  for (const r of rects) g.rect(r.x - 3, r.y - 3, r.w + 6, r.h + 6).fill(SAND);
  for (const r of rects) {
    g.rect(r.x, r.y, r.w, r.h).fill(WATER);
    g.rect(r.x, r.y + r.h - 6, r.w, 6).fill(WATER_DEEP);
    g.rect(r.x, r.y, r.w, 2).fill(WATER_LIGHT);
  }
  // The outer corners are cut a little (no hard square lake).
  for (const r of LAKE_WATER) {
    for (const [cx, cy] of [[r.x, r.y], [r.x + r.w - 3, r.y], [r.x, r.y + r.h - 3], [r.x + r.w - 3, r.y + r.h - 3]] as const) {
      if (cx < UNDER_PIER.x + 1 && cy >= UNDER_PIER.y - 1 && cy <= UNDER_PIER.y + UNDER_PIER.h) continue;
      g.rect(cx, cy, 3, 3).fill(SAND);
    }
  }
}

/** Ripples on the water: short light lines that come and go (stepped every 500 ms). */
export function drawRipples(g: Graphics, clockMs: number): void {
  g.clear();
  const step = Math.floor(clockMs / 500);
  const rects = [...LAKE_WATER, UNDER_PIER];
  for (let i = 0; i < 22; i++) {
    const phase = (step + Math.floor(hash01(i, 1) * 8)) % 8;
    if (phase > 3) continue;
    const r = rects[Math.floor(hash01(i, 2) * rects.length)]!;
    const x = r.x + 8 + Math.floor(hash01(i, 3) * (r.w - 24));
    const y = r.y + 8 + Math.floor(hash01(i, 4) * (r.h - 20));
    const w = 4 + phase * 2;
    g.rect(x, y, w, 1).fill({ color: PALETTE[19], alpha: phase === 0 || phase === 3 ? 0.25 : 0.45 });
  }
}

/** The pier: boards across, posts at the shore end and the far end. */
export function drawPier(g: Graphics): void {
  g.clear();
  const p = LAKE_PIER;
  g.rect(p.x - 1, p.y - 1, p.w + 2, p.h + 6).fill(DARK_WARM);
  for (let x = p.x; x < p.x + p.w; x += 8) {
    const odd = ((x - p.x) / 8) % 2 === 1;
    g.rect(x, p.y, 7, p.h).fill(odd ? shade(WOOD, 0.92) : shade(WOOD, 1.05));
    g.rect(x, p.y, 7, 1).fill(shade(WOOD, 1.25));
    g.rect(x + 7, p.y, 1, p.h).fill(shade(WOOD, 0.6));
    g.rect(x + 2, p.y + 9 + ((x / 8) % 3) * 4, 1, 1).fill(shade(WOOD, 0.7));
  }
  // The front edge, lower than the boards, in shade.
  g.rect(p.x, p.y + p.h, p.w, 4).fill(shade(WOOD, 0.55));
  // Posts.
  for (const [x, y] of [[p.x + 2, p.y - 2], [p.x + p.w - 6, p.y - 2], [p.x + 2, p.y + p.h - 4], [p.x + p.w - 6, p.y + p.h - 4]] as const) {
    g.rect(x - 1, y - 1, 6, 8).fill(DARK_WARM);
    g.rect(x, y, 4, 6).fill(shade(WOOD, 0.8));
    g.rect(x, y, 1, 6).fill(shade(WOOD, 1.15));
  }
}

export type TreeLook = 'tree' | 'stump' | 'sapling';

/** A tree at its anchor (the bottom middle of the trunk, 0, 0): trunk and crown; a stump; or a sapling. `hits`: notches in the trunk. */
export function drawTree(look: TreeLook, hits: number): Graphics {
  const g = new Graphics();
  // A soft shadow on the grass.
  g.ellipse(2, 1, 16, 4).fill({ color: DARK_WARM, alpha: 0.25 });
  if (look === 'tree') {
    g.rect(-7, -26, 14, 26).fill(DARK_WARM);
    g.rect(-6, -26, 12, 25).fill(shade(WOOD, 0.8));
    g.rect(-6, -26, 4, 25).fill(shade(WOOD, 1.1));
    g.rect(2, -26, 4, 25).fill(shade(WOOD, 0.6));
    // The roots.
    g.rect(-9, -3, 4, 3).fill(shade(WOOD, 0.8));
    g.rect(5, -3, 4, 3).fill(shade(WOOD, 0.65));
    // The crown: a big blob with two smaller ones, a dark rim, light from the top-left.
    const parts: [number, number, number][] = [[0, -50, 20], [-14, -40, 13], [14, -41, 13]];
    for (const [x, y, r] of parts) blob(g, x, y + 2, r, shade(LEAF_RIM, 0.8));
    for (const [x, y, r] of parts) blob(g, x, y, r, LEAF_RIM);
    for (const [x, y, r] of parts) blob(g, x - 1, y - 1, r - 2, LEAF);
    blob(g, -7, -57, 6, shade(LEAF, 1.25));
    blob(g, 9, -46, 4, shade(LEAF, 0.85));
    blob(g, -15, -44, 3, shade(LEAF, 1.2));
    // The notches the axe left (one per hit, alternating sides).
    for (let i = 0; i < Math.min(hits, 4); i++) {
      const y = -6 - i * 5;
      if (i % 2 === 0) g.rect(-6, y, 5, 2).fill(shade(PALETTE[2], 0.95));
      else g.rect(1, y, 5, 2).fill(shade(PALETTE[2], 0.95));
      g.rect(i % 2 === 0 ? -6 : 1, y + 2, 5, 1).fill(shade(WOOD, 0.45));
    }
  } else {
    // The stump: a short trunk with a lighter top showing the rings.
    g.rect(-8, -9, 16, 9).fill(DARK_WARM);
    g.rect(-7, -6, 14, 6).fill(shade(WOOD, 0.75));
    g.rect(-7, -6, 4, 6).fill(shade(WOOD, 1.05));
    g.rect(-7, -9, 14, 4).fill(shade(PALETTE[3], 0.95));
    g.rect(-4, -8, 8, 2).fill(shade(PALETTE[3], 0.7));
    g.rect(-1, -8, 2, 1).fill(shade(PALETTE[3], 0.55));
    if (look === 'sapling') {
      g.rect(-1, -18, 2, 10).fill(shade(WOOD, 0.9));
      blob(g, 0, -20, 5, LEAF_RIM);
      blob(g, 0, -20, 4, LEAF);
      blob(g, -1, -21, 2, shade(LEAF, 1.25));
    }
  }
  return g;
}

/** A bush (decoration): a dark rim, a lighter body and a few berries. */
export function drawBush(seed: number): Graphics {
  const g = new Graphics();
  g.ellipse(2, 1, 12, 3).fill({ color: DARK_WARM, alpha: 0.22 });
  blob(g, -5, -6, 7, LEAF_RIM);
  blob(g, 5, -6, 7, LEAF_RIM);
  blob(g, 0, -9, 8, LEAF_RIM);
  blob(g, -5, -6, 6, LEAF);
  blob(g, 5, -6, 6, shade(LEAF, 0.9));
  blob(g, -1, -10, 6, shade(LEAF, 1.1));
  blob(g, -3, -12, 2, shade(LEAF, 1.3));
  if (hash01(seed, 5) > 0.45) {
    for (const [x, y] of [[-6, -5], [4, -8], [7, -3]] as const) g.rect(x, y, 2, 2).fill(PALETTE[8]);
  }
  return g;
}

/** Where the bushes stand (anchors). */
export const BUSHES: readonly Point[] = LAKE_BUSHES;

/** The bobber at (0, 0): a white and red float. `dip`: it is pulled under (a bite). */
export function drawBobber(dip: boolean): Graphics {
  const g = new Graphics();
  // A ring on the water.
  g.rect(-6, 1, 12, 1).fill({ color: PALETTE[19], alpha: 0.5 });
  g.rect(-4, 2, 8, 1).fill({ color: PALETTE[19], alpha: 0.35 });
  const y = dip ? 2 : 0;
  g.rect(-3, -6 + y, 6, 8).fill(DARK_WARM);
  g.rect(-2, -5 + y, 4, 3).fill(PALETTE[8]);
  g.rect(-2, -2 + y, 4, 3).fill(PALETTE[19]);
  g.rect(-1, -8 + y, 2, 3).fill(DARK_WARM);
  return g;
}

/** The "!" over the bobber on a bite. */
export function drawBang(): Graphics {
  const g = new Graphics();
  g.rect(-4, -17, 8, 17).fill(DARK_WARM);
  g.rect(-3, -16, 6, 11).fill(PALETTE[10]);
  g.rect(-3, -3, 6, 3).fill(PALETTE[10]);
  g.rect(-1, -14, 2, 7).fill(DARK_WARM);
  g.rect(-1, -3, 2, 2).fill(DARK_WARM);
  return g;
}
