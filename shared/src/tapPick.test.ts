// Tap forgiveness: a real hit beats a near miss, the nearest centre wins, the front wins ties, a far tap picks nothing, small things grow to a touch box.
import { describe, expect, it } from 'vitest';
import { TAP_MIN_SIZE_PX, TAP_TOLERANCE_PX } from './config.ts';
import { atLeast, distanceToRect, pickTap, tapMinSize, tapTolerance, type TapTarget } from './tapPick.ts';

const box = (ref: string, x: number, y: number, w: number, h: number, depth = y + h): TapTarget<string> => ({ ref, bounds: { x, y, w, h }, depth });
const opts = { tolerance: 24, minSize: 44 };

describe('tap forgiveness (pickTap)', () => {
  it('a tap inside a target is a hit', () => {
    const r = pickTap({ x: 60, y: 60 }, [box('stove', 40, 40, 60, 60)], opts)!;
    expect(r.target.ref).toBe('stove');
    expect(r.hit).toBe(true);
  });
  it('a tap just outside picks it as a near miss, a tap far away picks nothing (the caller walks)', () => {
    const t = [box('barrel', 100, 100, 60, 60)];
    const near = pickTap({ x: 100 - 20, y: 130 }, t, opts)!;
    expect(near.target.ref).toBe('barrel');
    expect(near.hit).toBe(false);
    expect(pickTap({ x: 100 - 60, y: 130 }, t, opts)).toBeNull();
    expect(pickTap({ x: 130, y: 260 }, t, opts)).toBeNull();
  });
  it('a real hit always beats a near miss, even when the near miss has the closer centre', () => {
    const big = box('big', 0, 0, 200, 200);
    const small = box('small', 205, 95, 50, 50); // centre at (230,120), 25 px from the tap but outside the big box by 5
    const r = pickTap({ x: 198, y: 120 }, [small, big], { tolerance: 24, minSize: 10 })!;
    expect(r.target.ref).toBe('big');
    expect(r.hit).toBe(true);
  });
  it('among near misses the nearest visual centre wins, then the one in front', () => {
    const a = box('a', 100, 100, 40, 40);
    const b = box('b', 170, 100, 40, 40);
    expect(pickTap({ x: 160, y: 120 }, [a, b], { tolerance: 24, minSize: 10 })!.target.ref).toBe('b'); // b's centre is the closer one
    const front = box('front', 100, 100, 40, 40, 300);
    const back = box('back', 100, 100, 40, 40, 140);
    expect(pickTap({ x: 120, y: 120 }, [back, front], opts)!.target.ref).toBe('front');
    expect(pickTap({ x: 120, y: 120 }, [front, back], opts)!.target.ref).toBe('front');
  });
  it('small things grow to the touch size around their centre', () => {
    expect(atLeast({ x: 100, y: 100, w: 20, h: 20 }, 44)).toEqual({ x: 88, y: 88, w: 44, h: 44 });
    expect(atLeast({ x: 0, y: 0, w: 60, h: 10 }, 44)).toEqual({ x: 0, y: -17, w: 60, h: 44 });
    // a 20 px thing: a tap 15 px from its centre is a hit with a 44 px minimum, a near miss for nothing smaller
    const tiny = [box('lamp', 100, 100, 20, 20)];
    expect(pickTap({ x: 130, y: 110 }, tiny, { tolerance: 24, minSize: 44 })!.hit).toBe(true);
    expect(pickTap({ x: 130, y: 110 }, tiny, { tolerance: 0, minSize: 20 })).toBeNull();
  });
  it('the numbers: a finger is more generous than a mouse, a touch box is at least 44 px', () => {
    expect(tapTolerance(true)).toBeGreaterThan(tapTolerance(false));
    expect(tapMinSize(true)).toBeGreaterThanOrEqual(44);
    expect([TAP_TOLERANCE_PX.touch, TAP_TOLERANCE_PX.mouse]).toEqual([28, 20]);
    expect(TAP_MIN_SIZE_PX.touch).toBe(44);
    expect(tapTolerance(false)).toBeGreaterThanOrEqual(20);
    expect(tapTolerance(true)).toBeLessThanOrEqual(28);
  });
  it('distance to a rect is 0 inside and grows outside', () => {
    expect(distanceToRect({ x: 5, y: 5 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(0);
    expect(distanceToRect({ x: 13, y: 14 }, { x: 0, y: 0, w: 10, h: 10 })).toBe(5);
  });
  it('no targets, no pick', () => {
    expect(pickTap({ x: 1, y: 1 }, [], opts)).toBeNull();
  });
});
