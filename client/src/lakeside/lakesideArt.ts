// The lakeside's art (step 9f, look v1 = A16), drawn in code like the farm's; the PNG hooks of C15 fall back
// to these. Since A3 (19 Nov) the pond, its water, the pier and the pond decor are PNG tiles (pondView.ts) and the code
// lake and pier are gone. Here: three kinds of tree in two leaf shades (oak, pine, birch), three bushes, a better
// stump and sapling, decor pieces for the coder to place (reeds, cattails, flowers, stones, mushrooms, tufts,
// lily pads) and the bobber, rings and a splash as small pre-built Graphics. Light from the top-left; no
// anti-aliasing (whole rows and rects only). Medieval touches: rope-wrapped posts, an iron lantern, a nailed deck.
// Palette only from shared/palette.ts (shade() is the placeholder shading helper).

import { Graphics, Sprite } from 'pixi.js';
import { LAKE_BUSHES, PALETTE, type Point } from '@pixel-hotel/shared';
import { DARK_WARM } from '../render/bareStyles.ts';
import { shade } from '../render/colors.ts';
import { hash01 } from '../render/atmosphere.ts';
import { spriteTexture } from '../render/spriteStore.ts';

const WOOD = PALETTE[4]!;
const SAND_DRY = shade(PALETTE[2]!, 0.97);
const SAND_WET = shade(PALETTE[3]!, 0.92);
const FOAM = PALETTE[19]!;
const SHALLOW = shade(PALETTE[17]!, 1.08);
const WATER_MID = shade(PALETTE[17]!, 0.92);
const WATER_DEEP = shade(PALETTE[17]!, 0.72);
const WATER_DEEPEST = shade(PALETTE[17]!, 0.56);
const SKY_GLINT = PALETTE[18]!;

/** A flat colour, or a colour with alpha. */
type Fill = string | { color: string; alpha: number };

/** A round pixel blob (whole rows, no smooth edge). */
function blob(g: Graphics, cx: number, cy: number, r: number, color: Fill): void {
  for (let dy = -r; dy <= r; dy++) {
    const half = Math.round(Math.sqrt(r * r - dy * dy));
    if (half > 0) g.rect(cx - half, cy + dy, half * 2, 1).fill(color);
  }
}

/** A flat oval of whole rows (rx wide, ry tall). */
function oval(g: Graphics, cx: number, cy: number, rx: number, ry: number, color: Fill): void {
  for (let i = 0; i < ry * 2; i++) {
    const dy = i + 0.5 - ry;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
    if (hw > 0) g.rect(cx - hw, cy - ry + i, hw * 2, 1).fill(color);
  }
}

function px(g: Graphics, x: number, y: number, w: number, h: number, color: Fill): void {
  g.rect(x, y, w, h).fill(color);
}

export type TreeLook = 'tree' | 'stump' | 'sapling';

/** Tree kinds: 0 oak, 1 pine, 2 birch; each in two leaf shades (the second set is 3, 4, 5). */
export const TREE_VARIANTS = 6;
/** Which variant tree number `i` is (the coder places them in C15; the mix is stable). */
export function treeVariantOf(i: number): number {
  return [0, 1, 2, 3, 1, 5, 0, 4][((i % 8) + 8) % 8]!;
}

interface Leaf {
  rim: string;
  body: string;
  lit: string;
  dark: string;
}
const LEAF_LIGHT: Leaf = { rim: PALETTE[14]!, body: PALETTE[13]!, lit: PALETTE[12]!, dark: PALETTE[15]! };
const LEAF_DARK: Leaf = { rim: PALETTE[14]!, body: shade(PALETTE[12]!, 0.78), lit: PALETTE[12]!, dark: PALETTE[15]! };

/** A trunk of half-width hw, x from -hw to hw, rows y0..0, with bark lines and roots. */
function trunk(g: Graphics, hw: number, h: number, bark: string, lit: string, dark: string, birch: boolean): void {
  px(g, -hw - 1, -h, hw * 2 + 2, h, DARK_WARM);
  px(g, -hw, -h, hw * 2, h - 1, bark);
  px(g, -hw, -h, Math.max(2, Math.floor(hw / 2)), h - 1, lit);
  px(g, hw - Math.max(2, Math.floor(hw / 2)), -h, Math.max(2, Math.floor(hw / 2)), h - 1, dark);
  if (birch) {
    for (const y of [-h + 4, -h + 10, -h + 17, -4]) px(g, -hw + 1, y, 3 + (y % 3), 2, PALETTE[25]!);
    px(g, hw - 4, -h + 7, 3, 1, PALETTE[25]!);
  } else {
    for (const y of [-h + 5, -h + 12, -h + 19]) px(g, -1, y, 1, 4, shade(dark, 0.7));
    px(g, -2, -12, 3, 3, shade(dark, 0.6));
    px(g, -1, -11, 1, 1, shade(bark, 1.1));
  }
  // The roots.
  px(g, -hw - 3, -3, 4, 3, DARK_WARM);
  px(g, -hw - 2, -3, 3, 2, bark);
  px(g, hw - 1, -3, 4, 3, DARK_WARM);
  px(g, hw, -3, 3, 2, dark);
}

