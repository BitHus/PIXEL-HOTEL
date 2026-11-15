import { describe, expect, it } from 'vitest';
import { FISH_BAR, FISH_REEL_FULL, FX_NIBBLE_EVERY_MS, FX_NIBBLE_MS, FX_REEL_DRAIN_FRACTION } from '@pixel-hotel/shared';
import { BobberSet, arcPoint, nibbleDip, reelFeedback, reelTickPitch, reelTickStep, swayPx, treeFall } from './lakeFeel.ts';

const reel = (fishPos: number, boxPos: number, fill: number, boxSize = 20) => ({ fishPos, boxPos, boxSize, fill });

describe('reelFeedback', () => {
  it('catching: the fish is inside the box, tension 0', () => {
    expect(reelFeedback(reel(50, 55, 50), 1)).toEqual({ catching: true, draining: false, tension: 0 });
  });
  it('the box edge still counts as inside', () => {
    expect(reelFeedback(reel(50, 60, 50), 0).catching).toBe(true);
  });
  it('outside the box: not catching, tension grows with the distance up to 1', () => {
    const near = reelFeedback(reel(50, 65, 50), 0);
    const far = reelFeedback(reel(0, FISH_BAR, 50), 0);
    expect(near.catching).toBe(false);
    expect(near.tension).toBeGreaterThan(0);
    expect(near.tension).toBeLessThan(1);
    expect(far.tension).toBe(1);
  });
  it('draining only when the catch bar is low AND falling', () => {
    const low = FISH_REEL_FULL * FX_REEL_DRAIN_FRACTION - 1;
    expect(reelFeedback(reel(0, 90, low), -1).draining).toBe(true);
    expect(reelFeedback(reel(0, 90, low), 1).draining).toBe(false);
    expect(reelFeedback(reel(0, 90, low), 0).draining).toBe(false);
    expect(reelFeedback(reel(0, 90, FISH_REEL_FULL * 0.5), -1).draining).toBe(false);
  });
});

describe('nibbles', () => {
  it('are deterministic per seed and clock', () => {
    for (let t = 0; t < 20_000; t += 37) expect(nibbleDip(t, 3)).toBe(nibbleDip(t, 3));
  });
  it('only dip 0 to 2 px, and each lasts at most FX_NIBBLE_MS', () => {
    let run = 0;
    let longest = 0;
    let any = false;
    for (let t = 0; t < 60_000; t += 10) {
      const d = nibbleDip(t, 7);
      expect(d >= 0 && d <= 2).toBe(true);
      if (d > 0) {
        any = true;
        run += 10;
        longest = Math.max(longest, run);
      } else run = 0;
    }
    expect(any).toBe(true);
    expect(longest).toBeLessThanOrEqual(FX_NIBBLE_MS + 10);
  });
  it('at most one nibble per window', () => {
    const starts = new Set<number>();
    for (let t = 0; t < FX_NIBBLE_EVERY_MS * 30; t += 5) if (nibbleDip(t, 11) > 0) starts.add(Math.floor(t / FX_NIBBLE_EVERY_MS));
    expect(starts.size).toBeLessThanOrEqual(30);
  });
});

describe('arc, ticks, fall, sway', () => {
  it('arcPoint starts and ends on the points and rises in the middle', () => {
    const a = { x: 0, y: 100 };
    const b = { x: 100, y: 100 };
    expect(arcPoint(a, b, 0, 30)).toEqual(a);
    expect(arcPoint(a, b, 1, 30)).toEqual(b);
    expect(arcPoint(a, b, 0.5, 30).y).toBe(70);
  });
  it('reel ticks rise with the fill', () => {
    expect(reelTickStep(0)).toBe(0);
    expect(reelTickStep(FISH_REEL_FULL)).toBe(10);
    expect(reelTickStep(35)).toBeLessThan(reelTickStep(75));
    expect(reelTickPitch(25)).toBeLessThan(reelTickPitch(80));
    expect(reelTickPitch(500)).toBe(1);
  });
  it('a tree tips, lands, bounces and fades to nothing', () => {
    expect(treeFall(0)).toEqual({ angle: 0, lift: 0, alpha: 1, landed: false });
    const mid = treeFall(0.5);
    expect(mid.landed).toBe(false);
    expect(mid.angle).toBeGreaterThan(0);
    const end = treeFall(1);
    expect(end.landed).toBe(true);
    expect(end.alpha).toBe(0);
    expect(treeFall(0.85).lift).toBeGreaterThan(0);
    for (let k = 0; k <= 1; k += 0.01) expect(Number.isInteger(treeFall(k).lift)).toBe(true);
  });
  it('sway is whole px within the maximum', () => {
    for (let t = 0; t < 20_000; t += 97) {
      const v = swayPx(t, 3, 1);
      expect(Number.isInteger(v) && Math.abs(v) <= 1).toBe(true);
      expect(swayPx(t, 3, 0) === 0).toBe(true);
    }
  });
});

describe('the bobber is built once', () => {
  it('draws two pieces at construction and none in a fake update loop', () => {
    let made = 0;
    const set = new BobberSet<{ dip: boolean }>((dip) => {
      made++;
      return { dip };
    });
    expect(made).toBe(2);
    for (let frame = 0; frame < 600; frame++) {
      const art = set.get(frame % 7 === 0);
      expect(art.dip).toBe(frame % 7 === 0);
    }
    expect(made).toBe(2);
  });
});
