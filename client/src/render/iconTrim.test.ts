import { describe, expect, it } from 'vitest';
import { fitInSlot, trimBounds } from './iconTrim.ts';

describe('trimBounds', () => {
  it('finds the opaque box', () => {
    const w = 6;
    const h = 5;
    const d = new Uint8Array(w * h * 4);
    d[(1 * w + 2) * 4 + 3] = 255;
    d[(3 * w + 4) * 4 + 3] = 9;
    expect(trimBounds(d, w, h)).toEqual({ x: 2, y: 1, w: 3, h: 3 });
  });
  it('is null when empty', () => {
    expect(trimBounds(new Uint8Array(16), 2, 2)).toBeNull();
  });
});

describe('fitInSlot', () => {
  it('shrinks a big piece and centres it', () => {
    const b = fitInSlot(64, 32, 32);
    expect(b.w).toBe(30);
    expect(b.h).toBe(15);
    expect(b.x).toBe(1);
  });
  it('grows a small piece by at most 2x', () => {
    expect(fitInSlot(8, 8, 32)).toEqual({ x: 8, y: 8, w: 16, h: 16 });
  });
  it('keeps a piece that fits', () => {
    expect(fitInSlot(30, 20, 32)).toEqual({ x: 1, y: 6, w: 30, h: 20 });
  });
});
