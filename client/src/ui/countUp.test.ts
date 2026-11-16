import { describe, expect, it } from 'vitest';
import { COUNT_MAX_MS, COUNT_MIN_MS, countMs, countValue } from './countUp.ts';

describe('count up', () => {
  it('starts at from, ends at to, never overshoots, whole numbers', () => {
    expect(countValue(10, 50, 0)).toBe(10);
    expect(countValue(10, 50, 1)).toBe(50);
    let last = 10;
    for (let k = 0; k <= 1.0001; k += 0.05) {
      const v = countValue(10, 50, k);
      expect(Number.isInteger(v)).toBe(true);
      expect(v).toBeGreaterThanOrEqual(last);
      expect(v).toBeLessThanOrEqual(50);
      last = v;
    }
  });
  it('counts down too', () => {
    expect(countValue(50, 10, 0.5)).toBeLessThan(50);
    expect(countValue(50, 10, 0.5)).toBeGreaterThan(10);
  });
  it('bigger jumps take longer, within limits', () => {
    expect(countMs(0, 1)).toBeGreaterThanOrEqual(COUNT_MIN_MS);
    expect(countMs(0, 5)).toBeLessThan(countMs(0, 5000));
    expect(countMs(0, 10_000_000)).toBe(COUNT_MAX_MS);
  });
});
