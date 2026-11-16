// DA1: crypt props and landmarks drawn in code (cool, dark, few warm lights; Endesga 32 via PALETTE; light from
// the top-left; 1 px dark outline; no anti-aliasing). STABLE API for the dungeon view (DG2):
//   drawProp(kind, variant = 0, clockMs = 0) -> Container   anchor = bottom centre of the footprint (0, 0),
//   the art grows UP (negative y) and sideways (+-w/2). PROP_INFO[kind] = footprint in 32 px blocks, whether it
//   blocks walking (a hint only: the rules decide), and an optional `light` { color, radius, flicker } for the
//   glow-ready kinds (brazier, campfire, candles, fountain, glowcap, torch stand, vault door).
//   drawDecor is the same function under the name of the plan. Variants are 0..PROP_INFO[kind].variants-1
//   (use hash(c, r) % variants); an out-of-range variant wraps. clockMs only moves flames (3 frames, 110 ms).
// No game rule here: kinds are plain strings the generator may choose; unknown kinds draw a small crate-like
// box so an old or new run never breaks.

import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';
import { shade } from '../render/colors.ts';

const P = {
  rust: PALETTE[0]!, clay: PALETTE[1]!, cream: PALETTE[2]!, sand: PALETTE[3]!, oak: PALETTE[4]!, walnut: PALETTE[5]!,
  crimson: PALETTE[7]!, red: PALETTE[8]!, orange: PALETTE[9]!, gold: PALETTE[10]!, butter: PALETTE[11]!,
  lime: PALETTE[12]!, green: PALETTE[13]!, forest: PALETTE[14]!, pine: PALETTE[15]!, navy: PALETTE[16]!, sky: PALETTE[17]!,
  cyan: PALETTE[18]!, white: PALETTE[19]!, silver: PALETTE[20]!, steel: PALETTE[21]!, slate: PALETTE[22]!, dusk: PALETTE[23]!,
  night: PALETTE[24]!, ink: PALETTE[25]!, plum: PALETTE[27]!, orchid: PALETTE[28]!,
};
const OUT = P.ink;
const FLAME_FRAME_MS = 110;

export const PROP_KINDS = [
  'barrel', 'crate', 'bones', 'skull_pile', 'candle_stand', 'candles', 'banner', 'cobweb', 'shelf', 'library_shelf',
  'root', 'glowcap', 'fountain', 'statue', 'brazier_big', 'pillar', 'pillar_ring', 'pillar_variant', 'sarcophagus',
  'crack', 'vault_arch', 'vault_door', 'rubble', 'campfire', 'guard_post', 'arena_mark', 'crypt_garden', 'torch_stand',
  'stairs_up', 'stairs_down',
] as const;
export type PropKind = (typeof PROP_KINDS)[number];

export interface PropInfo {
  /** Footprint in 32 px blocks (w across, d deep). */
  w: number;
  d: number;
  /** Hint: reads as an obstacle. Decals and wall-hung things are false. */
  solid: boolean;
  /** Number of distinct variants (variant wraps). */
  variants: number;
  /** Glow-ready: where the dungeon light layer may add a source (offset from the anchor, y up negative). */
  light?: { color: string; radius: number; dy: number; flicker: boolean };
}

