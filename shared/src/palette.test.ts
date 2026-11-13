import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette.ts';

describe('palette', () => {
  it('has 32 unique hex colors', () => {
    expect(PALETTE).toHaveLength(32);
    expect(new Set(PALETTE).size).toBe(32);
    for (const c of PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/);
  });
});
