import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { GUIDE_TRAIL_MAX_DOTS, GUIDE_TRAIL_PULSE_MS, GUIDE_TRAIL_SKIP_PX, GUIDE_TRAIL_SPACING_PX } from './config.ts';
import { easeCamera, guidePeekCamera, trailDots } from './guideTrail.ts';

describe('trailDots', () => {
  const line = [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
  ];

  it('is empty without a path or for a tiny one', () => {
    expect(trailDots(null, 0)).toEqual([]);
    expect(trailDots([{ x: 0, y: 0 }], 0)).toEqual([]);
    expect(trailDots([{ x: 0, y: 0 }, { x: 10, y: 0 }], 0)).toEqual([]);
  });

  it('spaces whole-pixel dots along the path, clear of both ends', () => {
    const d = trailDots(line, 0);
    expect(d.length).toBeGreaterThan(5);
    expect(d[0]!.x).toBe(GUIDE_TRAIL_SKIP_PX);
    expect(d[1]!.x - d[0]!.x).toBe(GUIDE_TRAIL_SPACING_PX);
    for (const p of d) {
      expect(Number.isInteger(p.x) && Number.isInteger(p.y)).toBe(true);
      expect(p.x).toBeLessThanOrEqual(200 - GUIDE_TRAIL_SKIP_PX);
    }
  });

  it('follows corners of the path', () => {
    const d = trailDots([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }], 0);
    expect(d.some((p) => p.x === 100 && p.y > 20)).toBe(true);
  });

  it('fades near the target and as the walk arrives (stepped alpha)', () => {
    const d = trailDots(line, 0);
    expect(d[d.length - 1]!.alpha).toBeLessThan(d[Math.floor(d.length / 2)]!.alpha);
    for (const p of d) expect([0.25, 0.5, 0.75, 1]).toContain(p.alpha);
    const near = trailDots([{ x: 0, y: 0 }, { x: 40, y: 0 }], 0);
    for (const p of near) expect(p.alpha).toBeLessThan(1);
  });

  it('has one bright dot that steps along with time', () => {
    const a = trailDots(line, 0);
    const b = trailDots(line, GUIDE_TRAIL_PULSE_MS);
    expect(a.filter((p) => p.bright).length).toBe(1);
    expect(b.findIndex((p) => p.bright)).toBe(a.findIndex((p) => p.bright) + 1);
  });

  it('never shows more than the cap', () => {
    expect(trailDots([{ x: 0, y: 0 }, { x: 5000, y: 0 }], 0).length).toBeLessThanOrEqual(GUIDE_TRAIL_MAX_DOTS);
  });
});

describe('guidePeekCamera', () => {
  const lock = { x: 0, y: 0, zoom: 2 }; // shows world 0..200 x 0..150 in a 400 x 300 free area
  const avatar = { x: 100, y: 75 };

  it('keeps the lock when the target is already in view', () => {
    expect(guidePeekCamera(lock, avatar, { x: 150, y: 100 }, 400, 300)).toBe(lock);
  });

  it('moves just enough to bring an off-screen target in, zoom kept, avatar still in view', () => {
    const cam = guidePeekCamera(lock, avatar, { x: 260, y: 75 }, 400, 300, 40);
    expect(cam.zoom).toBe(2);
    expect(cam.y).toBe(0);
    expect((260 - cam.x) * 2).toBeCloseTo(400 - 40);
    expect((avatar.x - cam.x) * 2).toBeGreaterThanOrEqual(40);
  });

  it('never pushes the avatar out of the free area (property)', () => {
    fc.assert(
      fc.property(fc.integer({ min: -2000, max: 2000 }), fc.integer({ min: -2000, max: 2000 }), (tx, ty) => {
        const cam = guidePeekCamera(lock, avatar, { x: tx, y: ty }, 400, 300, 40);
        const sx = (avatar.x - cam.x) * 2;
        const sy = (avatar.y - cam.y) * 2;
        return sx >= 40 - 1e-9 && sx <= 360 + 1e-9 && sy >= 40 - 1e-9 && sy <= 260 + 1e-9;
      }),
    );
  });
});

describe('easeCamera', () => {
  it('moves part of the way, never past, and snaps when close', () => {
    const a = { x: 0, y: 0, zoom: 2 };
    const to = { x: 100, y: 0, zoom: 2 };
    const b = easeCamera(a, to, 16, 260);
    expect(b.x).toBeGreaterThan(0);
    expect(b.x).toBeLessThan(100);
    expect(easeCamera({ x: 99.95, y: 0, zoom: 2 }, to, 16, 260)).toEqual(to);
    expect(easeCamera(to, to, 16, 260)).toBe(to);
  });
});
