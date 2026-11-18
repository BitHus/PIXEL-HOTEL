import { describe, expect, it } from 'vitest';
import { cobwebVariant } from './cobwebSide.ts';

describe('cobwebVariant', () => {
  it('west corner = 0, east corner = 1, no corner falls back to hash parity', () => {
    expect(cobwebVariant('w', 7)).toBe(0);
    expect(cobwebVariant('e', 6)).toBe(1);
    expect(cobwebVariant(null, 7)).toBe(1);
  });
});