/**
 * A tree at its anchor (the bottom middle of the trunk, 0, 0): trunk and crown; a stump; or a sapling. `hits`: notches in the
 * trunk. `part` 'trunk' draws the shadow, trunk and notches (and a stump or sapling), 'crown' only the leaves, so the coder can sway the crown alone (same anchor). `variant` 0 to 5: oak, pine, birch in a fresh and a deep leaf shade (see treeVariantOf); the default is the old oak.
 */
export function drawTree(look: TreeLook, hits: number, variant = 0, part: 'all' | 'trunk' | 'crown' = 'all'): Graphics {
  const g = new Graphics();
  const kind = ((variant % 3) + 3) % 3; // 0 oak, 1 pine, 2 birch
  const leaf = variant >= 3 ? LEAF_DARK : LEAF_LIGHT;
  // A soft shadow on the grass, long and to the right (light from the top-left).
  const withTrunk = part !== 'crown';
  const withCrown = part !== 'trunk';
  if (withTrunk) oval(g, 4, 1, kind === 1 ? 16 : 20, 4, { color: DARK_WARM, alpha: 0.3 });
  // PNG art (sprites/lake: tree_<v>_trunk / _crown, tree_stump, tree_sapling_<0|1>; canvas 64 x 88, anchor (32, 80)); the code art below is the fallback.
  const png = (id: string): boolean => {
    const t = spriteTexture('lake', id);
    if (!t) return false;
    const sp = new Sprite(t);
    sp.position.set(-32, -80);
    g.addChild(sp);
    return true;
  };
  if (look === 'tree') {
    const trunkId = `tree_${variant}_trunk`;
    if (spriteTexture('lake', trunkId) && spriteTexture('lake', `tree_${variant}_crown`)) {
      if (withTrunk) png(trunkId);
      const hw = kind === 2 ? 5 : kind === 1 ? 4 : 7;
      for (let i = 0; withTrunk && i < Math.min(hits, 4); i++) {
        const y = -6 - i * 5;
        const left = i % 2 === 0;
        px(g, left ? -hw : 1, y, hw - 1, 2, shade(PALETTE[2]!, 0.95));
        px(g, left ? -hw : 1, y + 1 + 1, hw - 1, 1, shade(WOOD, 0.45));
      }
      if (withCrown) png(`tree_${variant}_crown`);
      return g;
    }
  } else if (part !== 'crown' && png(look === 'stump' ? 'tree_stump' : `tree_sapling_${variant >= 3 ? 1 : 0}`)) {
    return g;
  }
  if (look === 'tree') {
    const hw = kind === 2 ? 5 : kind === 1 ? 4 : 7;
    const th = kind === 1 ? 20 : 26;
    const bark = kind === 2 ? PALETTE[2]! : shade(WOOD, 0.8);
    const lit = kind === 2 ? PALETTE[19]! : shade(WOOD, 1.2);
    const dark = kind === 2 ? PALETTE[21]! : shade(WOOD, 0.58);
    if (withTrunk) trunk(g, hw, th, bark, lit, dark, kind === 2);
    if (!withCrown) {
      // no leaves in this part
    } else if (kind === 0) {
      // Oak: a broad crown of three clumps, a dark underside, lit clumps top-left, leaf clusters on the rim.
      const parts: [number, number, number][] = [[0, -50, 20], [-14, -40, 13], [14, -41, 13]];
      for (const [x, y, r] of parts) blob(g, x, y + 2, r + 1, DARK_WARM);
      for (const [x, y, r] of parts) blob(g, x, y + 2, r, leaf.dark);
      for (const [x, y, r] of parts) blob(g, x, y, r, leaf.rim);
      for (const [x, y, r] of parts) blob(g, x - 1, y - 1, r - 2, leaf.body);
      blob(g, -7, -57, 7, leaf.lit);
      blob(g, -17, -45, 4, leaf.lit);
      blob(g, 9, -46, 4, shade(leaf.body, 0.85));
      blob(g, 16, -38, 4, shade(leaf.body, 0.8));
      for (const [x, y] of [[-3, -63], [5, -55], [-10, -49], [12, -50], [0, -44], [-16, -38]] as const) px(g, x, y, 2, 2, leaf.rim);
      for (const [x, y] of [[-12, -60], [-4, -66], [-1, -52]] as const) px(g, x, y, 2, 1, shade(leaf.lit, 1.2));
    } else if (kind === 1) {
      // Pine: four stepped tiers, wide at the bottom, lit left edges, dark right edges, a tip.
      const tiers: [number, number, number][] = [[-12, 18, 15], [-27, 14, 13], [-41, 10, 12], [-54, 6, 11]];
      for (const [by, hwid, th2] of tiers) {
        for (let i = 0; i < th2; i++) {
          const half = Math.round(hwid * ((i + 1) / th2));
          px(g, -half - 1, by - th2 + i, half * 2 + 2, 1, DARK_WARM);
        }
        px(g, -hwid - 1, by, hwid * 2 + 2, 1, DARK_WARM);
      }
      for (const [by, hwid, th2] of tiers) {
        for (let i = 0; i < th2; i++) {
          const half = Math.round(hwid * ((i + 1) / th2));
          px(g, -half, by - th2 + i, half * 2, 1, leaf.rim);
          px(g, -half, by - th2 + i, Math.max(1, Math.round(half * 0.55)), 1, leaf.body);
          px(g, -half + 1, by - th2 + i, Math.max(1, Math.round(half * 0.25)), 1, leaf.lit);
        }
        px(g, -hwid, by, hwid * 2, 2, leaf.dark);
      }
      px(g, -1, -70, 2, 6, DARK_WARM);
      px(g, 0, -69, 1, 4, leaf.lit);
    } else {
      // Birch: two light oval crowns on a slim white trunk with dark marks.
      for (const [x, y, rx, ry] of [[-5, -44, 12, 14], [7, -38, 11, 12], [0, -56, 10, 10]] as const) oval(g, x, y + 1, rx + 1, ry + 1, DARK_WARM);
      for (const [x, y, rx, ry] of [[-5, -44, 12, 14], [7, -38, 11, 12], [0, -56, 10, 10]] as const) oval(g, x, y, rx, ry, leaf.body);
      oval(g, -8, -50, 7, 7, leaf.lit);
      oval(g, 3, -58, 5, 4, leaf.lit);
      oval(g, 9, -35, 6, 5, shade(leaf.body, 0.85));
      for (const [x, y] of [[-12, -40], [-2, -46], [4, -52], [8, -42]] as const) px(g, x, y, 2, 2, leaf.rim);
    }
    // The notches the axe left (one per hit, alternating sides).
    const w = hw;
    for (let i = 0; withTrunk && i < Math.min(hits, 4); i++) {
      const y = -6 - i * 5;
      const left = i % 2 === 0;
      px(g, left ? -w : 1, y, w - 1, 2, shade(PALETTE[2]!, 0.95));
      px(g, left ? -w : 1, y + 2, w - 1, 1, shade(WOOD, 0.45));
    }
  } else if (part !== 'crown') {
    // The stump: a short trunk with a lighter top showing the growth rings, moss on the shaded side, a mushroom.
    px(g, -9, -9, 18, 9, DARK_WARM);
    px(g, -8, -6, 16, 6, shade(WOOD, 0.72));
    px(g, -8, -6, 5, 6, shade(WOOD, 1.1));
    px(g, 4, -6, 4, 6, shade(WOOD, 0.55));
    oval(g, 0, -8, 9, 4, DARK_WARM);
    oval(g, 0, -8, 8, 3, shade(PALETTE[3]!, 0.98));
    oval(g, 0, -8, 5, 2, shade(PALETTE[3]!, 0.78));
    px(g, -1, -9, 2, 1, shade(PALETTE[3]!, 0.6));
    px(g, 4, -5, 4, 2, kind === 2 ? PALETTE[12]! : PALETTE[14]!);
    if (look === 'stump') {
      px(g, -11, -3, 3, 2, DARK_WARM);
      px(g, -10, -3, 2, 1, shade(WOOD, 0.7));
      px(g, 8, -4, 2, 3, PALETTE[2]!);
      px(g, 7, -6, 4, 2, PALETTE[8]!);
      px(g, 8, -6, 1, 1, PALETTE[19]!);
    }
    if (look === 'sapling') {
      // A young tree: a thin stem, a few leaves in the shade of the variant, a wooden stake with a tie.
      px(g, -1, -22, 3, 14, DARK_WARM);
      px(g, 0, -22, 1, 14, shade(WOOD, 1.05));
      px(g, 1, -22, 1, 14, shade(WOOD, 0.7));
      blob(g, 0, -24, 6, DARK_WARM);
      blob(g, 0, -24, 5, leaf.rim);
      blob(g, -1, -25, 4, leaf.body);
      blob(g, -2, -26, 2, leaf.lit);
      px(g, -8, -18, 4, 3, leaf.body);
      px(g, 5, -15, 4, 3, shade(leaf.body, 0.85));
      px(g, -9, -18, 1, 3, DARK_WARM);
      px(g, 9, -15, 1, 3, DARK_WARM);
      px(g, 6, -16, 2, 10, shade(WOOD, 0.9));
      px(g, 5, -8, 4, 1, PALETTE[2]!);
    }
  }
  return g;
}

