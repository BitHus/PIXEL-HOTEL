// Prop animation (docs/PLAN-ANIMATION.md): the PURE half. Which furniture animates, where, and the numbers of every loop: flame frame
// bitmaps, flicker timing, particle recipes, the register's drawer and glint timing, the tap drip, steam spots. No Pixi, no clock, no
// randomness of its own (an rng and the time are passed in), so it is all unit-tested. propAnim.ts draws it.

import { FLICKER_BRIGHTNESS, LIGHT_STEP_MS } from '@pixel-hotel/shared';
import { flickerAt, hash01 } from './atmosphere.ts';

/** 0 = everything; 1 = Reduce effects (no particles, flames still loop); 2 = OS reduced motion (no particles, flames hold still). */
export type MotionLevel = 0 | 1 | 2;

export function motionLevel(reduceEffects: boolean, osReduced: boolean): MotionLevel {
  return osReduced ? 2 : reduceEffects ? 1 : 0;
}

// ---------- Flames: frame loops of built-once textures ----------

export type FlameKind = 'tiny' | 'ghost' | 'torch' | 'fire_med' | 'fire_big' | 'stove_window';
export const FLAME_FRAME_COUNT = 4;
/** Frame size in px. Frame 0 is the tallest, the LAST frame the shortest (the one shown when the light dips). */
export const FLAME_SIZE: Record<FlameKind, { w: number; h: number }> = {
  tiny: { w: 3, h: 5 },
  ghost: { w: 3, h: 5 },
  torch: { w: 6, h: 10 },
  fire_med: { w: 12, h: 8 },
  fire_big: { w: 22, h: 14 },
  stove_window: { w: 14, h: 9 },
};

/** Letters of the bitmaps -> Endesga 32 palette index. */
export const FLAME_LETTER: Record<string, number> = { w: 11, y: 10, r: 9, R: 8, d: 7, e: 9, c: 5 };
/** The cold ghost flame (skull lamp) swaps the warm letters for cyan, white and blue. */
export const GHOST_LETTER: Record<string, number> = { w: 19, y: 18, r: 17, R: 17 };

const TINY: readonly (readonly string[])[] = [
  ['.r.', '.y.', 'ywy', 'ywy', '.y.'],
  ['...', 'r..', 'yy.', 'ywy', '.y.'],
  ['...', '..r', '.yy', 'ywy', '.y.'],
  ['...', '...', '.r.', 'ywy', '.y.'],
];
const TORCH: readonly (readonly string[])[] = [
  ['..r...', '..yr..', '.ryy..', '.ryyr.', 'ryyyyr', 'rywwyr', 'rywwyr', 'ryywyr', '.ryyr.', '..rr..'],
  ['...r..', '..ry..', '..yyr.', '.ryyr.', '.ryyyr', 'rywwyr', 'rywwyr', 'ryywyr', '.ryyr.', '..rr..'],
  ['.r....', '.yr...', '.yyr..', '.ryyr.', 'ryyyr.', 'rywwyr', 'rywwyr', 'ryywyr', '.ryyr.', '..rr..'],
  ['......', '......', '..r...', '..yr..', '.ryyr.', 'ryyyyr', 'rywwyr', 'ryywyr', '.ryyr.', '..rr..'],
];

/** A fire made of 2 px wide tongues: a bell-shaped profile times a per-tongue height that changes per frame. The last frame is the low one. */
function fireRows(w: number, h: number, frame: number, bg: string): string[] {
  const rows: string[][] = Array.from({ length: h }, () => Array<string>(w).fill(bg));
  const mid = (w - 1) / 2;
  const low = frame === FLAME_FRAME_COUNT - 1 ? 0.72 : 1;
  for (let x = 0; x < w; x++) {
    const edge = Math.abs(x - mid) / (mid + 1);
    const bell = 1 - edge ** 1.6;
    const tongue = 0.6 + 0.4 * hash01(frame * 31 + 5, Math.floor(x / 2) + 9);
    const hx = Math.max(edge < 0.8 ? 2 : 1, Math.round(h * bell * tongue * low));
    for (let k = 0; k < hx; k++) {
      const rel = k / hx;
      let letter = rel < 0.28 ? 'w' : rel < 0.6 ? 'y' : rel < 0.85 || hx < 4 ? 'r' : 'R';
      if (letter === 'w' && edge > 0.6) letter = 'y';
      rows[h - 1 - k]![x] = letter;
    }
  }
  return rows.map((r) => r.join(''));
}

