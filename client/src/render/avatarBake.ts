// U1/C18: the PURE parts of the layered avatar renderer (docs/PLAN-CHARACTERS.md section 6): which ramp each key channel of a layer
// becomes for a look, recolouring, compositing in layer order with the head offset, the ONE 1 px outline pass, the look cache key and
// the fallback decision. No Pixi, no DOM: layers are RGBA byte arrays, so tests can use tiny fixtures. avatarCompose.ts does the loading.

import {
  IDENTITY_RAMP,
  KEY_RAMPS,
  PALETTE,
  PALETTE_NAMES,
  SLOT_KEYS,
  rampForIndex,
  rampFor,
  type AvatarLook,
  type AvatarOutfit,
  type AvatarSlot,
  type KeyChannel,
  type LayerRef,
  type PaletteName,
} from '@pixel-hotel/shared';
import { shade } from './colors.ts';

/** The art canvas of a layer file and the baked texture: 1 px of padding all round holds the outline. */
export const LAYER_W = 32;
export const LAYER_H = 64;
export const BAKE_PAD = 1;
export const BAKE_W = LAYER_W + 2 * BAKE_PAD;
export const BAKE_H = LAYER_H + 2 * BAKE_PAD;
/** Where the feet are in the baked texture (bottom centre of the art canvas, plus the padding). */
export const BAKE_FEET_X = LAYER_W / 2 + BAKE_PAD;
export const BAKE_FEET_Y = LAYER_H + BAKE_PAD;
/** A code hat (hatParts, drawn for the 60 px box head) sits this many px lower on the lower head of the sprite avatar, until the hat PNG exists. */
export const CODE_HAT_DY = 8;

export type Rgb = readonly [number, number, number];

const hexRgb = (hex: string): Rgb => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const nameRgb = (name: PaletteName): Rgb => hexRgb(PALETTE[PALETTE_NAMES.indexOf(name)]!);
export const OUTLINE_RGB: Rgb = nameRgb('outline');

/** Four colours, light to dark. */
export type RgbRamp = readonly [Rgb, Rgb, Rgb, Rgb];

/** The ramp of a palette index: the data ramp, or one derived from the colour with the client's shade helper. */
export function rampRgbForIndex(index: number): RgbRamp {
  const r = rampForIndex(index);
  if (r) return r.map(nameRgb) as unknown as RgbRamp;
  const hex = PALETTE[index] ?? PALETTE[0];
  return [1.25, 1, 0.75, 0.55].map((f) => hexRgb(shade(hex, f))) as unknown as RgbRamp;
}

const TRIM_RAMP: RgbRamp = (rampFor('cream') ?? IDENTITY_RAMP).map(nameRgb) as unknown as RgbRamp;

/** The ramp a key channel of a layer slot turns into for this look (section 5): skin for KS, the worn colour for K1, a plain cream for the K2 trim. */
export function channelRamp(slot: AvatarSlot, ch: KeyChannel, look: AvatarLook): RgbRamp {
  if (ch === 'KS') return rampRgbForIndex(look.skin);
  if (ch === 'K2') return TRIM_RAMP;
  switch (slot) {
    case 'shoes': return rampRgbForIndex(look.shoes);
    case 'legs': return rampRgbForIndex(look.legs);
    case 'hair_back':
    case 'hair_front': return rampRgbForIndex(look.hair);
    default: return rampRgbForIndex(look.shirt);
  }
}

const pack = (r: number, g: number, b: number): number => (r << 16) | (g << 8) | b;

/** key colour (packed rgb) -> replacement rgb for one layer slot; empty for a slot without keys (hat, face). */
export function keyMap(slot: AvatarSlot, look: AvatarLook): Map<number, Rgb> {
  const m = new Map<number, Rgb>();
  for (const ch of SLOT_KEYS[slot]) {
    const ramp = channelRamp(slot, ch, look);
    KEY_RAMPS[ch].forEach((name, i) => {
      const [r, g, b] = nameRgb(name);
      m.set(pack(r, g, b), ramp[i]!);
    });
  }
  return m;
}

/** A recoloured COPY of RGBA bytes: every opaque pixel whose colour is a key becomes its ramp colour. */
export function recolor(rgba: Uint8Array | Uint8ClampedArray, map: ReadonlyMap<number, Rgb>): Uint8Array {
  const out = new Uint8Array(rgba);
  if (map.size === 0) return out;
  for (let i = 0; i < out.length; i += 4) {
    if (out[i + 3] === 0) continue;
    const to = map.get(pack(out[i]!, out[i + 1]!, out[i + 2]!));
    if (to) {
      out[i] = to[0];
      out[i + 1] = to[1];
      out[i + 2] = to[2];
    }
  }
  return out;
}

