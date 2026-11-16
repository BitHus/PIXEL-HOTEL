import { describe, expect, it } from 'vitest';
import { GUEST_SPRITE_PIECES, guestLook } from './guestLook.ts';

describe('guestLook', () => {
  it('is the same for the same id and only uses pieces that have layer sprites', () => {
    let hats = 0;
    for (let id = 1; id <= 200; id++) {
      const l = guestLook(id);
      expect(guestLook(id)).toEqual(l);
      expect(GUEST_SPRITE_PIECES.hairStyle).toContain(l.hairStyle);
      expect(GUEST_SPRITE_PIECES.top).toContain(l.top);
      expect(GUEST_SPRITE_PIECES.bottoms).toContain(l.bottoms);
      if (l.hat) {
        hats++;
        expect(GUEST_SPRITE_PIECES.hat).toContain(l.hat);
      }
    }
    expect(hats).toBeGreaterThan(20);
    expect(hats).toBeLessThan(100);
  });
});