/** The picture of a flame frame: rows of letters ('.' = clear). Pure. */
export function flameRows(kind: FlameKind, frame: number): string[] {
  const f = ((frame % FLAME_FRAME_COUNT) + FLAME_FRAME_COUNT) % FLAME_FRAME_COUNT;
  switch (kind) {
    case 'tiny':
    case 'ghost':
      return [...TINY[f]!];
    case 'torch':
      return [...TORCH[f]!];
    case 'fire_med':
      return fireRows(12, 8, f, '.');
    case 'fire_big':
      return fireRows(22, 14, f, '.');
    case 'stove_window':
      return fireRows(14, 9, f, 'd');
  }
}

/** How long a flame holds one frame: each flame has its own pace (100 to 150 ms) so two never beat together. */
export function flameStepMs(seed: number): number {
  return 100 + Math.round(hash01(seed, 77) * 50);
}

/**
 * The frame a flame shows at a time. It picks by its own steps; when the room light of the same item dips (atmosphere.flickerAt, the same seed
 * and amount the light uses) it takes the short last frame, so the flame and the glow agree. `hold` (OS reduced motion) freezes it on frame 0.
 */
export function flameFrame(seed: number, clockMs: number, flicker: number, hold: boolean): number {
  if (hold) return 0;
  const f = flickerAt(seed, clockMs, flicker);
  if (flicker > 0 && f.brightness < 1 - FLICKER_BRIGHTNESS * flicker * 0.6) return FLAME_FRAME_COUNT - 1;
  const step = Math.floor(clockMs / flameStepMs(seed));
  return Math.floor(hash01(seed + 313, step) * (FLAME_FRAME_COUNT - 1));
}

// ---------- Particles ----------

export type EmitKind = 'smoke' | 'steam' | 'ember' | 'spark' | 'bubble' | 'mote';

export interface Spawn {
  /** Offset from the emitter point. */
  dx: number;
  dy: number;
  vx: number;
  vy: number;
  lifeMs: number;
  size: number;
  /** Palette index. */
  color: number;
}

/** One new particle of a kind. `rnd` returns [0, 1). Pure: the same rnd gives the same particle. */
export function spawnFor(kind: EmitKind, rnd: () => number): Spawn {
  const r = (a: number, b: number): number => a + (b - a) * rnd();
  switch (kind) {
    case 'smoke':
      return { dx: r(-2, 2), dy: 0, vx: r(-3, 3), vy: -r(9, 14), lifeMs: r(1800, 2600), size: rnd() < 0.5 ? 3 : 2, color: rnd() < 0.5 ? 21 : 22 };
    case 'steam':
      return { dx: r(-3, 3), dy: 0, vx: r(-2, 2), vy: -r(10, 16), lifeMs: r(1100, 1700), size: 2, color: 19 };
    case 'ember':
      return { dx: r(-6, 6), dy: 0, vx: r(-5, 5), vy: -r(12, 26), lifeMs: r(800, 1500), size: 1, color: rnd() < 0.35 ? 11 : rnd() < 0.5 ? 10 : 9 };
    case 'spark':
      return { dx: r(-1, 1), dy: 0, vx: r(-6, 6), vy: -r(14, 22), lifeMs: r(500, 900), size: 1, color: rnd() < 0.5 ? 10 : 11 };
    case 'bubble':
      return { dx: r(-4, 4), dy: 0, vx: r(-2, 2), vy: -r(7, 12), lifeMs: r(650, 1000), size: rnd() < 0.6 ? 2 : 1, color: rnd() < 0.5 ? 11 : 2 };
    case 'mote':
      return { dx: 0, dy: 0, vx: r(-2, 2), vy: r(-2, 3), lifeMs: r(4500, 7500), size: 1, color: rnd() < 0.6 ? 2 : 11 };
  }
}

/** Alpha of a particle at age fraction t (0..1), in 3 or 4 whole steps: a pixel look, no smooth fade. */
export function particleAlpha(kind: EmitKind, t: number): number {
  const k = Math.max(0, Math.min(1, t));
  const step = (v: number, n: number): number => Math.ceil(v * n) / n;
  switch (kind) {
    case 'smoke':
      return step(0.5 * (1 - k), 4);
    case 'steam':
      return step(0.55 * (1 - k), 4);
    case 'ember':
    case 'spark':
      return k > 0.7 ? step((1 - k) / 0.3, 3) : 1;
    case 'bubble':
      return k > 0.85 ? 0.5 : 1;
    case 'mote':
      // Fades in and out over the first and last 25%.
      return step(Math.min(1, k / 0.25, (1 - k) / 0.25) * 0.55, 4);
  }
}

