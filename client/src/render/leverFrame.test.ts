import { describe, expect, it } from 'vitest';
import { leverLevel, leverStripIndex } from './leverFrame.ts';

describe('leverFrame', () => {
  it('rests at 0, full pull at the last frame, clamps overshoot and junk', () => {
    expect(leverLevel(0)).toBe(0);
    expect(leverLevel(-0.3)).toBe(0);
    expect(leverLevel(Number.NaN)).toBe(0);
    expect(leverLevel(1)).toBe(3);
    expect(leverLevel(1.2)).toBe(3);
    expect(leverLevel(0.5)).toBe(2);
  });
  it('slot 1 uses the second half of the strip', () => {
    expect(leverStripIndex(0, 1)).toBe(3);
    expect(leverStripIndex(1, 0)).toBe(4);
    expect(leverStripIndex(1, 1)).toBe(7);
  });
});
