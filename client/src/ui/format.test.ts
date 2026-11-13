import { describe, expect, it } from 'vitest';
import { shortNumber } from './format.ts';

describe('shortNumber', () => {
  it('shows small numbers as they are and big ones short, rounded down', () => {
    expect(shortNumber(0)).toBe('0');
    expect(shortNumber(999)).toBe('999');
    expect(shortNumber(1000)).toBe('1k');
    expect(shortNumber(1200)).toBe('1.2k');
    expect(shortNumber(1299)).toBe('1.2k');
    expect(shortNumber(12_345)).toBe('12k');
    expect(shortNumber(999_999)).toBe('999k');
    expect(shortNumber(1_250_000)).toBe('1.2M');
  });
});