/** The sideways sway of a rising wisp at a particle age, whole px. `phase` is any number that is stable for the particle. */
export function swayPx(kind: EmitKind, ageMs: number, phase: number): number {
  if (kind === 'smoke') return Math.round(Math.sin(ageMs / 520 + phase) * 2.2);
  if (kind === 'steam') return Math.round(Math.sin(ageMs / 380 + phase) * 1.6);
  if (kind === 'mote') return Math.round(Math.sin(ageMs / 1300 + phase) * 3);
  return 0;
}

// ---------- The register: drawer and glint ----------

/** The drawer's height in px over time since the ding: out in 2 steps (eased), held open, in again. 0 = shut. */
export function drawerHeightAt(tMs: number): number {
  if (tMs < 0) return 0;
  if (tMs < 50) return 2;
  if (tMs < 110) return 4;
  if (tMs < 520) return 5;
  if (tMs < 590) return 3;
  if (tMs < 650) return 1;
  return 0;
}
export const DING_MS = 650;

/** The register's glint frame 0..4 (1 px, small cross, big cross, small cross, 1 px) over time since the ding, or -1. 60 ms per frame from 40 ms. */
export function glintFrameAt(tMs: number): number {
  const i = Math.floor((tMs - 40) / 60);
  return i >= 0 && i < 5 ? i : -1;
}

/** A twinkle for jewellery: one glint of 5 frames every periodMs, starting at a seeded moment. -1 between. */
export function twinkleFrame(seed: number, clockMs: number, periodMs: number): number {
  const t = (clockMs + hash01(seed, 5) * periodMs) % periodMs;
  return glintFrameAt(t);
}

// ---------- The tap drip ----------

export interface Drip {
  state: 'none' | 'hang' | 'fall' | 'splash';
  /** Height of the drop: 1 or 2 px; y offset in px below the nozzle. */
  size: number;
  dy: number;
}
export const DRIP_HANG_MS = 900;
export const DRIP_FALL_MS = 220;
export const DRIP_SPLASH_MS = 140;
export const DRIP_FALL_PX = 5;

/** One drip over time: a 1 px bead hangs and swells to 2 px, falls DRIP_FALL_PX (accelerating), splashes. Then a pause; `periodMs` and the start are seeded. */
export function dripAt(seed: number, clockMs: number, periodMs: number): Drip {
  const t = (clockMs + hash01(seed, 9) * periodMs) % periodMs;
  if (t < DRIP_HANG_MS) return { state: 'hang', size: t > DRIP_HANG_MS * 0.7 ? 2 : 1, dy: 0 };
  const f = t - DRIP_HANG_MS;
  if (f < DRIP_FALL_MS) return { state: 'fall', size: 2, dy: Math.round((f / DRIP_FALL_MS) ** 2 * DRIP_FALL_PX) };
  if (f < DRIP_FALL_MS + DRIP_SPLASH_MS) return { state: 'splash', size: 1, dy: DRIP_FALL_PX };
  return { state: 'none', size: 0, dy: 0 };
}

// ---------- Where things are ----------

/** A box of the code art (shared ArtBox, only the fields we need). */
export interface BoxLike {
  dx: number;
  dy: number;
  w: number;
  d: number;
  z: number;
  h: number;
}

/** 'top' = the highest box; { z } = the box that starts at height z. The point is the middle column and the bottom of its front face. */
export type BoxSel = 'top' | { z: number };

export function boxAnchor(boxes: readonly BoxLike[], sel: BoxSel): { x: number; y: number } | null {
  if (boxes.length === 0) return null;
  const b = sel === 'top' ? boxes.reduce((m, c) => (c.z + c.h > m.z + m.h ? c : m)) : boxes.find((c) => c.z === sel.z);
  return b ? { x: Math.round(b.dx + b.w / 2), y: b.dy - b.z } : null;
}

/** A point of a PNG sprite (image px, origin top-left) as an offset from the anchor (bottom centre). */
export function pngToRel(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return { x: x - Math.floor(w / 2), y: y - h };
}

/** Where a thing is: a PNG point (image px), or the code art (box or an offset from the anchor). */
export interface At {
  png?: readonly [number, number];
  code: BoxSel | readonly [number, number];
}

export interface FlameSpec {
  kind: FlameKind;
  /** The BOTTOM-CENTRE pixel of the flame. */
  at: At;
  /** Flicker amount of the matching light (0 = steady); default the type's light flicker. */
  flicker?: number;
  /** An Aseprite strip `<typeId>_<tag>.png` (docs/PLAN-ANIMATION.md) replaces the code frames when the file exists. */
  strip?: { tag: string; frameW: number };
}

export interface EmitSpec {
  kind: EmitKind;
  at: At;
  /** Mean ms between particles. */
  everyMs: number;
  /** Random area around the point (px), for motes. */
  area?: readonly [number, number];
}

