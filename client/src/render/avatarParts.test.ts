import { describe, expect, it } from 'vitest';
import { CLOTHING, START_LOOK, type AvatarLook } from '@pixel-hotel/shared';
import { avatarParts, partBounds, sitParts, type Facing3 } from './avatarParts.ts';

const FACINGS: Facing3[] = ['down', 'up', 'right'];
const looks: AvatarLook[] = CLOTHING.map((c) => ({
  ...START_LOOK,
  ...(c.slot === 'hair' ? { hairStyle: c.id } : c.slot === 'top' ? { top: c.id } : { bottoms: c.id }),
}));

describe('avatar clothing styles (step 7b)', () => {
  it('the old look (short hair, long sleeves, trousers) is drawn exactly as the approved base', () => {
    // The approved down-facing figure from step 3: legs, shoes, arms, hands, torso, neck, head, hair.
    const p = avatarParts(START_LOOK, 'down');
    expect(p.map(([x, y, w, h]) => [x, y, w, h])).toEqual([
      [-5, -26, 4, 22], [1, -26, 4, 22], [-6, -4, 5, 4], [1, -4, 5, 4],
      [-10, -43, 3, 15], [-10, -28, 3, 3], [7, -43, 3, 15], [7, -28, 3, 3],
      [-7, -44, 14, 20], [-2, -46, 4, 2], [-6, -60, 12, 14],
      [-7, -61, 14, 6], [-7, -56, 2, 5], [5, -56, 2, 5], [-3, -53, 1, 2], [2, -53, 1, 2],
    ]);
  });

  it('every style keeps the body: same head, feet on the ground, inside the 32x64 canvas', () => {
    for (const look of looks) {
      for (const f of FACINGS) {
        const p = avatarParts(look, f);
        const [x0, y0, x1, y1] = partBounds(p);
        expect(x0, `${JSON.stringify(look)} ${f}`).toBeGreaterThanOrEqual(-16);
        expect(x1).toBeLessThanOrEqual(16);
        expect(y0).toBeGreaterThanOrEqual(-64);
        expect(y1).toBe(1); // the feet (with their outline) end at the ground
        const head = f === 'right' ? [-5, -60, 11, 14] : [-6, -60, 12, 14];
        expect(p.some(([x, y, w, h]) => [x, y, w, h].join() === head.join())).toBe(true);
        expect(sitParts(look, f).length).toBeGreaterThan(0);
      }
    }
  });
});
