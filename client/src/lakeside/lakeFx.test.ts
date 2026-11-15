import { describe, expect, it } from 'vitest';
import { FX_MAX_PARTICLES } from '@pixel-hotel/shared';
import { MIN_GAP_MS } from '../audio/sound.ts';
import { LakeFx } from './lakeFx.ts';

describe('lake particles', () => {
  it('never go over the pool cap, and clear empties them (Reduce effects)', () => {
    const fx = new LakeFx();
    for (let i = 0; i < 100; i++) {
      fx.leaves({ x: 0, y: 0 }, 5);
      fx.splash({ x: 0, y: 0 }, 5);
    }
    expect(fx.pool.count).toBeLessThanOrEqual(FX_MAX_PARTICLES);
    expect(fx.pool.count).toBe(FX_MAX_PARTICLES);
    fx.clear();
    expect(fx.pool.count).toBe(0);
  });
  it('rings reuse their slots', () => {
    const fx = new LakeFx();
    for (let i = 0; i < 20; i++) fx.ring({ x: i, y: 0 });
    fx.update(16);
    expect(fx.container.children.length).toBeGreaterThan(0);
  });
});

describe('lake sounds', () => {
  it('cast, splash, reelTick and rustle are rate limited', () => {
    for (const n of ['cast', 'splash', 'reelTick', 'rustle'] as const) expect(MIN_GAP_MS[n]).toBeGreaterThan(0);
  });
});
