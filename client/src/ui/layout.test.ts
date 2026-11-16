import { describe, expect, it } from 'vitest';
import { sizeClassFor } from './layout.ts';

describe('sizeClassFor', () => {
  it('knows the phones', () => {
    expect(sizeClassFor(360, 640)).toBe('phone');
    expect(sizeClassFor(420, 760)).toBe('phone');
    expect(sizeClassFor(740, 360)).toBe('phone'); // a phone on its side
  });
  it('knows the tablets', () => {
    expect(sizeClassFor(768, 1024)).toBe('tablet');
    expect(sizeClassFor(1000, 700)).toBe('tablet');
  });
  it('knows the desktops', () => {
    expect(sizeClassFor(1920, 1080)).toBe('desktop');
    expect(sizeClassFor(1280, 800)).toBe('desktop');
  });
});
