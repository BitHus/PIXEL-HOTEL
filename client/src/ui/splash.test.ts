import { describe, expect, it } from 'vitest';
import { splashBox } from './splash.ts';

describe('splashBox', () => {
  it('shows the logo x1 on a small phone and x2 when it fits', () => {
    expect(splashBox(360, 740, 1).size).toBe(256);
    expect(splashBox(1280, 800, 1).size).toBe(512);
    expect(splashBox(543, 800, 1).size).toBe(256);
    expect(splashBox(544, 800, 1).size).toBe(512);
  });

  it('covers whole device pixels per art pixel and sits on a whole device pixel', () => {
    for (const [w, h, dpr] of [[360, 740, 3], [393, 851, 2.75], [412, 915, 2.625], [1280, 800, 1.25], [1001, 777, 1]] as const) {
      const b = splashBox(w, h, dpr);
      const perArt = (b.size * dpr) / 256;
      expect(Math.abs(perArt - Math.round(perArt))).toBeLessThan(1e-9);
      expect(perArt).toBeGreaterThanOrEqual(1);
      expect(Math.abs(b.left * dpr - Math.round(b.left * dpr))).toBeLessThan(1e-9);
      expect(Math.abs(b.top * dpr - Math.round(b.top * dpr))).toBeLessThan(1e-9);
      expect(b.size).toBeLessThanOrEqual(Math.min(w, h));
    }
  });

  it('centers the logo', () => {
    expect(splashBox(1280, 800, 1)).toEqual({ size: 512, left: 384, top: 144 });
  });
});