/** One layer to draw: its RGBA (LAYER_W x LAYER_H, already recoloured) and the offset in art px (the head offset for head layers). */
export interface BakeLayer {
  rgba: Uint8Array | Uint8ClampedArray;
  dx: number;
  dy: number;
}

/** Composites layers in order (opaque over) onto a transparent BAKE_W x BAKE_H canvas, then adds the 1 px outline. */
export function bakeLayers(layers: readonly BakeLayer[], outline: Rgb = OUTLINE_RGB): Uint8Array {
  const out = new Uint8Array(BAKE_W * BAKE_H * 4);
  for (const l of layers) {
    for (let y = 0; y < LAYER_H; y++) {
      const ty = y + l.dy + BAKE_PAD;
      if (ty < 0 || ty >= BAKE_H) continue;
      for (let x = 0; x < LAYER_W; x++) {
        const tx = x + l.dx + BAKE_PAD;
        if (tx < 0 || tx >= BAKE_W) continue;
        const s = (y * LAYER_W + x) * 4;
        if (l.rgba[s + 3] === 0) continue;
        const d = (ty * BAKE_W + tx) * 4;
        out[d] = l.rgba[s]!;
        out[d + 1] = l.rgba[s + 1]!;
        out[d + 2] = l.rgba[s + 2]!;
        out[d + 3] = 255;
      }
    }
  }
  return outlinePass(out, BAKE_W, BAKE_H, outline);
}

/** Adds a 1 px outline (4 neighbours) on transparent pixels that touch an opaque one; returns the same array. Nothing inside the figure changes. */
export function outlinePass(rgba: Uint8Array, w: number, h: number, outline: Rgb = OUTLINE_RGB): Uint8Array {
  const src = new Uint8Array(rgba);
  const solid = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && src[(y * w + x) * 4 + 3] !== 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (solid(x, y)) continue;
      if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) {
        const i = (y * w + x) * 4;
        rgba[i] = outline[0];
        rgba[i + 1] = outline[1];
        rgba[i + 2] = outline[2];
        rgba[i + 3] = 255;
      }
    }
  }
  return rgba;
}

/** The strip frame and offset a layer is drawn with: body layers use the walk frame (or 0), head layers the head offset. */
export interface PlacedLayer {
  ref: LayerRef;
  frame: number;
  dx: number;
  dy: number;
}

export const HEAD_SLOTS: readonly AvatarSlot[] = ['hair_back', 'face', 'hair_front', 'hat'];

/** Places each layer for a frame and head offset (pure): body strips pick `frame`, head layers take `head`. */
export function bakePlan(layers: readonly LayerRef[], frame: number, head: { dx: number; dy: number }): PlacedLayer[] {
  return layers.map((ref) => {
    const isHead = HEAD_SLOTS.includes(ref.slot);
    return { ref, frame: isHead ? 0 : ((frame % ref.frames) + ref.frames) % ref.frames, dx: isHead ? head.dx : 0, dy: isHead ? head.dy : 0 };
  });
}

/** The cache key of a look as worn (and with an outfit): every field that changes a pixel. */
export function lookKey(look: AvatarLook, outfit: AvatarOutfit | null = null): string {
  return [look.skin, look.hair, look.hairStyle, look.top, look.shirt, look.bottoms, look.legs, look.shoes, look.hat ?? '', outfit?.outer ?? look.outer ?? '', outfit?.outerBack ?? ''].join('|');
}

export interface SpriteDecision {
  /** Every needed layer file exists: draw the baked avatar. False = the box avatar. */
  ok: boolean;
  /** The look wears a hat that has no PNG: draw the hat from hatParts on top (lowered CODE_HAT_DY). */
  codeHat: boolean;
  /** The layers to bake (the hat layer left out when it is missing). */
  layers: LayerRef[];
}

/**
 * The fallback decision per look, pose and facing: sprites only when every layer that is not optional has its file; a missing hat PNG does not
 * force the box avatar (the code hat is drawn over the sprite instead); a missing outer or back-hair layer is skipped.
 */
export function decideSprites(layers: readonly LayerRef[], has: (ref: LayerRef) => boolean): SpriteDecision {
  const kept: LayerRef[] = [];
  let codeHat = false;
  for (const ref of layers) {
    if (has(ref)) kept.push(ref);
    else if (ref.slot === 'hat') codeHat = true;
    else if (!ref.optional) return { ok: false, codeHat: false, layers: [] };
  }
  return { ok: true, codeHat, layers: kept };
}