export const PROP_INFO: Record<PropKind, PropInfo> = {
  barrel: { w: 1, d: 1, solid: true, variants: 2 },
  crate: { w: 1, d: 1, solid: true, variants: 3 },
  bones: { w: 1, d: 1, solid: false, variants: 3 },
  skull_pile: { w: 1, d: 1, solid: false, variants: 2 },
  candle_stand: { w: 1, d: 1, solid: true, variants: 2, light: { color: P.orange, radius: 48, dy: -26, flicker: true } },
  candles: { w: 1, d: 1, solid: false, variants: 2, light: { color: P.orange, radius: 36, dy: -8, flicker: true } },
  banner: { w: 1, d: 1, solid: false, variants: 3 },
  cobweb: { w: 1, d: 1, solid: false, variants: 2 },
  shelf: { w: 1, d: 1, solid: true, variants: 2 },
  library_shelf: { w: 2, d: 1, solid: true, variants: 3 },
  root: { w: 1, d: 1, solid: false, variants: 3 },
  glowcap: { w: 1, d: 1, solid: false, variants: 2, light: { color: P.cyan, radius: 44, dy: -8, flicker: false } },
  fountain: { w: 2, d: 2, solid: true, variants: 1, light: { color: P.sky, radius: 80, dy: -30, flicker: false } },
  statue: { w: 1, d: 1, solid: true, variants: 3 },
  brazier_big: { w: 1, d: 1, solid: true, variants: 1, light: { color: P.orange, radius: 120, dy: -34, flicker: true } },
  pillar: { w: 1, d: 1, solid: true, variants: 3 },
  pillar_ring: { w: 3, d: 3, solid: true, variants: 1 },
  pillar_variant: { w: 1, d: 1, solid: true, variants: 4 },
  sarcophagus: { w: 1, d: 2, solid: true, variants: 3 },
  crack: { w: 1, d: 1, solid: false, variants: 3 },
  vault_arch: { w: 2, d: 1, solid: false, variants: 2 },
  vault_door: { w: 2, d: 1, solid: true, variants: 2, light: { color: P.gold, radius: 40, dy: -20, flicker: false } },
  rubble: { w: 1, d: 1, solid: false, variants: 3 },
  campfire: { w: 1, d: 1, solid: true, variants: 1, light: { color: P.orange, radius: 96, dy: -12, flicker: true } },
  guard_post: { w: 2, d: 1, solid: true, variants: 2, light: { color: P.orange, radius: 50, dy: -28, flicker: true } },
  arena_mark: { w: 2, d: 2, solid: false, variants: 3 },
  crypt_garden: { w: 2, d: 1, solid: false, variants: 2, light: { color: P.cyan, radius: 40, dy: -8, flicker: false } },
  torch_stand: { w: 1, d: 1, solid: true, variants: 2, light: { color: P.orange, radius: 90, dy: -40, flicker: true } },
  stairs_up: { w: 1, d: 1, solid: false, variants: 2 },
  stairs_down: { w: 1, d: 1, solid: false, variants: 2 },
};

// ---- helpers (all coordinates relative to the anchor; x centred, y up is negative) ----
function r(g: Graphics, x: number, y: number, w: number, h: number, c: string): void {
  g.rect(Math.round(x), Math.round(y), w, h).fill(c);
}
/** Outlined lit box: left edge and top edge lighter (light top-left), right and bottom darker. */
function slab(g: Graphics, x: number, y: number, w: number, h: number, c: string): void {
  r(g, x - 1, y - 1, w + 2, h + 2, OUT);
  r(g, x, y, w, h, c);
  r(g, x, y, w, 1, shade(c, 1.35));
  r(g, x, y, 1, h, shade(c, 1.2));
  r(g, x + w - 1, y + 1, 1, h - 1, shade(c, 0.8));
  r(g, x + 1, y + h - 1, w - 1, 1, shade(c, 0.75));
}
/** Pixel ellipse from rows with a 1 px outline and a lit top. */
function blob(g: Graphics, cx: number, cy: number, rx: number, ry: number, c: string): void {
  const rowHalf = (i: number, rr: number): number => {
    const dy = i + 0.5 - ry;
    return Math.round(rr * Math.sqrt(Math.max(0, 1 - (dy / ry) * (dy / ry))));
  };
  for (let i = 0; i < ry * 2; i++) {
    const hw = rowHalf(i, rx + 1);
    if (hw > 0) r(g, cx - hw, cy - ry + i, hw * 2, 1, OUT);
  }
  for (let i = 0; i < ry * 2; i++) {
    const hw = rowHalf(i, rx);
    if (hw > 0) r(g, cx - hw, cy - ry + i, hw * 2, 1, i < ry * 0.6 ? shade(c, 1.2) : c);
  }
}
function shadowOval(g: Graphics, w: number): void {
  for (let i = 0; i < 3; i++) {
    const hw = Math.round((w / 2) * [0.7, 1, 0.7][i]!);
    g.rect(-hw, -2 + i, hw * 2, 1).fill({ color: OUT, alpha: 0.35 });
  }
}
function flame(g: Graphics, cx: number, by: number, clockMs: number, size = 1): void {
  const f = Math.floor(Math.max(0, clockMs) / FLAME_FRAME_MS) % 3;
  const lean = [0, 1, -1][f]!;
  const t = ([6, 7, 5][f]!) * size;
  r(g, cx - 2 * size, by - t + 1, 4 * size, t - 1, P.orange);
  r(g, cx - size + lean, by - t, 2 * size, 2, P.orange);
  r(g, cx - size, by - t + 3, 2 * size, t - 3, P.gold);
  r(g, cx, by - 2, size, 2, P.butter);
}
function pick<T>(list: readonly T[], v: number): T {
  return list[((v % list.length) + list.length) % list.length]!;
}

type Maker = (g: Graphics, v: number, t: number) => void;