/**
 * A bush (decoration), three kinds by the seed: 0 round with white flowers, 1 berry bush, 2 a bush with yellow and rose
 * flowers. Dark rim, light from the top-left.
 */
export function drawBush(seed: number): Graphics {
  const g = new Graphics();
  const kind = Math.floor(hash01(seed, 5) * 3) % 3;
  const leaf = kind === 1 ? LEAF_DARK : LEAF_LIGHT;
  oval(g, 3, 1, 13, 3, { color: DARK_WARM, alpha: 0.35 });
  blob(g, -5, -6, 8, DARK_WARM);
  blob(g, 5, -6, 8, DARK_WARM);
  blob(g, 0, -9, 9, DARK_WARM);
  blob(g, -5, -6, 7, leaf.rim);
  blob(g, 5, -6, 7, leaf.rim);
  blob(g, 0, -9, 8, leaf.rim);
  blob(g, -5, -6, 6, leaf.body);
  blob(g, 5, -6, 6, shade(leaf.body, 0.9));
  blob(g, -1, -10, 6, shade(leaf.body, 1.1));
  blob(g, -3, -12, 3, leaf.lit);
  blob(g, -9, -7, 2, leaf.lit);
  const spots: [number, number][] = [[-7, -5], [3, -9], [7, -4], [-2, -12], [-9, -9], [10, -8]];
  if (kind === 0) for (const [x, y] of spots) { px(g, x, y, 2, 2, PALETTE[19]!); px(g, x, y + 1, 1, 1, PALETTE[2]!); }
  else if (kind === 1) for (const [x, y] of spots) { px(g, x, y, 2, 2, PALETTE[8]!); px(g, x, y, 1, 1, PALETTE[29]!); }
  else for (const [i, [x, y]] of spots.entries()) px(g, x, y, 2, 2, i % 2 === 0 ? PALETTE[11]! : PALETTE[29]!);
  return g;
}

