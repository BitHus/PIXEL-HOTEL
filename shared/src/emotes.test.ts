import { describe, expect, it } from 'vitest';
import { EMOTE_MS } from './config.ts';
import { EMOTE_KINDS, emoteAfterState, emoteAt, startEmote } from './emotes.ts';

describe('emotes', () => {
  it('has the five kinds, each with a duration', () => {
    expect([...EMOTE_KINDS]).toEqual(['wave', 'dance', 'laugh', 'cheer', 'sleep']);
    for (const k of EMOTE_KINDS) expect(EMOTE_MS[k]).toBeGreaterThan(0);
  });
  it('starts with the configured duration and refuses an unknown kind', () => {
    expect(startEmote('wave', 1000)).toEqual({ kind: 'wave', untilMs: 1000 + EMOTE_MS.wave });
    expect(startEmote('fly', 0)).toBeNull();
  });
  it('ends at untilMs', () => {
    const e = startEmote('dance', 0);
    expect(emoteAt(e, EMOTE_MS.dance - 1)).toEqual(e);
    expect(emoteAt(e, EMOTE_MS.dance)).toBeNull();
    expect(emoteAt(null, 5)).toBeNull();
  });
  it('is cancelled by walking, sitting and lying', () => {
    const e = startEmote('cheer', 0);
    expect(emoteAfterState(e, 'idle')).toEqual(e);
    for (const s of ['walk', 'sit', 'lie'] as const) expect(emoteAfterState(e, s)).toBeNull();
  });
});
