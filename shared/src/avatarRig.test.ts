// U1/C17: rig tables, ramps, walk frame from distance, the layer plan.
import { describe, expect, it } from 'vitest';
import { LOOK_COLORS, WALK_FRAME_PX, WALK_FRAMES } from './config.ts';
import { CLOTHING, HATS } from './clothing.ts';
import type { AvatarLook } from './avatar.ts';
import { PALETTE_NAMES } from './palette.ts';
import {
  AVATAR_SLOTS, avatarLayers, handAnchor, headOffset, IDENTITY_RAMP, KEY_RAMPS, keyChannelOf, RAMP_NAMES, rampFor, rampForIndex, RIG, SLOT_KEYS, walkFrame,
} from './avatarRig.ts';

const look: AvatarLook = { skin: 30, hair: 5, hairStyle: 'short', top: 'tunic', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 };

describe('walkFrame', () => {
  it('is one frame per WALK_FRAME_PX and wraps', () => {
    expect(walkFrame(0)).toBe(0);
    expect(walkFrame(WALK_FRAME_PX - 1)).toBe(0);
    expect(walkFrame(WALK_FRAME_PX)).toBe(1);
    expect(walkFrame(WALK_FRAME_PX * WALK_FRAMES)).toBe(0);
    expect(walkFrame(WALK_FRAME_PX * (WALK_FRAMES + 2) + 3)).toBe(2);
  });
  it('wraps negative and survives bad input', () => {
    expect(walkFrame(-1)).toBe(WALK_FRAMES - 1);
    expect(walkFrame(NaN)).toBe(0);
  });
});

describe('rig tables', () => {
  it('match the frame counts per facing', () => {
    expect(RIG.poses.walk.frames).toBe(WALK_FRAMES);
    for (const pose of ['walk', 'sit'] as const) {
      for (const f of ['down', 'up', 'right'] as const) {
        expect(RIG.poses[pose].head[f], `${pose} head ${f}`).toHaveLength(RIG.poses[pose].frames);
        expect(RIG.poses[pose].hand[f], `${pose} hand ${f}`).toHaveLength(RIG.poses[pose].frames);
      }
    }
    expect(RIG.canvas).toEqual({ w: 32, h: 64 });
    expect(RIG.hatTop).toBe(-64);
  });
  it('head: breath while standing, none while walking, left mirrors dx', () => {
    expect(headOffset('walk', 'down', 0, 0).dy).toBe(RIG.breath.dy);
    expect(headOffset('walk', 'down', 0, RIG.breath.durationMs).dy).toBe(0);
    expect(headOffset('walk', 'down', 1, 0, true).dy).toBe(-1); // table bob, no breath
    expect(headOffset('walk', 'down', 0, RIG.breath.periodMs).dy).toBe(RIG.breath.dy); // periodic
    expect(handAnchor('walk', 'left', 0).x).toBe(-handAnchor('walk', 'right', 0).x);
  });
});

describe('ramps', () => {
  it('exist for every LOOK_COLORS value, with valid names', () => {
    for (const list of Object.values(LOOK_COLORS)) {
      for (const i of list) expect(rampForIndex(i), PALETTE_NAMES[i]).not.toBeNull();
    }
    for (const n of RAMP_NAMES) {
      const r = rampFor(n as (typeof PALETTE_NAMES)[number])!;
      expect(r).toHaveLength(4);
      for (const c of r) expect(PALETTE_NAMES).toContain(c);
      expect(PALETTE_NAMES).toContain(n);
    }
    for (const c of IDENTITY_RAMP) expect(PALETTE_NAMES).toContain(c);
  });
  it('key channels are disjoint and known', () => {
    const all = Object.values(KEY_RAMPS).flat();
    expect(new Set(all).size).toBe(12);
    expect(keyChannelOf('rose')).toBe('KS');
    expect(keyChannelOf('cyan')).toBe('K2');
    expect(keyChannelOf('rust')).toBeNull();
    for (const s of AVATAR_SLOTS) expect(SLOT_KEYS[s]).toBeDefined();
  });
});

describe('avatarLayers', () => {
  const slots = (f: Parameters<typeof avatarLayers>[2], l = look, o = null as Parameters<typeof avatarLayers>[1]) => avatarLayers(l, o, f, 'walk').map((x) => x.slot);
  it('down and right order, no outer without an outfit', () => {
    expect(slots('down')).toEqual(['body', 'shoes', 'legs', 'torso', 'hair_back', 'face', 'hair_front']);
    expect(slots('right', { ...look, hat: 'straw_hat' })).toEqual(['body', 'shoes', 'legs', 'torso', 'hair_back', 'face', 'hat']);
    expect(slots('down', look, { outer: 'apron', outerBack: 'cloak' })).toEqual(['outer_back', 'body', 'shoes', 'legs', 'torso', 'outer', 'hair_back', 'face', 'hair_front']);
  });
  it('up: no face, the cloak back covers the body', () => {
    expect(slots('up', look, { outerBack: 'cloak' })).toEqual(['body', 'shoes', 'legs', 'torso', 'outer_back', 'hair_back', 'hair_front']);
  });
  it('hat hides: front, all, none', () => {
    expect(HATS.find((h) => h.id === 'straw_hat')!.hides).toBe('front');
    expect(slots('down', { ...look, hat: 'straw_hat' })).not.toContain('hair_front');
    expect(slots('down', { ...look, hat: 'straw_hat' })).toContain('hair_back');
    const helm = slots('down', { ...look, hat: 'knight_helm' });
    expect(helm).not.toContain('hair_front');
    expect(helm).not.toContain('hair_back');
    expect(helm[helm.length - 1]).toBe('hat');
    expect(slots('down', { ...look, hat: 'flower_crown' })).toContain('hair_front');
    for (const c of CLOTHING) if (c.hides) expect(c.slot).toBe('hat');
  });
  it('ids, tags, frames, mirror', () => {
    const l = avatarLayers({ ...look, hat: 'wool_cap' }, null, 'left', 'sit');
    const torso = l.find((x) => x.slot === 'torso')!;
    expect(torso).toMatchObject({ id: 'torso_tunic', tag: 'sit_right', frames: 1, mirror: true, optional: false });
    expect(l.find((x) => x.slot === 'hat')).toMatchObject({ id: 'hat_wool_cap', tag: 'still_right', frames: 1 });
    expect(avatarLayers(look, null, 'down', 'walk')[0]).toMatchObject({ id: 'body_base', tag: 'walk_down', frames: WALK_FRAMES, mirror: false });
    expect(avatarLayers(look, null, 'down', 'walk').find((x) => x.slot === 'hair_back')!.optional).toBe(true);
  });
});