/** Where the bushes stand (anchors). */
export const BUSHES: readonly Point[] = LAKE_BUSHES;

// ---------- Decor pieces (the coder places them in C15: never on water, the pier, a tree or the door zone) ----------

/** Reeds on the shore: a clump of three to five blades with seed heads; `seed` picks the blades. Base at (0, 0). */
export function drawReeds(seed: number): Graphics {
  const g = new Graphics();
  oval(g, 1, 1, 8, 2, { color: DARK_WARM, alpha: 0.3 });
  const n = 3 + Math.floor(hash01(seed, 1) * 3);
  for (let i = 0; i < n; i++) {
    const x = -6 + i * 3 + Math.floor(hash01(seed, 2 + i) * 2);
    const h = 12 + Math.floor(hash01(seed, 9 + i) * 8);
    const lean = i % 2 === 0 ? 0 : 1;
    px(g, x - 1, -h, 4, h, DARK_WARM);
    px(g, x, -h + 1, 2, h - 1, PALETTE[13]!);
    px(g, x, -h + 1, 1, h - 1, PALETTE[12]!);
    px(g, x + lean, -h - 2, 2, 3, DARK_WARM);
    px(g, x + lean, -h - 1, 2, 2, PALETTE[4]!);
  }
  return g;
}

/** A cattail: a tall stem with a brown sausage head. Base at (0, 0). */
export function drawCattail(seed: number): Graphics {
  const g = new Graphics();
  oval(g, 1, 1, 6, 2, { color: DARK_WARM, alpha: 0.3 });
  for (const [i, x] of [-4, 0, 4].entries()) {
    const h = 18 + ((seed + i * 5) % 3) * 4;
    px(g, x - 1, -h, 3, h, DARK_WARM);
    px(g, x, -h + 1, 1, h - 1, PALETTE[13]!);
    px(g, x - 2, -h - 6, 5, 8, DARK_WARM);
    px(g, x - 1, -h - 5, 3, 6, PALETTE[5]!);
    px(g, x - 1, -h - 5, 1, 6, PALETTE[4]!);
    px(g, x, -h - 8, 1, 3, PALETTE[3]!);
  }
  return g;
}

/** A flower in a tuft of leaves: kind 0 yellow, 1 rose, 2 white, 3 orchid (blue-violet); `seed` picks a petal count. Base at (0, 0). */
export function drawFlower(kind = 0, seed = 0): Graphics {
  const g = new Graphics();
  const petal = [PALETTE[11]!, PALETTE[29]!, PALETTE[19]!, PALETTE[28]!][((kind % 4) + 4) % 4]!;
  const heart = kind === 0 || kind === 2 ? PALETTE[9]! : PALETTE[11]!;
  px(g, -4, -3, 3, 3, DARK_WARM);
  px(g, 1, -3, 3, 3, DARK_WARM);
  px(g, -3, -3, 2, 2, PALETTE[13]!);
  px(g, 1, -3, 2, 2, PALETTE[12]!);
  px(g, 0, -9, 1, 7, DARK_WARM);
  px(g, 0, -8, 1, 6, PALETTE[13]!);
  const n = hash01(seed, 4) > 0.5 ? 1 : 0;
  px(g, -3, -13 - n, 7, 5, DARK_WARM);
  px(g, -2, -14 - n, 5, 7, DARK_WARM);
  px(g, -2, -12 - n, 5, 3, petal);
  px(g, -1, -13 - n, 3, 5, petal);
  px(g, -1, -11 - n, 1, 1, heart);
  px(g, 0, -12 - n, 1, 1, shade(petal, 1.2));
  return g;
}

