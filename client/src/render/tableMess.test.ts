import { describe, expect, it } from 'vitest';
import { LAND_MS, landOffsetPx } from './tableMess.ts';

describe('coins landing on the table (OA-2)', () => {
  it('starts above the table, falls, and rests at 0; never below the table', () => {
    expect(landOffsetPx(0)).toBeGreaterThan(0);
    expect(landOffsetPx(LAND_MS)).toBe(0);
    for (let t = 0; t <= LAND_MS + 100; t += 10) expect(landOffsetPx(t)).toBeGreaterThanOrEqual(0);
  });
  it('the hop stays small: the pile never rises further than 14 px, so it cannot fly across the room', () => {
    for (let t = 0; t <= LAND_MS; t += 5) expect(landOffsetPx(t)).toBeLessThanOrEqual(14);
  });
});
