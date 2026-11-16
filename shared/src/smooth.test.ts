import { describe, expect, it } from 'vitest';
import { FrameStats, skipPassed, snapToStep } from './smooth.ts';

describe('snapToStep', () => {
  it('rounds to the step', () => {
    expect(snapToStep(10.4, 1 / 3)).toBeCloseTo(10.333, 3);
    expect(snapToStep(10.4, 1)).toBe(10);
    expect(snapToStep(10.4, 0)).toBe(10.4);
  });
});

describe('skipPassed', () => {
  const path = [{ x: 100, y: 0 }, { x: 100, y: 100 }, { x: 200, y: 100 }];
  it('drops a corner the walker already passed', () => {
    expect(skipPassed({ x: 100, y: 5 }, path)).toEqual(path.slice(1));
  });
  it('keeps a corner still ahead', () => {
    expect(skipPassed({ x: 100, y: -5 }, path)).toEqual(path);
  });
  it('keeps points when the walker is off the segment', () => {
    expect(skipPassed({ x: 120, y: 5 }, path)).toEqual(path);
  });
  it('never drops the last point', () => {
    expect(skipPassed({ x: 200, y: 100 }, path).length).toBeGreaterThan(0);
  });
});

describe('FrameStats', () => {
  it('keeps the last N frames', () => {
    const s = new FrameStats(3);
    [10, 20, 30, 40].forEach((t) => s.add(t));
    expect(s.count).toBe(3);
    expect(s.avg).toBe(30);
    expect(s.max).toBe(40);
    expect(s.text()).toContain('max 40.0');
  });
});