/** A small stone: grey, lit top-left, mossy on the shaded side for some seeds. Base at (0, 0). */
export function drawStone(seed = 0): Graphics {
  const g = new Graphics();
  const s = 1 + (seed % 3);
  oval(g, 1, 1, 6 + s * 2, 2, { color: DARK_WARM, alpha: 0.3 });
  oval(g, 0, -3 - s, 6 + s * 2, 3 + s, DARK_WARM);
  oval(g, 0, -3 - s, 5 + s * 2, 2 + s, PALETTE[21]!);
  oval(g, -1, -4 - s, 3 + s, 1 + s, PALETTE[20]!);
  px(g, 3 + s, -2 - s, 3, 2, PALETTE[22]!);
  if (seed % 2 === 0) px(g, 1 + s, -4 - s, 4, 2, PALETTE[14]!);
  return g;
}

/** A mushroom pair: a red cap with white dots on a cream stalk. Base at (0, 0). */
export function drawMushroom(seed = 0): Graphics {
  const g = new Graphics();
  oval(g, 1, 1, 8, 2, { color: DARK_WARM, alpha: 0.3 });
  const cap = seed % 2 === 0 ? PALETTE[8]! : PALETTE[4]!;
  const small = (x: number, h: number): void => {
    px(g, x - 2, -h, 5, h, DARK_WARM);
    px(g, x - 1, -h + 1, 3, h - 1, PALETTE[2]!);
    oval(g, x, -h - 1, 5, 3, DARK_WARM);
    oval(g, x, -h - 1, 4, 2, cap);
    px(g, x - 2, -h - 2, 2, 1, shade(cap, 1.3));
    px(g, x + 1, -h - 2, 1, 1, PALETTE[19]!);
    px(g, x - 2, -h - 1, 1, 1, PALETTE[19]!);
  };
  small(-3, 6);
  small(5, 4);
  return g;
}

/** A tall grass tuft: five blades in two greens. Base at (0, 0). */
export function drawTuft(seed = 0): Graphics {
  const g = new Graphics();
  for (let i = 0; i < 5; i++) {
    const x = -5 + i * 2;
    const h = 6 + Math.floor(hash01(seed, i) * 5);
    px(g, x - 1, -h, 3, h, DARK_WARM);
    px(g, x, -h + 1, 1, h - 1, i % 2 === 0 ? PALETTE[12]! : PALETTE[13]!);
  }
  return g;
}

/** A lily pad on the water: a round leaf with a notch, and sometimes a white flower. Centre at (0, 0). */
export function drawLilyPad(seed = 0): Graphics {
  const g = new Graphics();
  oval(g, 1, 1, 9, 5, { color: DARK_WARM, alpha: 0.3 });
  oval(g, 0, 0, 9, 5, DARK_WARM);
  oval(g, 0, 0, 8, 4, PALETTE[13]!);
  oval(g, -2, -1, 5, 2, PALETTE[12]!);
  px(g, 3, 0, 6, 1, SHALLOW); // the notch
  if (seed % 3 === 0) {
    px(g, -1, -4, 5, 4, DARK_WARM);
    px(g, 0, -3, 3, 2, PALETTE[19]!);
    px(g, 1, -3, 1, 1, PALETTE[11]!);
  }
  return g;
}

// ---------- Fishing pieces (built once; the coder moves them) ----------

/** The bobber at (0, 0): a white and red float. `dip`: it is pulled under (a bite). */
export function drawBobber(dip: boolean): Graphics {
  const g = new Graphics();
  // A ring on the water.
  g.rect(-6, 1, 12, 1).fill({ color: PALETTE[19]!, alpha: 0.5 });
  g.rect(-4, 2, 8, 1).fill({ color: PALETTE[19]!, alpha: 0.35 });
  const y = dip ? 2 : 0;
  g.rect(-3, -6 + y, 6, 8).fill(DARK_WARM);
  g.rect(-2, -5 + y, 4, 3).fill(PALETTE[8]!);
  g.rect(-2, -2 + y, 4, 3).fill(PALETTE[19]!);
  g.rect(-2, -5 + y, 1, 3).fill(PALETTE[29]!);
  g.rect(-1, -8 + y, 2, 3).fill(DARK_WARM);
  return g;
}

