import { describe, expect, it } from 'vitest';
import { shadeOfLevel } from './blockViews.ts';

describe('shadeOfLevel (ST2)', () => {
  it('the top block is full colour, lower layers get darker and never black', () => {
    expect(shadeOfLevel(0, 1)).toBe(0xffffff);
    expect(shadeOfLevel(2, 3)).toBe(0xffffff);
    expect(shadeOfLevel(1, 3)).toBeLessThan(0xffffff);
    expect(shadeOfLevel(0, 3)).toBeLessThan(shadeOfLevel(1, 3));
    expect(shadeOfLevel(0, 3) & 0xff).toBeGreaterThanOrEqual(0x99);
  });
});
