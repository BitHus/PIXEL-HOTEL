// U1/C17: rig tables, ramps, walk frame from distance, the layer plan.
import { describe, expect, it } from 'vitest';
import { BLINK_CLOSED_MS, BLINK_MAX_MS, BLINK_MIN_MS, LOOK_COLORS, WALK_FRAME_PX, WALK_FRAMES } from './config.ts';
import { CLOTHING, HATS, lookAllowed } from './clothing.ts';
import type { AvatarLook } from './avatar.ts';
import { PALETTE_NAMES } from './palette.ts';
import {
  AVATAR_SLOTS, avatarLayers, blinkClosed, handAnchor, headOffset, rigPose, timedFrame, IDENTITY_RAMP, KEY_RAMPS, keyChannelOf, RAMP_NAMES, rampFor, rampForIndex, RIG, SLOT_KEYS, walkFrame,
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
  it('outer pieces: look.outer draws the layer, also while sitting', () => {
    for (const id of ['belt', 'tabard', 'cloak']) {
      expect(CLOTHING.find((x) => x.id === id)!.slot).toBe('outer');
      for (const pose of ['walk', 'sit'] as const) {
        const o = avatarLayers({ ...look, outer: id }, null, 'down', pose).find((x) => x.slot === 'outer')!;
        expect(o).toMatchObject({ id: `outer_${id}`, optional: true });
      }
    }
    expect(lookAllowed({ ...look, outer: 'cloak' }, [])).toBe(false);
    expect(lookAllowed({ ...look, outer: 'cloak' }, ['tunic', 'cloak'])).toBe(true);
    expect(lookAllowed(look, ['tunic'])).toBe(true);
  });
  it('hat hides: front, all, none', () => {
    expect(HATS.find((h) => h.id === 'straw_hat')!.hides).toBe('front');
    expect(slots('down', { ...look, hat: 'straw_hat' })).not.toContain('hair_front');
    expect(slots('down', { ...look, hat: 'straw_hat' })).toContain('hair_back');
    expect(slots('up', { ...look, hat: 'straw_hat' })).toContain('hair_front'); // seen from behind: no bald head
    expect(slots('up', { ...look, hat: 'knight_helm' })).not.toContain('hair_front');
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

describe('CH1 animation timing', () => {
  it('rigPose: standing still is idle, a wave is wave, seated eating is eat, lie is code', () => {
    expect(rigPose('idle')).toBe('idle');
    expect(rigPose('idle', { waving: true })).toBe('wave');
    expect(rigPose('walk', { waving: true })).toBe('walk');
    expect(rigPose('sit')).toBe('sit');
    expect(rigPose('sit', { eating: true })).toBe('eat');
    expect(rigPose('lie')).toBeNull();
  });
  it('timedFrame: steady frames of frameMs, wraps, phase shifts, walk stays 0', () => {
    const ms = RIG.poses.idle.frameMs!;
    expect(timedFrame('idle', 0)).toBe(0);
    expect(timedFrame('idle', ms - 1)).toBe(0);
    expect(timedFrame('idle', ms)).toBe(1);
    expect(timedFrame('idle', ms * 2)).toBe(0);
    expect(timedFrame('idle', 0, ms)).toBe(1);
    expect(timedFrame('idle', -1)).toBe(1);
    expect(timedFrame('walk', 5000)).toBe(0);
    for (const p of ['idle', 'eat', 'wave'] as const) {
      expect(RIG.poses[p].frames).toBe(2);
      for (const f of ['down', 'up', 'right'] as const) {
        expect(RIG.poses[p].head[f]).toHaveLength(2);
        expect(RIG.poses[p].hand[f]).toHaveLength(2);
      }
    }
  });
  it('idle has no extra code breath (the strip has it); sit keeps it', () => {
    expect(headOffset('idle', 'down', 0, 0).dy).toBe(0);
    expect(headOffset('idle', 'down', 1, 0).dy).toBe(-1);
    expect(headOffset('sit', 'down', 0, 0).dy).toBe(RIG.poses.sit.head.down[0]![1] + RIG.breath.dy);
  });
  it('blinkClosed: short, every 3 to 5 s, seeded, never stuck', () => {
    for (const seed of [1, 2, 7, 99]) {
      let closed = 0;
      const starts: number[] = [];
      let prev = false;
      for (let t = 0; t < 60000; t += 10) {
        const c = blinkClosed(t, seed);
        if (c) closed += 10;
        if (c && !prev) starts.push(t);
        prev = c;
      }
      expect(closed / starts.length).toBeLessThanOrEqual(BLINK_CLOSED_MS + 10);
      for (let i = 1; i < starts.length; i++) {
        expect(starts[i]! - starts[i - 1]!).toBeGreaterThanOrEqual(BLINK_MIN_MS - 10);
        expect(starts[i]! - starts[i - 1]!).toBeLessThanOrEqual(BLINK_MAX_MS + 10);
      }
      expect(starts.length).toBeGreaterThanOrEqual(10);
    }
    expect(blinkClosed(1234, 5)).toBe(blinkClosed(1234, 5));
  });
  it('layer plan: blink swaps the face tag; body layers carry the fallback strips', () => {
    const face = avatarLayers(look, null, 'down', 'idle', true).find((l) => l.slot === 'face')!;
    expect(face).toMatchObject({ tag: 'blink_down', frames: 1 });
    expect(face.alts[0]).toMatchObject({ tag: 'still_down' });
    expect(avatarLayers(look, null, 'up', 'idle', true).some((l) => l.slot === 'face')).toBe(false);
    const eat = avatarLayers(look, null, 'down', 'eat').find((l) => l.slot === 'legs')!;
    expect(eat).toMatchObject({ tag: 'eat_down', frames: 2 });
    expect(eat.alts).toEqual([{ tag: 'sit_down', frames: 1, first: true }]);
    expect(avatarLayers(look, null, 'right', 'wave').find((l) => l.slot === 'torso')!.alts.map((a) => a.tag)).toEqual(['idle_right', 'walk_right']);
  });
});