/** The "!" over the bobber on a bite. */
export function drawBang(): Graphics {
  const g = new Graphics();
  g.rect(-4, -17, 8, 17).fill(DARK_WARM);
  g.rect(-3, -16, 6, 11).fill(PALETTE[10]!);
  g.rect(-3, -3, 6, 3).fill(PALETTE[10]!);
  g.rect(-3, -16, 1, 11).fill(PALETTE[11]!);
  g.rect(-1, -14, 2, 7).fill(DARK_WARM);
  g.rect(-1, -3, 2, 2).fill(DARK_WARM);
  return g;
}

/** A ring on the water for step 0 to 3 (it grows and fades): centre (0, 0), flat oval of whole rows. Built once per step. */
export function drawRing(step: number): Graphics {
  const g = new Graphics();
  const s = Math.max(0, Math.min(3, Math.round(step)));
  const rx = 4 + s * 4;
  const ry = 2 + s * 2;
  const a = [0.9, 0.7, 0.45, 0.25][s]!;
  for (let i = 0; i < ry * 2; i++) {
    const dy = i + 0.5 - ry;
    const hw = Math.round(rx * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
    if (hw <= 0) continue;
    const edge = i === 0 || i === ry * 2 - 1 ? hw : 2;
    g.rect(-hw, -ry + i, edge, 1).fill({ color: PALETTE[19]!, alpha: a });
    if (edge !== hw) g.rect(hw - 2, -ry + i, 2, 1).fill({ color: PALETTE[19]!, alpha: a });
  }
  return g;
}

/** A splash for frame 0 to 3: droplets thrown up and out, then falling; centre (0, 0) on the water. Built once per frame. */
export function drawSplash(frame: number): Graphics {
  const g = new Graphics();
  const f = Math.max(0, Math.min(3, Math.round(frame)));
  const white = PALETTE[19]!;
  const cyan = SKY_GLINT;
  if (f === 0) {
    px(g, -1, -6, 3, 6, white);
    px(g, -4, -3, 2, 3, cyan);
    px(g, 3, -3, 2, 3, cyan);
  } else if (f === 1) {
    for (const [x, y] of [[-6, -10], [-2, -13], [3, -12], [7, -9], [0, -8]] as const) px(g, x, y, 2, 2, white);
    px(g, -4, -5, 2, 3, cyan);
    px(g, 3, -5, 2, 3, cyan);
    px(g, -1, -6, 3, 6, cyan);
  } else if (f === 2) {
    for (const [x, y] of [[-9, -7], [-5, -9], [5, -9], [9, -6], [-1, -10]] as const) px(g, x, y, 2, 2, cyan);
    px(g, -7, -3, 3, 1, white);
    px(g, 4, -3, 3, 1, white);
  } else {
    for (const [x, y] of [[-10, -2], [-6, -3], [6, -3], [10, -2]] as const) px(g, x, y, 2, 1, cyan);
  }
  return g;
}

// ---------- A22: code fallback pieces for C15 (the plugin art A21 replaces them id by id) ----------

/** Frames of the animated water tile and how long each shows (the coder picks the frame by clockMs). */
export const WATER_FRAMES = 4;
export const WATER_FRAME_MS = 250;
/** Size of a water or shore tile, px. */
export const LAKE_TILE = 32;

/** Draws a 32 x 32 tile row by row as runs of equal colour (few rects). */
function drawRows(g: Graphics, pixel: (x: number, y: number) => string): void {
  for (let y = 0; y < LAKE_TILE; y++) {
    let start = 0;
    let cur = pixel(0, y);
    for (let x = 1; x <= LAKE_TILE; x++) {
      const c = x < LAKE_TILE ? pixel(x, y) : '';
      if (c !== cur) {
        g.rect(start, y, x - start, 1).fill(cur);
        start = x;
        cur = c;
      }
    }
  }
}

/**
 * One frame (0 to 3) of the water tile, 32 x 32 and seamless: the mid-water colour with light diagonal shimmer lines that
 * slide one step per frame, a few darker ripples and sparkles. The strip of 4 is what C15 cycles by clockMs.
 */
export function drawWaterTile(frame: number): Graphics {
  const g = new Graphics();
  const f = ((Math.round(frame) % WATER_FRAMES) + WATER_FRAMES) % WATER_FRAMES;
  const light = shade(PALETTE[17]!, 1.25);
  const dark = shade(PALETTE[17]!, 0.7);
  drawRows(g, (x, y) => {
    const d = (x + y * 2 + f * 4) % 16; // a diagonal that repeats every 16 px (tile-safe) and slides with the frame
    const d2 = (x * 2 - y + f * 3 + 32) % 32;
    if (d === 0 || d === 1) return light;
    if (d2 === 7) return dark;
    if (x % 16 === (f * 5 + y) % 16 && y % 8 === 3) return PALETTE[19]!; // a sparkle that walks
    return WATER_MID;
  });
  return g;
}

export type ShorePiece =
  | 'edge_n' | 'edge_e' | 'edge_s' | 'edge_w'
  | 'outer_nw' | 'outer_ne' | 'outer_se' | 'outer_sw'
  | 'inner_nw' | 'inner_ne' | 'inner_se' | 'inner_sw';
export const SHORE_PIECES: readonly ShorePiece[] = [
  'edge_n', 'edge_e', 'edge_s', 'edge_w', 'outer_nw', 'outer_ne', 'outer_se', 'outer_sw', 'inner_nw', 'inner_ne', 'inner_se', 'inner_sw',
];

/** Signed distance (px) from the water's edge in a shore tile: negative on land, positive in the water. */
function shoreDistance(piece: ShorePiece, x: number, y: number): number {
  const m = 17; // the water's edge sits 17 px into the tile
  const r = 10; // corner radius
  if (piece === 'edge_n') return y - m + 0.5;
  if (piece === 'edge_s') return LAKE_TILE - 1 - y - m + 0.5;
  if (piece === 'edge_w') return x - m + 0.5;
  if (piece === 'edge_e') return LAKE_TILE - 1 - x - m + 0.5;
  // Distances measured from the two sides that carry land (the corner is at the tile's corner).
  const west = piece.endsWith('w');
  const north = piece.includes('n');
  const dx = west ? x + 0.5 : LAKE_TILE - x - 0.5;
  const dy = north ? y + 0.5 : LAKE_TILE - y - 0.5;
  if (piece.startsWith('outer_')) {
    // Land on the two outer sides; the water is a big rounded rectangle whose corner (radius r) lies in this tile.
    if (dx >= m + r || dy >= m + r) return Math.min(dx, dy) - m;
    return r - Math.hypot(m + r - dx, m + r - dy);
  }
  // inner_*: only a rounded block of land (reach m) in the corner, the rest is water: a rounded-rect distance.
  const qx = dx - (m - r);
  const qy = dy - (m - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * A shore tile (32 x 32) for the ring around the lake: dry sand with pebbles, wet sand, a white foam line (`foam` 0 to 2 widens
 * and thins it for a pulse), shallows and mid water. Ids as in A21. `edge_n` has land to the north, `outer_nw` is the lake's
 * north-west corner (land on the north and west), `inner_nw` is a concave corner (land only in the north-west).
 */
export function drawShorePiece(piece: ShorePiece, foam = 0): Graphics {
  const g = new Graphics();
  const fw = 2 + (Math.round(foam) % 3 === 1 ? 1 : 0);
  const salt = SHORE_PIECES.indexOf(piece) * 7;
  drawRows(g, (x, y) => {
    const s = shoreDistance(piece, x, y);
    if (s >= 0) {
      if (s < fw) return FOAM;
      if (s < fw + 7) return SHALLOW;
      return WATER_MID;
    }
    if (s > -2) return shade(SAND_WET, 0.85);
    if (s > -5) return SAND_WET;
    const h = hash01(x + salt, y);
    if (h > 0.97) return shade(SAND_DRY, 0.72); // a pebble speck
    if (h > 0.93) return shade(SAND_DRY, 1.06);
    return SAND_DRY;
  });
  return g;
}

/** A small bird, feet at (0, 0): 'perch' sits (a robin: brown back, cream belly, red breast), 'fly1' wings up, 'fly2' wings down. Faces right. */
export function drawBird(pose: 'perch' | 'fly1' | 'fly2' = 'perch'): Graphics {
  const g = new Graphics();
  const body = PALETTE[5]!;
  if (pose === 'perch') {
    px(g, -5, -9, 11, 8, DARK_WARM);
    px(g, -4, -8, 9, 6, body);
    px(g, -4, -8, 3, 2, PALETTE[4]!);
    px(g, 0, -4, 5, 3, PALETTE[2]!);
    px(g, 2, -6, 3, 3, PALETTE[8]!);
    px(g, 5, -9, 3, 3, DARK_WARM);
    px(g, 4, -8, 3, 2, body);
    px(g, 6, -7, 3, 1, PALETTE[9]!);
    px(g, 5, -8, 1, 1, PALETTE[25]!);
    px(g, -8, -6, 4, 2, DARK_WARM);
    px(g, -7, -6, 3, 1, shade(body, 0.8));
    px(g, -2, -1, 1, 1, DARK_WARM);
    px(g, 2, -1, 1, 1, DARK_WARM);
    return g;
  }
  const up = pose === 'fly1';
  px(g, -4, -6, 9, 5, DARK_WARM);
  px(g, -3, -5, 7, 3, body);
  px(g, 0, -3, 4, 1, PALETTE[2]!);
  px(g, 4, -6, 3, 3, DARK_WARM);
  px(g, 4, -5, 2, 2, body);
  px(g, 6, -4, 2, 1, PALETTE[9]!);
  px(g, 5, -5, 1, 1, PALETTE[25]!);
  px(g, -7, -5, 3, 1, DARK_WARM);
  // Wings: raised or lowered, a stepped slant.
  const rows: [number, number, number][] = up
    ? [[-7, -4, 5], [-8, -3, 3], [-9, -2, 2], [-10, -1, 1]]
    : [[-3, -3, 6], [-2, -4, 4], [-1, -5, 3], [0, -5, 2]];
  for (const [y, dx, w] of rows) px(g, dx - 1, y - 1, w + 2, 3, DARK_WARM);
  for (const [y, dx, w] of rows) px(g, dx, y, w, 1, shade(body, 1.3));
  return g;
}

/** A butterfly, centre at (0, 0): frame 0 wings open, frame 1 wings half closed; kind 0 yellow, 1 blue, 2 orange. */
export function drawButterfly(frame: number, kind = 0): Graphics {
  const g = new Graphics();
  const k = ((kind % 3) + 3) % 3;
  const wing = [PALETTE[11]!, PALETTE[17]!, PALETTE[9]!][k]!;
  const spot = [PALETTE[9]!, PALETTE[19]!, PALETTE[11]!][k]!;
  if (frame % 2 === 0) {
    px(g, -5, -3, 4, 5, DARK_WARM);
    px(g, 2, -3, 4, 5, DARK_WARM);
    px(g, -4, -2, 3, 3, wing);
    px(g, 2, -2, 3, 3, wing);
    px(g, -4, -2, 1, 1, spot);
    px(g, 4, -2, 1, 1, spot);
    px(g, -3, 1, 2, 2, wing);
    px(g, 2, 1, 2, 2, wing);
  } else {
    px(g, -3, -3, 3, 5, DARK_WARM);
    px(g, 1, -3, 3, 5, DARK_WARM);
    px(g, -2, -2, 2, 3, wing);
    px(g, 1, -2, 2, 3, shade(wing, 0.85));
  }
  px(g, 0, -3, 1, 6, PALETTE[25]!);
  px(g, -1, -4, 1, 1, PALETTE[25]!);
  px(g, 1, -4, 1, 1, PALETTE[25]!);
  return g;
}

/** A dragonfly, centre at (0, 0): frame 0 wings flat, frame 1 wings forward. Faces right. */
export function drawDragonfly(frame: number): Graphics {
  const g = new Graphics();
  px(g, -8, -1, 14, 3, DARK_WARM);
  px(g, -7, 0, 12, 1, PALETTE[17]!);
  px(g, 4, -2, 3, 4, DARK_WARM);
  px(g, 5, -1, 2, 2, PALETTE[18]!);
  const wy = frame % 2 === 0 ? -4 : -3;
  for (const x of [-1, 2]) {
    px(g, x - 1, wy - 1, 5, 4, DARK_WARM);
    px(g, x, wy, 3, 2, { color: PALETTE[19]!, alpha: 0.75 });
  }
  return g;
}

/** A fish shadow under the water, nose to the right, `size` 0 small, 1 middle, 2 big (a dark oval with a tail and fins). Centre at (0, 0). */
export function drawFishShadow(size = 1): Graphics {
  const g = new Graphics();
  const s = Math.max(0, Math.min(2, Math.round(size)));
  const rx = [6, 9, 13][s]!;
  const ry = [2, 3, 4][s]!;
  const c = { color: PALETTE[24]!, alpha: 0.4 };
  oval(g, 0, 0, rx, ry, c);
  px(g, -rx - 3, -ry, 4, ry * 2, c);
  px(g, -rx - 5, -ry - 1, 2, 2, c);
  px(g, -rx - 5, ry - 1, 2, 2, c);
  px(g, 0, -ry - 2, 3, 2, c);
  return g;
}

/** A falling leaf, centre at (0, 0): kind 0 green, 1 gold, 2 orange; `turn` 0 to 3 is the tumble (flat, tilted, edge-on, tilted). */
export function drawLeaf(kind = 0, turn = 0): Graphics {
  const g = new Graphics();
  const k = ((kind % 3) + 3) % 3;
  const body = [PALETTE[13]!, PALETTE[10]!, PALETTE[9]!][k]!;
  const lit = [PALETTE[12]!, PALETTE[11]!, PALETTE[10]!][k]!;
  const t = ((turn % 4) + 4) % 4;
  if (t === 0) {
    px(g, -3, -2, 6, 4, DARK_WARM);
    px(g, -2, -1, 4, 2, body);
    px(g, -2, -1, 2, 1, lit);
    px(g, 3, 0, 2, 1, DARK_WARM);
  } else if (t === 1 || t === 3) {
    px(g, -2, -3, 4, 6, DARK_WARM);
    px(g, -1, -2, 2, 4, body);
    px(g, -1, -2, 1, 2, lit);
  } else {
    px(g, -3, -1, 6, 2, DARK_WARM);
    px(g, -2, 0, 4, 1, body);
  }
  return g;
}
