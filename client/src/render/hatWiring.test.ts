import { describe, expect, it } from 'vitest';
import { EMOTE_KINDS, HATS, START_LOOK } from '@pixel-hotel/shared';
import { EMOTE_KINDS as ART_KINDS } from './emoteAnim.ts';
import { HAT_IDS } from './hatParts.ts';
import { avatarParts } from './avatarParts.ts';

describe('hats and emotes wiring', () => {
  it('the drawn hats are the hats in the data', () => {
    expect([...HAT_IDS].sort()).toEqual(HATS.map((h) => h.id).sort());
  });
  it('the emote kinds of the rules are the ones the artist poses', () => {
    expect([...EMOTE_KINDS]).toEqual([...ART_KINDS]);
  });
  it('a worn hat adds boxes after the hair; no hat changes nothing', () => {
    for (const f of ['down', 'up', 'right'] as const) {
      const bare = avatarParts(START_LOOK, f);
      expect(avatarParts({ ...START_LOOK, hat: '' }, f)).toEqual(bare);
      expect(avatarParts({ ...START_LOOK, hat: 'nonsense' }, f)).toEqual(bare);
      for (const h of HAT_IDS) expect(avatarParts({ ...START_LOOK, hat: h }, f).length).toBeGreaterThan(bare.length);
    }
  });
});