export interface PropSpec {
  flames?: readonly FlameSpec[];
  emits?: readonly EmitSpec[];
  /** The tap nozzles (drips), drop start points. */
  drips?: readonly At[];
  /** Jewel twinkles. */
  glints?: readonly { at: At; periodMs: number }[];
  /** A cash register: drawer and glint on a ding. */
  register?: boolean;
}

export const PROP_ANIMS: Readonly<Record<string, PropSpec>> = {
  // Lamps and lanterns: a small flame on the light's own flicker.
  lamp: { flames: [{ kind: 'tiny', at: { code: 'top' } }] },
  ember_lamp: { flames: [{ kind: 'tiny', at: { code: 'top' } }], emits: [{ kind: 'spark', at: { code: [0, -52] }, everyMs: 1100 }] },
  skull_lamp: { flames: [{ kind: 'ghost', at: { code: 'top' } }] },
  wall_torch: {
    flames: [{ kind: 'torch', at: { code: { z: 38 } } }],
    emits: [
      { kind: 'spark', at: { code: [0, -49] }, everyMs: 900 },
      { kind: 'smoke', at: { code: [0, -50] }, everyMs: 1500 },
    ],
  },
  glass_lamp: { flames: [{ kind: 'tiny', at: { code: { z: 30 } } }] },
  lantern_post: { flames: [{ kind: 'tiny', at: { code: { z: 52 } } }] },
  hanging_lantern: { flames: [{ kind: 'tiny', at: { code: { z: 28 } } }] },
  // Chandeliers: the five candles of the iron one (PNG pixel columns of its baked flames); pearls twinkle.
  iron_chandelier: {
    flames: [
      { kind: 'tiny', at: { png: [13, 18], code: [-7, -34] } },
      { kind: 'tiny', at: { png: [26, 18], code: [6, -34] } },
      { kind: 'tiny', at: { png: [5, 22], code: [-15, -30] } },
      { kind: 'tiny', at: { png: [35, 22], code: [15, -30] } },
      { kind: 'tiny', at: { png: [20, 16], code: [0, -36] } },
    ],
  },
  pearl_chandelier: {
    glints: [
      { at: { code: [-13, -23] }, periodMs: 3300 },
      { at: { code: [0, -22] }, periodMs: 4100 },
      { at: { code: [13, -23] }, periodMs: 3700 },
    ],
  },
  shell_lamp: { glints: [{ at: { code: [0, -26] }, periodMs: 3600 }] },
  // Hearth and kitchen.
  stove: {
    flames: [{ kind: 'stove_window', at: { png: [16, 70], code: [0, -8] }, flicker: 1, strip: { tag: 'fire', frameW: 14 } }],
    emits: [{ kind: 'smoke', at: { png: [26, 1], code: [0, -62] }, everyMs: 1100 }],
  },
  stone_fireplace: {
    flames: [{ kind: 'fire_big', at: { code: [0, -9] }, flicker: 1 }],
    emits: [{ kind: 'ember', at: { code: [0, -26] }, everyMs: 420 }],
  },
  brick_oven: {
    flames: [{ kind: 'fire_med', at: { code: [0, -7] }, flicker: 1 }],
    emits: [
      { kind: 'ember', at: { code: [0, -17] }, everyMs: 800 },
      { kind: 'smoke', at: { code: [16, -77] }, everyMs: 1300 },
    ],
  },
  // The bar: the brewing barrel bubbles, the tap stand drips, the register dings.
  brewing_barrel: { emits: [{ kind: 'bubble', at: { png: [19, 13], code: [0, -53] }, everyMs: 600 }] },
  tap_stand: { drips: [{ png: [8, 19], code: [-6, -34] }, { png: [23, 19], code: [6, -34] }] },
  register: { register: true },
  // A window lets a shaft of dust motes fall onto the floor in front of it.
  window_curtains: { emits: [{ kind: 'mote', at: { code: [0, -4] }, everyMs: 900, area: [44, 34] }] },
};

/** How often a steam wisp rises from a hot dish and from a drink on a table, ms. */
export const MEAL_STEAM_MS = { hot: 450, warm: 1100 } as const;
/** At most this many table spots steam (the cost stays small in a full tavern). */
export const MEAL_STEAM_MAX = 8;
/** A ding (coins landing) finds the register within this many px of the sparkle. */
export const DING_REACH_PX = 28;

/** The step the lights flicker in; flames re-roll with their own pace but use the same dip. */
export const FLAME_LIGHT_STEP_MS = LIGHT_STEP_MS;
