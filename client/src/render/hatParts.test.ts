import { describe, expect, it } from 'vitest';
import { PALETTE } from '@pixel-hotel/shared';
import { HAT_IDS, hatBoxes, hatPart } from './hatParts.ts';
import { EMOTE_KINDS, emotePose } from './emoteAnim.ts';

describe('hats (B2)', () => {
  it('has 12 unique hats, palette colours, all facings, inside a sane box above the shoulders', () => {
    expect(new Set(HAT_IDS).size).toBe(12);
    for (const id of HAT_IDS) {
      for (const f of ['down', 'up', 'right'] as const) {
        const ps = hatBoxes(id, f)!;
        expect(ps.length).toBeGreaterThan(2);
        for (const [x, y, w, h, col] of ps) {
          expect(PALETTE as readonly string[]).toContain(col);
          expect(x).toBeGreaterThanOrEqual(-11);
          expect(x + w).toBeLessThanOrEqual(11);
          expect(y).toBeGreaterThanOrEqual(-75);
          expect(y + h).toBeLessThanOrEqual(-52);
        }
      }
    }
  });
  it('locked is one grey, an unknown id is null', () => {
    expect(new Set(hatBoxes('gold_crown', 'down', true)!.map((p) => p[4])).size).toBe(1);
    expect(hatBoxes('nope', 'down')).toBeNull();
    expect(hatPart('nope')).toBeNull();
    expect(hatPart('straw_hat')).not.toBeNull();
  });
});

describe('emotes (B2)', () => {
  it('every kind gives whole-pixel poses and sleep has zzz', () => {
    for (const k of EMOTE_KINDS) {
      for (const t of [0, 100, 250, 400, 1000, 5000]) {
        const p = emotePose(k, t);
        for (const n of [p.dx, p.dy, p.headDy, p.armLift, p.armSwing]) expect(Number.isInteger(n)).toBe(true);
      }
    }
    expect(emotePose('sleep', 0).overlay).toBe('zzz');
  });
});