const MAKERS: Record<PropKind, Maker> = {
  barrel(g, v) {
    shadowOval(g, 22);
    const c = pick([P.walnut, P.oak], v);
    r(g, -8, -22, 16, 21, OUT);
    r(g, -7, -21, 14, 19, c);
    r(g, -7, -21, 3, 19, shade(c, 1.25));
    r(g, 4, -21, 3, 19, shade(c, 0.78));
    for (const y of [-18, -8]) { r(g, -8, y, 16, 2, OUT); r(g, -7, y, 14, 1, P.steel); }
    r(g, -6, -23, 12, 3, OUT); r(g, -5, -22, 10, 2, shade(c, 1.35)); // lid ring
    if (v === 1) r(g, -1, -14, 2, 3, P.ink); // bung hole
  },
  crate(g, v) {
    shadowOval(g, 24);
    const c = pick([P.oak, P.walnut, P.sand], v);
    slab(g, -9, -18, 18, 17, c);
    r(g, -9, -10, 18, 1, shade(c, 0.7)); // plank seam
    r(g, -9, -18, 3, 17, shade(c, 0.85)); r(g, 6, -18, 3, 17, shade(c, 0.85)); // frame
    r(g, -2, -9, 4, 1, P.steel); // nail band
    if (v === 2) r(g, -9, -18, 18, 2, shade(P.sand, 0.9)); // broken lid
  },
  bones(g, v) {
    shadowOval(g, 20);
    const sets: [number, number, number, number][][] = [
      [[-8, -4, 7, 2], [-3, -6, 2, 5], [2, -3, 7, 2]],
      [[-9, -3, 9, 2], [1, -4, 6, 2], [-4, -7, 2, 6]],
      [[-6, -3, 12, 2], [-2, -6, 4, 2], [3, -7, 2, 5]],
    ];
    for (const [x, y, w, h] of pick(sets, v)) { r(g, x - 1, y - 1, w + 2, h + 2, OUT); }
    for (const [x, y, w, h] of pick(sets, v)) { r(g, x, y, w, h, P.silver); r(g, x, y, w, 1, P.white); }
    r(g, -2, -10, 6, 5, OUT); r(g, -1, -9, 4, 3, P.white); r(g, -1, -8, 1, 1, P.ink); r(g, 2, -8, 1, 1, P.ink); // a skull
  },
  skull_pile(g, v) {
    shadowOval(g, 24);
    const skull = (x: number, y: number): void => {
      r(g, x - 1, y - 1, 8, 8, OUT); r(g, x, y, 6, 5, P.white); r(g, x, y + 4, 6, 2, P.silver);
      r(g, x + 1, y + 2, 1, 1, P.ink); r(g, x + 4, y + 2, 1, 1, P.ink); r(g, x + 2, y + 5, 2, 1, P.steel);
    };
    skull(-10, -8); skull(1, -8); skull(-5, -14);
    if (v === 1) skull(5, -14);
    r(g, -10, -3, 20, 2, P.silver);
  },
  candle_stand(g, v, t) {
    shadowOval(g, 14);
    r(g, -4, -3, 8, 3, OUT); r(g, -3, -3, 6, 2, P.steel); // foot
    r(g, -1, -20, 2, 17, OUT); r(g, 0, -20, 1, 17, P.steel); // stem
    r(g, -6, -22, 12, 3, OUT); r(g, -5, -22, 10, 2, P.silver); // dish
    r(g, -4, -28, 3, 6, P.cream); r(g, 2, -26, 3, 4, P.cream);
    if (v === 1) r(g, -1, -30, 3, 8, P.cream);
    flame(g, -3, -28, t, 1); flame(g, 3, -26, t + 40, 1);
  },
  candles(g, v, t) {
    shadowOval(g, 14);
    const list: [number, number][] = v ? [[-6, 4], [-1, 7], [4, 5]] : [[-4, 5], [3, 6]];
    for (const [x, h] of list) { r(g, x - 1, -h - 1, 4, h + 1, OUT); r(g, x, -h, 2, h, P.cream); r(g, x, -h, 1, h, P.white); r(g, x, 0, 3, 1, P.sand); flame(g, x + 1, -h, t + x * 30, 1); }
    r(g, -8, -1, 16, 1, P.sand); // spilled wax
  },
  banner(g, v) {
    const c = pick([P.crimson, P.navy, P.forest], v);
    r(g, -9, -30, 18, 2, OUT); r(g, -8, -30, 16, 1, P.steel); // rod
    r(g, -7, -29, 14, 27, OUT);
    r(g, -6, -28, 12, 25, c); r(g, -6, -28, 3, 25, shade(c, 1.25)); r(g, 3, -28, 3, 25, shade(c, 0.8));
    r(g, -6, -3, 4, 3, OUT); r(g, -2, -3, 4, 1, OUT); r(g, 2, -3, 4, 3, OUT); // swallowtail
    r(g, -5, -3, 2, 2, c); r(g, 3, -3, 2, 2, c);
    r(g, -2, -20, 4, 8, P.gold); r(g, -1, -18, 2, 4, c); // emblem
    if (v === 2) { r(g, -6, -9, 12, 1, P.gold); r(g, -6, -26, 12, 1, P.gold); }
  },
  cobweb(g, v) {
    const col = P.silver;
    const a = 0.75;
    const line = (x0: number, y0: number, x1: number, y1: number): void => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let i = 0; i <= n; i++) g.rect(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), 1, 1).fill({ color: col, alpha: a });
    };
    const ox = v ? 0 : -15; const oy = -30; // the corner it hangs in
    const s = v ? -1 : 1;
    line(ox, oy, ox + s * 28, oy); line(ox, oy, ox, oy + 28); line(ox, oy, ox + s * 20, oy + 20);
    line(ox + s * 10, oy, ox, oy + 10); line(ox + s * 20, oy, ox, oy + 20); line(ox + s * 14, oy + 14, ox + s * 14, oy + 14);
    line(ox + s * 14, oy, ox + s * 8, oy + 8); line(ox, oy + 14, ox + s * 8, oy + 8);
  },
  shelf(g, v) {
    shadowOval(g, 26);
    slab(g, -12, -30, 24, 29, P.walnut);
    for (const y of [-21, -11]) { r(g, -11, y, 22, 2, OUT); r(g, -11, y, 22, 1, P.oak); }
    const stuff = [P.red, P.sand, P.forest, P.silver, P.navy];
    for (let i = 0; i < 4; i++) { r(g, -10 + i * 5, -26, 4, 5, pick(stuff, i + v)); r(g, -10 + i * 5, -26, 4, 1, shade(pick(stuff, i + v), 1.3)); }
    r(g, -9, -16, 6, 5, P.sand); r(g, 0, -15, 3, 4, P.silver); r(g, 5, -16, 5, 5, P.clay);
    r(g, -9, -6, 8, 5, P.steel); r(g, 2, -6, 8, 5, P.dusk);
  },
  library_shelf(g, v) {
    shadowOval(g, 54);
    slab(g, -28, -38, 56, 37, P.walnut);
    for (const y of [-26, -14]) { r(g, -27, y, 54, 2, OUT); r(g, -27, y, 54, 1, P.oak); }
    const books = [P.crimson, P.forest, P.navy, P.rust, P.plum, P.sand, P.slate];
    for (const [rowY, rowH] of [[-37, 10], [-25, 10], [-13, 11]] as [number, number][]) {
      let x = -27; let i = rowY * -1 + v;
      while (x < 25) {
        const w = 3 + ((i * 7) % 3); const h = rowH - ((i * 5) % 4);
        const c = pick(books, i);
        r(g, x, rowY + (rowH - h), w, h, c); r(g, x, rowY + (rowH - h), 1, h, shade(c, 1.3));
        if ((i + v) % 5 === 0) x += 3; // a gap
        x += w; i += 3;
      }
    }
    if (v === 2) { r(g, -4, -13, 8, 3, P.cream); r(g, -4, -13, 8, 1, P.white); } // a book lying flat
  },
  root(g, v) {
    const c = pick([P.walnut, P.oak, P.dusk], v);
    const seg = (x: number, y: number, w: number, h: number): void => { r(g, x - 1, y - 1, w + 2, h + 2, OUT); r(g, x, y, w, h, c); r(g, x, y, w, 1, shade(c, 1.3)); };
    seg(-10, -4, 8, 3); seg(-4, -9, 3, 7); seg(-1, -13, 7, 3); seg(4, -17, 3, 6); seg(-12, -2, 24, 2);
    r(g, -3, -6, 1, 1, P.forest);
  },
  glowcap(g, v, t) {
    shadowOval(g, 18);
    const glow = 0.18 + 0.05 * Math.sin(t / 500);
    g.rect(-12, -20, 24, 20).fill({ color: P.cyan, alpha: glow });
    const cap = (x: number, h: number, w: number): void => {
      r(g, x - 1, -h - 1, 3, h + 1, OUT); r(g, x, -h, 1, h, P.silver);
      blob(g, x, -h - 1, w, 3, P.cyan);
      r(g, x - w + 2, -h - 3, 2, 1, P.white);
    };
    cap(-5, 6, 5); cap(4, 10, 6);
    if (v) cap(9, 4, 3);
  },
  fountain(g, _v, t) {
    shadowOval(g, 62);
    blob(g, 0, -10, 28, 9, P.steel); // basin rim
    blob(g, 0, -11, 22, 6, P.navy); // water
    blob(g, 0, -12, 17, 4, P.sky);
    const sh = Math.floor(t / 300) % 2;
    r(g, -8 + sh * 3, -11, 5, 1, P.white); r(g, 5 - sh * 2, -13, 4, 1, P.cyan);
    r(g, -4, -34, 8, 22, OUT); r(g, -3, -33, 6, 20, P.slate); r(g, -3, -33, 2, 20, P.steel); // pedestal
    blob(g, 0, -34, 9, 4, P.steel); blob(g, 0, -35, 6, 2, P.sky);
    for (let i = 0; i < 3; i++) r(g, i % 2 ? 1 : -2, -44 + ((Math.floor(t / 90) + i * 4) % 12), 1, 2, P.white); // spout drops
    r(g, -1, -44, 2, 9, P.cyan);
    r(g, -8, -22, 1, 5 + sh, P.sky); r(g, 7, -22, 1, 5 + (1 - sh), P.sky);
  },
  statue(g, v) {
    shadowOval(g, 22);
    slab(g, -9, -8, 18, 7, P.slate); // plinth
    const c = pick([P.silver, P.steel, P.dusk], v);
    r(g, -5, -34, 10, 26, OUT); r(g, -4, -33, 8, 25, c); r(g, -4, -33, 3, 25, shade(c, 1.2)); r(g, 2, -33, 2, 25, shade(c, 0.78));
    blob(g, 0, -37, 4, 4, c);
    if (v === 0) { r(g, 4, -30, 2, 18, P.steel); r(g, 3, -32, 4, 3, OUT); r(g, 4, -31, 2, 1, P.silver); } // sword
    if (v === 1) { r(g, -9, -30, 4, 12, c); r(g, -9, -30, 1, 12, OUT); } // robed arm raised
    if (v === 2) { r(g, -5, -20, 10, 2, OUT); r(g, -4, -19, 8, 1, P.forest); } // moss sash
    r(g, -2, -38, 1, 1, OUT); r(g, 1, -38, 1, 1, OUT);
  },
  brazier_big(g, _v, t) {
    shadowOval(g, 30);
    r(g, -9, -3, 18, 3, OUT); r(g, -8, -3, 16, 2, P.steel); // base
    r(g, -3, -16, 6, 13, OUT); r(g, -2, -16, 4, 12, P.slate); r(g, -2, -16, 1, 12, P.steel); // stem
    r(g, -12, -24, 24, 9, OUT); r(g, -11, -23, 22, 7, P.dusk); r(g, -11, -23, 22, 1, P.steel); r(g, -11, -23, 1, 7, P.steel); // bowl
    r(g, -10, -26, 20, 4, P.red); r(g, -8, -28, 16, 3, P.orange); // embers
    flame(g, -4, -26, t, 2); flame(g, 5, -25, t + 55, 1); flame(g, 0, -28, t + 20, 2);
    r(g, -12, -14, 24, 1, P.steel);
  },
  pillar(g, v) {
    shadowOval(g, 26);
    const c = P.slate;
    r(g, -9, -4, 18, 4, OUT); r(g, -8, -4, 16, 3, shade(c, 1.1)); // base
    r(g, -7, -48, 14, 44, OUT); r(g, -6, -48, 12, 44, c); r(g, -6, -48, 4, 44, shade(c, 1.3)); r(g, 3, -48, 3, 44, shade(c, 0.75));
    r(g, -9, -54, 18, 6, OUT); r(g, -8, -54, 16, 5, shade(c, 1.15)); r(g, -8, -54, 16, 1, P.steel); // capital
    for (const y of [-40, -28, -16]) r(g, -6, y, 12, 1, shade(c, 0.7)); // drum joints
    if (v === 1) { r(g, -6, -8, 5, 1, P.forest); r(g, -6, -9, 2, 1, P.pine); r(g, 1, -30, 2, 12, P.forest); } // moss
    if (v === 2) { r(g, 0, -44, 1, 12, OUT); r(g, 1, -33, 1, 8, OUT); r(g, -1, -36, 1, 3, OUT); } // crack
  },
  pillar_ring(g, v, t) {
    // A circle of five short pillars round an altar tile (3x3 blocks).
    const pts: [number, number][] = [[-30, -30], [30, -30], [-34, -2], [34, -2], [0, 0]];
    pts.sort((a, b) => a[1] - b[1]);
    r(g, -14, -34, 28, 14, OUT); r(g, -13, -33, 26, 12, P.dusk); r(g, -13, -33, 26, 1, P.steel); // altar slab
    r(g, -10, -31, 20, 1, P.slate); r(g, -3, -30, 6, 8, P.plum); r(g, -1, -29, 2, 6, P.orchid);
    for (const [x, y] of pts) {
      const gg = new Graphics(); MAKERS.pillar(gg, v, t); gg.scale.set(0.6); gg.position.set(x, y); g.addChild(gg);
    }
    flame(g, 0, -36, t, 1);
  },
  pillar_variant(g, v) {
    shadowOval(g, 22);
    const c = P.slate;
    if (v === 0) { // broken stump
      r(g, -8, -4, 16, 4, OUT); r(g, -7, -4, 14, 3, shade(c, 1.1));
      r(g, -6, -22, 12, 18, OUT); r(g, -5, -21, 10, 17, c); r(g, -5, -21, 3, 17, shade(c, 1.3));
      r(g, -5, -24, 4, 3, c); r(g, 1, -22, 4, 1, shade(c, 1.2)); r(g, 8, -3, 4, 2, c); r(g, -11, -2, 3, 2, shade(c, 0.9));
    } else if (v === 1) { // twisted rope column
      r(g, -7, -44, 14, 44, OUT); r(g, -6, -44, 12, 44, c);
      for (let y = -44; y < -4; y += 4) { r(g, -6, y, 12, 1, shade(c, 0.7)); r(g, -6 + ((y / 4) & 1) * 3, y + 1, 5, 2, shade(c, 1.3)); }
      r(g, -9, -4, 18, 4, OUT); r(g, -8, -4, 16, 3, shade(c, 1.1)); r(g, -9, -50, 18, 6, OUT); r(g, -8, -50, 16, 5, shade(c, 1.15));
    } else if (v === 2) { // pillar with a candle shelf
      MAKERS.pillar(g, 0, 0);
      r(g, 5, -30, 7, 2, OUT); r(g, 6, -30, 5, 1, P.steel); r(g, 7, -35, 2, 5, P.cream); r(g, 7, -37, 2, 2, P.orange);
    } else { // alcove: a dark niche with a skull inside
      slab(g, -10, -42, 20, 41, c);
      r(g, -6, -34, 12, 18, OUT); r(g, -5, -33, 10, 16, P.night); r(g, -5, -33, 10, 2, P.ink);
      r(g, -2, -23, 5, 5, P.silver); r(g, -1, -21, 1, 1, P.ink); r(g, 1, -21, 1, 1, P.ink);
    }
  },
  sarcophagus(g, v) {
    shadowOval(g, 36);
    const c = pick([P.steel, P.dusk, P.silver], v);
    slab(g, -14, -18, 28, 17, shade(c, 0.9)); // chest
    slab(g, -15, -26, 30, 10, c); // lid
    r(g, -12, -24, 24, 1, shade(c, 1.4));
    r(g, -2, -25, 4, 8, shade(c, 0.75)); r(g, -6, -21, 12, 2, shade(c, 0.75)); // cross-like carving
    if (v === 1) { r(g, 6, -28, 10, 4, OUT); r(g, 6, -27, 9, 2, c); r(g, 10, -17, 2, 8, OUT); } // lid pushed ajar
    if (v === 2) r(g, -14, -9, 10, 1, P.forest);
    r(g, -14, -3, 28, 1, shade(c, 0.6));
  },
  crack(g, v) {
    const pts = pick([
      [[-10, -6], [-6, -9], [-3, -5], [1, -8], [5, -4], [10, -7]],
      [[-8, -2], [-5, -6], [-6, -10], [-2, -13], [2, -10], [3, -16]],
      [[-11, -12], [-6, -8], [-1, -10], [3, -5], [8, -6], [11, -2]],
    ] as [number, number][][], v);
    for (let i = 0; i < pts.length - 1; i++) {
      const [x0, y0] = pts[i]!; const [x1, y1] = pts[i + 1]!;
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) g.rect(Math.round(x0 + ((x1 - x0) * k) / n), Math.round(y0 + ((y1 - y0) * k) / n), 1, 1).fill({ color: P.ink, alpha: 0.85 });
    }
  },
  vault_arch(g, v) {
    const c = P.steel;
    r(g, -30, -52, 60, 52, OUT);
    r(g, -29, -51, 58, 51, shade(c, 0.9));
    // stone voussoirs along the curve
    for (let i = 0; i < 9; i++) {
      const a = (Math.PI * i) / 8;
      const x = Math.round(-23 * Math.cos(a)); const y = Math.round(-30 - 18 * Math.sin(a));
      r(g, x - 2, y - 2, 5, 5, i % 2 ? shade(c, 1.1) : shade(c, 0.8));
    }
    r(g, -17, -40, 34, 40, OUT); r(g, -16, -39, 32, 39, P.ink); // opening
    blob(g, 0, -40, 16, 8, P.ink);
    r(g, -16, -39, 32, 3, P.night);
    r(g, -4, -52, 8, 4, P.gold); r(g, -3, -51, 6, 2, P.butter); // keystone
    if (v === 1) { r(g, -26, -20, 2, 12, P.forest); r(g, -24, -14, 2, 8, P.pine); }
  },
  vault_door(g, v, t) {
    const c = P.slate;
    MAKERS.vault_arch(g, 0, t);
    r(g, -16, -39, 32, 39, OUT);
    r(g, -15, -38, 30, 38, P.dusk);
    for (let x = -14; x < 14; x += 7) { r(g, x, -38, 5, 38, shade(P.dusk, 1.1)); r(g, x, -38, 1, 38, shade(P.dusk, 1.35)); }
    for (const y of [-32, -16, -4]) { r(g, -15, y, 30, 3, OUT); r(g, -15, y, 30, 1, P.steel); }
    r(g, -4, -26, 8, 10, OUT); r(g, -3, -25, 6, 8, P.gold); r(g, -3, -25, 6, 1, P.butter); r(g, -1, -22, 2, 4, P.ink); // lock
    const pulse = 0.2 + 0.1 * Math.sin(t / 400);
    if (v === 1) g.rect(-16, -39, 32, 39).fill({ color: P.gold, alpha: pulse }); // ajar and glowing
    r(g, -17, -2, 34, 2, shade(c, 0.9));
  },
  rubble(g, v) {
    shadowOval(g, 22);
    const stones: [number, number, number, number][] = [[-9, -5, 7, 5], [-1, -7, 8, 7], [5, -4, 6, 4], [-4, -3, 5, 3], [-12, -2, 4, 2]];
    const c = pick([P.slate, P.dusk, P.steel], v);
    for (const [x, y, w, h] of stones) slab(g, x, y, w, h, c);
    if (v === 2) r(g, 2, -9, 2, 2, P.silver);
  },
  campfire(g, _v, t) {
    shadowOval(g, 30);
    for (let i = 0; i < 8; i++) { const a = (Math.PI * 2 * i) / 8; const x = Math.round(Math.cos(a) * 10); const y = Math.round(Math.sin(a) * 4) - 3; slab(g, x - 2, y - 2, 5, 4, i % 2 ? P.slate : P.dusk); }
    r(g, -8, -9, 16, 3, OUT); r(g, -7, -9, 14, 2, P.walnut); // logs
    r(g, -4, -12, 3, 6, OUT); r(g, 2, -12, 3, 6, OUT); r(g, -3, -11, 1, 4, P.oak); r(g, 3, -11, 1, 4, P.oak);
    r(g, -6, -7, 12, 2, P.red);
    flame(g, -3, -9, t, 2); flame(g, 3, -8, t + 60, 1); flame(g, 0, -10, t + 30, 2);
    const s = Math.floor(t / 250) % 4; r(g, -2 + s, -26 - s, 1, 1, P.silver);
  },
  guard_post(g, v, t) {
    shadowOval(g, 50);
    slab(g, -22, -10, 44, 9, P.walnut); // low table
    r(g, -22, -10, 44, 2, P.oak);
    r(g, -12, -16, 5, 6, P.silver); r(g, -11, -15, 3, 3, P.cream); // mug
    r(g, 2, -14, 8, 4, P.cream); r(g, 2, -14, 8, 1, P.white); // map
    slab(g, -20, -22, 4, 22, P.walnut); // rack post
    r(g, -22, -20, 8, 2, P.steel); r(g, -21, -34, 2, 14, P.silver); r(g, -22, -36, 4, 3, P.steel); // spear
    if (v === 1) { r(g, 14, -26, 7, 8, OUT); r(g, 15, -25, 5, 6, P.crimson); r(g, 17, -24, 1, 4, P.gold); } // shield
    r(g, 14, -12, 3, 2, P.orange); flame(g, 15, -13, t, 1);
  },
  arena_mark(g, v) {
    // A flat ring of worn runes on the floor: dark inner ring, pale chips, rust stains.
    const ring = (rx: number, ry: number, col: string, a: number): void => {
      for (let i = 0; i < 48; i++) { const an = (Math.PI * 2 * i) / 48; g.rect(Math.round(Math.cos(an) * rx), Math.round(Math.sin(an) * ry) - 30, 1, 1).fill({ color: col, alpha: a }); }
    };
    ring(30, 18, P.ink, 0.9); ring(29, 17, P.steel, 0.5); ring(18, 11, P.ink, 0.7);
    for (let i = 0; i < 8; i++) { const an = (Math.PI * 2 * i) / 8 + v * 0.2; g.rect(Math.round(Math.cos(an) * 24), Math.round(Math.sin(an) * 14) - 31, 2, 2).fill({ color: P.silver, alpha: 0.6 }); }
    g.rect(-3, -33, 6, 6).fill({ color: P.crimson, alpha: 0.35 });
    if (v === 1) { g.rect(8, -26, 5, 3).fill({ color: P.rust, alpha: 0.4 }); }
    if (v === 2) { r(g, -1, -34, 2, 8, P.ink); r(g, -4, -31, 8, 2, P.ink); }
  },
  crypt_garden(g, v, t) {
    shadowOval(g, 54);
    slab(g, -26, -8, 52, 7, P.dusk); // stone bed edge
    r(g, -24, -11, 48, 4, OUT); r(g, -23, -10, 46, 3, P.walnut); r(g, -23, -10, 46, 1, P.dusk); // soil
    const plants = [-18, -8, 2, 12, 20];
    plants.forEach((x, i) => {
      const h = 6 + ((i + v) % 3) * 3;
      r(g, x, -10 - h, 1, h, P.forest);
      r(g, x - 2, -10 - h, 2, 2, P.green); r(g, x + 1, -8 - h, 3, 2, P.green);
      if ((i + v) % 2) { r(g, x - 1, -13 - h, 3, 3, P.cyan); r(g, x, -12 - h, 1, 1, P.white); }
      else r(g, x - 1, -12 - h, 3, 3, P.plum);
    });
    g.rect(-26, -22, 52, 14).fill({ color: P.cyan, alpha: 0.06 + 0.03 * Math.sin(t / 600) });
  },
  torch_stand(g, v, t) {
    shadowOval(g, 14);
    r(g, -4, -3, 8, 3, OUT); r(g, -3, -3, 6, 2, P.steel);
    r(g, -2, -34, 4, 31, OUT); r(g, -1, -34, 2, 30, P.walnut); r(g, -1, -34, 1, 30, P.oak);
    r(g, -4, -36, 8, 3, OUT); r(g, -3, -36, 6, 2, P.steel); // iron cup
    r(g, -4, -22, 8, 1, P.steel);
    flame(g, 0, -37, t, v ? 2 : 1);
  },
  stairs_up(g, v) { stairs(g, v, true); },
  stairs_down(g, v) { stairs(g, v, false); },
};

