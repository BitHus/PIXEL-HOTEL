import { describe, expect, it } from 'vitest';
import { DIG_CHIPS_MAX, DIG_CHIPS_MIN, DIG_FLASH_MS, DIG_SHAKE_MAX_PX, getMineBlock } from '@pixel-hotel/shared';
import { caveInShake, chipVelocities, digFlashAt, digHitFx, shakeFromTrauma } from './digFeel.ts';

describe('J4 dig feel', () => {
  it('a plain hit never shakes; the pitch rises with the hits; chips stay in range', () => {
    const iron = getMineBlock('iron');
    const a = digHitFx(iron, 1, false, 1);
    const b = digHitFx(iron, 2, false, 1);
    expect(a.shakePx).toBe(0);
    expect(a.hitStopMs).toBe(0);
    expect(b.pitch).toBeGreaterThan(a.pitch);
    for (let s = 0; s < 50; s++) {
      const n = digHitFx(iron, 1, false, s).chips;
      expect(n).toBeGreaterThanOrEqual(DIG_CHIPS_MIN);
      expect(n).toBeLessThanOrEqual(DIG_CHIPS_MAX);
    }
  });

  it('breaks shake by trauma squared: filler barely, ore a little, a rare block most and with a hit stop', () => {
    const filler = digHitFx(getMineBlock('stone'), 0, true);
    const ore = digHitFx(getMineBlock('copper'), 0, true);
    const rare = digHitFx(getMineBlock('diamond'), 0, true);
    expect(filler.shakePx).toBeLessThan(ore.shakePx);
    expect(ore.shakePx).toBeLessThan(rare.shakePx);
    expect(rare.shakePx).toBeLessThanOrEqual(DIG_SHAKE_MAX_PX);
    expect(rare.hitStopMs).toBeGreaterThan(0);
    expect(ore.hitStopMs).toBe(0);
    expect(shakeFromTrauma(0.5, 4)).toBe(1);
    expect(shakeFromTrauma(2, 3)).toBe(3);
    expect(caveInShake().px).toBeGreaterThan(0);
  });

  it('chips fly away from the avatar, the same way for a seed', () => {
    const v = chipVelocities({ x: 0, y: 100 }, { x: 40, y: 100 }, 5, 7);
    expect(v).toEqual(chipVelocities({ x: 0, y: 100 }, { x: 40, y: 100 }, 5, 7));
    for (const c of v) expect(c.vx).toBeGreaterThan(0);
  });

  it('the flash: bright, then pressed in 1 px, then gone', () => {
    expect(digFlashAt(0)).toEqual({ alpha: 0.45, inset: 0 });
    expect(digFlashAt(DIG_FLASH_MS - 1)!.inset).toBe(1);
    expect(digFlashAt(DIG_FLASH_MS)).toBeNull();
    expect(digFlashAt(-1)).toBeNull();
  });
});
