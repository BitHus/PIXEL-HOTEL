// U1/C18: the pure bake parts (recolour by key, composite order and head offset, the 1 px outline, the cache key, the fallback decision).
import { describe, expect, it } from 'vitest';
import { PALETTE, PALETTE_NAMES, avatarLayers, type AvatarLook } from '@pixel-hotel/shared';
import {
  BAKE_H,
  BAKE_PAD,
  BAKE_W,
  LAYER_H,
  LAYER_W,
  OUTLINE_RGB,
  bakeLayers,
  bakePlan,
  decideSprites,
  keyMap,
  lookKey,
  outlinePass,
  rampRgbForIndex,
  recolor,
} from './avatarBake.ts';

const look: AvatarLook = { skin: 30, hair: 5, hairStyle: 'short', top: 'tunic', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 5, hat: undefined };
const hex = (name: string): [number, number, number] => {
  const n = parseInt(PALETTE[PALETTE_NAMES.indexOf(name as never)]!.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const layer = (px: [number, number, [number, number, number]][]): Uint8Array => {
  const a = new Uint8Array(LAYER_W * LAYER_H * 4);
  for (const [x, y, c] of px) a.set([...c, 255], (y * LAYER_W + x) * 4);
  return a;
};
const at = (b: Uint8Array, x: number, y: number): number[] => Array.from(b.subarray(((y + BAKE_PAD) * BAKE_W + x + BAKE_PAD) * 4, ((y + BAKE_PAD) * BAKE_W + x + BAKE_PAD) * 4 + 4));

describe('recolour by key colour', () => {
  it('a K1 key of a torso becomes the shirt ramp, a plain colour stays', () => {
    const ramp = rampRgbForIndex(look.shirt);
    const src = layer([[0, 0, hex('silver')], [1, 0, hex('dusk')], [2, 0, hex('gold')]]);
    const out = recolor(src, keyMap('torso', look));
    expect(Array.from(out.subarray(0, 3))).toEqual([...ramp[0]]);
    expect(Array.from(out.subarray(4, 7))).toEqual([...ramp[3]]);
    expect(Array.from(out.subarray(8, 11))).toEqual(hex('gold'));
  });
  it('KS in a torso is the skin ramp; the source array is untouched', () => {
    const src = layer([[0, 0, hex('rose')]]);
    const copy = new Uint8Array(src);
    expect(Array.from(recolor(src, keyMap('torso', look)).subarray(0, 3))).toEqual([...rampRgbForIndex(look.skin)[0]]);
    expect(src).toEqual(copy);
  });
  it('a channel a slot does not allow is left alone (hat silver, shoes with KS)', () => {
    const src = layer([[0, 0, hex('silver')], [1, 0, hex('rose')]]);
    expect(recolor(src, keyMap('hat', look))).toEqual(src);
    expect(Array.from(recolor(src, keyMap('shoes', look)).subarray(4, 7))).toEqual(hex('rose'));
  });
  it('ramps exist for every palette index (derived when the data has none)', () => {
    for (let i = 0; i < PALETTE.length; i++) expect(rampRgbForIndex(i)).toHaveLength(4);
  });
});

describe('composite and outline', () => {
  it('later layers cover earlier ones; transparent pixels never erase', () => {
    const a = layer([[3, 3, hex('red')], [4, 3, hex('red')]]);
    const b = layer([[3, 3, hex('green')]]);
    const out = bakeLayers([{ rgba: a, dx: 0, dy: 0 }, { rgba: b, dx: 0, dy: 0 }]);
    expect(at(out, 3, 3)).toEqual([...hex('green'), 255]);
    expect(at(out, 4, 3)).toEqual([...hex('red'), 255]);
  });
  it('a head layer is shifted by its offset', () => {
    const body = layer([[10, 10, hex('red')]]);
    const head = layer([[10, 10, hex('gold')]]);
    const out = bakeLayers([{ rgba: body, dx: 0, dy: 0 }, { rgba: head, dx: 1, dy: -2 }]);
    expect(at(out, 10, 10)).toEqual([...hex('red'), 255]);
    expect(at(out, 11, 8)).toEqual([...hex('gold'), 255]);
  });
  it('one 1 px outline around the silhouette only: a single pixel gets 4 outline neighbours, no corners, nothing inside', () => {
    const out = bakeLayers([{ rgba: layer([[5, 5, hex('red')]]), dx: 0, dy: 0 }]);
    const o = [...OUTLINE_RGB, 255];
    expect([at(out, 4, 5), at(out, 6, 5), at(out, 5, 4), at(out, 5, 6)]).toEqual([o, o, o, o]);
    expect(at(out, 4, 4)).toEqual([0, 0, 0, 0]);
    expect(at(out, 5, 5)).toEqual([...hex('red'), 255]);
    expect(Array.from(out).filter((_, i) => i % 4 === 3 && out[i] !== 0)).toHaveLength(5);
  });
  it('a 4 x 4 block: exact outline ring of 16 pixels (corners left empty)', () => {
    const px: [number, number, [number, number, number]][] = [];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) px.push([x, y, hex('red')]);
    const out = bakeLayers([{ rgba: layer(px), dx: 0, dy: 0 }]);
    let solid = 0;
    for (let i = 3; i < out.length; i += 4) if (out[i] !== 0) solid++;
    expect(solid).toBe(16 + 16);
  });
  it('outlinePass on the padded canvas edge keeps the figure inside the texture', () => {
    const w = 4;
    const buf = new Uint8Array(w * w * 4);
    buf.set([1, 2, 3, 255], 0);
    outlinePass(buf, w, w, [9, 9, 9]);
    expect(Array.from(buf.subarray(4, 8))).toEqual([9, 9, 9, 255]);
    expect(Array.from(buf.subarray(w * 4, w * 4 + 4))).toEqual([9, 9, 9, 255]);
    expect(BAKE_H).toBe(LAYER_H + 2);
  });
});

describe('bake plan', () => {
  it('body layers take the walk frame, head layers the head offset and frame 0', () => {
    const layers = avatarLayers({ ...look }, null, 'down', 'walk');
    const plan = bakePlan(layers, 6, { dx: 1, dy: -1 });
    for (const p of plan) {
      if (p.ref.slot === 'body' || p.ref.slot === 'torso') expect(p).toMatchObject({ frame: 2, dx: 0, dy: 0 });
      if (p.ref.slot === 'hair_front') expect(p).toMatchObject({ frame: 0, dx: 1, dy: -1 });
    }
  });
  it('the layer order of the plan follows avatarLayers (up: no face)', () => {
    const slots = (f: 'down' | 'up') => bakePlan(avatarLayers(look, null, f, 'walk'), 0, { dx: 0, dy: 0 }).map((p) => p.ref.slot);
    expect(slots('down')).toContain('face');
    expect(slots('up')).not.toContain('face');
  });
});

describe('look key', () => {
  it('changes with any worn colour or style, not with unrelated state', () => {
    const k = lookKey(look);
    expect(lookKey({ ...look })).toBe(k);
    expect(lookKey({ ...look, hair: 6 })).not.toBe(k);
    expect(lookKey({ ...look, hat: 'straw_hat' })).not.toBe(k);
    expect(lookKey({ ...look, top: 't_shirt' })).not.toBe(k);
    expect(lookKey(look, { outer: 'apron' })).not.toBe(k);
  });
});

describe('fallback decision', () => {
  const layers = avatarLayers({ ...look, hat: 'straw_hat' }, { outer: 'apron' }, 'down', 'walk');
  const all = (): boolean => true;
  it('every layer present: sprites, no code hat', () => {
    const d = decideSprites(layers, all);
    expect(d.ok).toBe(true);
    expect(d.codeHat).toBe(false);
    expect(d.layers).toHaveLength(layers.length);
  });
  it('a missing required layer (legs) means the box avatar', () => {
    expect(decideSprites(layers, (r) => r.slot !== 'legs').ok).toBe(false);
  });
  it('no files at all means the box avatar (today without PNGs)', () => {
    expect(decideSprites(layers, () => false).ok).toBe(false);
  });
  it('a missing hat PNG keeps the sprite and asks for the code hat', () => {
    const d = decideSprites(layers, (r) => r.slot !== 'hat');
    expect(d.ok).toBe(true);
    expect(d.codeHat).toBe(true);
    expect(d.layers.some((r) => r.slot === 'hat')).toBe(false);
  });
  it('missing outer or back hair are skipped, not an error', () => {
    const d = decideSprites(avatarLayers({ ...look, hairStyle: 'long' }, { outer: 'apron' }, 'down', 'walk'), (r) => r.slot !== 'outer' && r.slot !== 'hair_back');
    expect(d.ok).toBe(true);
    expect(d.layers.some((r) => r.slot === 'outer' || r.slot === 'hair_back')).toBe(false);
  });
  it('a missing sit file (not drawn yet) means the box for the sit pose only', () => {
    const has = (r: { tag: string }): boolean => r.tag.startsWith('walk') || r.tag.startsWith('still');
    expect(decideSprites(avatarLayers(look, null, 'down', 'walk'), has).ok).toBe(true);
    expect(decideSprites(avatarLayers(look, null, 'down', 'sit'), has).ok).toBe(false);
  });
});