function stairs(g: Graphics, v: number, up: boolean): void {
  // A 32 px block: steps seen from the front. Down = dark pit below, up = pale steps rising into the wall.
  const c = P.steel;
  r(g, -16, -32, 32, 32, OUT);
  r(g, -15, -31, 30, 30, P.ink);
  for (let i = 0; i < 5; i++) {
    const y = up ? -4 - i * 6 : -28 + i * 6;
    const h = 6;
    const k = up ? 1 - i * 0.1 : 0.55 + i * 0.12;
    r(g, -14 + (up ? i : 0), y, 28 - (up ? i * 2 : 0), h, shade(c, k));
    r(g, -14 + (up ? i : 0), y, 28 - (up ? i * 2 : 0), 1, shade(c, k * 1.35));
    r(g, -14 + (up ? i : 0), y + h - 1, 28 - (up ? i * 2 : 0), 1, shade(c, k * 0.6));
  }
  if (v === 1) { r(g, -15, -31, 3, 30, P.slate); r(g, 12, -31, 3, 30, P.slate); } // side walls
  if (!up) r(g, -14, -31, 28, 3, P.night);
}

/**
 * Draws one prop at the anchor (0, 0) = bottom centre of its footprint. `variant` wraps, `clockMs` only moves
 * flames and glows. Unknown kinds draw a small grey box. Never throws.
 */
export function drawProp(kind: PropKind | string, variant = 0, clockMs = 0): Container {
  const root = new Container();
  root.label = `prop:${kind}`;
  const g = new Graphics();
  const info = (PROP_INFO as Record<string, PropInfo | undefined>)[kind];
  const v = info ? ((Math.floor(variant) % info.variants) + info.variants) % info.variants : 0;
  const maker = (MAKERS as Record<string, Maker | undefined>)[kind];
  if (maker) maker(g, v, clockMs);
  else { shadowOval(g, 20); slab(g, -8, -14, 16, 13, P.dusk); }
  root.addChild(g);
  return root;
}

/** The name the plan and the dungeon view use for the hook. Same function. */
export const drawDecor = drawProp;

/** The light source of a prop kind, if it has one (dungeon light layer reads this; no rule). */
export function propLight(kind: string): PropInfo['light'] | undefined {
  return (PROP_INFO as Record<string, PropInfo | undefined>)[kind]?.light;
}

/** Dev contact sheet: every kind and variant in rows (for the debug view or a dev page). */
export function drawPropSheet(clockMs = 0): Container {
  const sheet = new Container();
  let y = 70;
  for (const kind of PROP_KINDS) {
    const n = PROP_INFO[kind].variants;
    for (let v = 0; v < n; v++) {
      const p = drawProp(kind, v, clockMs);
      p.position.set(40 + v * 80 + (PROP_INFO[kind].w > 1 ? 20 : 0), y);
      sheet.addChild(p);
    }
    y += 70;
  }
  return sheet;
}
