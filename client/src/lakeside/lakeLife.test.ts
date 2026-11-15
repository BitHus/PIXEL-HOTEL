import { describe, expect, it } from 'vitest';
import { LAKE_BIRD_FLEE_PX, LAKE_BIRDS, LAKE_BUSHES, LAKE_DECOR_COUNT, LAKE_PIER, LAKE_TREES, LAKE_WATER, type Rect } from '@pixel-hotel/shared';
import { BIRD_PERCHES, birdPose, butterflyAt, decorSpots, distToRect, isInsideWater, leafAt, newBird, newFishShadow, scareFish, stepBird, stepFish } from './lakeLife.ts';

const OPTS = { w: 576, h: 384, doorZone: { x: 256, y: 320, w: 64, h: 64 } as Rect, start: { x: 288, y: 330 } };

describe('decorSpots', () => {
  it('is deterministic and stays under the cap', () => {
    const a = decorSpots(5, OPTS);
    expect(decorSpots(5, OPTS)).toEqual(a);
    expect(a.length).toBeGreaterThan(8);
    expect(a.length).toBeLessThanOrEqual(LAKE_DECOR_COUNT);
  });
  it('obeys the placement rules over 50 seeds', () => {
    for (let seed = 1; seed <= 50; seed++) {
      for (const s of decorSpots(seed, OPTS)) {
        const p = { x: s.x, y: s.y };
        if (s.kind !== 'lily') expect(LAKE_WATER.some((r) => p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h)).toBe(false);
        else expect(isInsideWater(p, 14)).toBe(true);
        expect(distToRect(p, LAKE_PIER)).toBeGreaterThanOrEqual(14);
        for (const t of LAKE_TREES) expect(Math.hypot(t.x - s.x, t.y - s.y)).toBeGreaterThanOrEqual(30);
        for (const b of LAKE_BUSHES) expect(Math.hypot(b.x - s.x, b.y - s.y)).toBeGreaterThanOrEqual(22);
        expect(distToRect(p, OPTS.doorZone)).toBeGreaterThan(0);
        expect(Math.hypot(OPTS.start.x - s.x, OPTS.start.y - s.y)).toBeGreaterThanOrEqual(40);
      }
    }
  });
});

describe('birds', () => {
  const rng = (): number => 0.5;
  const bounds = { w: 576, h: 384 };
  it('perch, flee when the avatar is near, go away, come back', () => {
    let b = newBird(0);
    const perch = BIRD_PERCHES[0]!;
    expect(b.mode).toBe('perch');
    const near = { x: perch.x + LAKE_BIRD_FLEE_PX - 10, y: perch.y };
    b = stepBird(b, 100, near, rng, bounds);
    expect(b.mode).toBe('flee');
    for (let i = 0; i < 100 && b.mode === 'flee'; i++) b = stepBird(b, 100, near, rng, bounds);
    expect(b.mode).toBe('away');
    // The wait does not run down while the avatar stands near the perch.
    const waiting = b.waitMs;
    b = stepBird(b, 1000, near, rng, bounds);
    expect(b.waitMs).toBe(waiting);
    const far = { x: 500, y: 350 };
    for (let i = 0; i < 300 && b.mode !== 'perch'; i++) b = stepBird(b, 100, far, rng, bounds);
    expect(b.mode).toBe('perch');
    expect(b.x).toBe(perch.x);
  });
  it('stays on its perch when nobody is near, and poses', () => {
    let b = newBird(1);
    for (let i = 0; i < 50; i++) b = stepBird(b, 100, { x: 0, y: 0 }, rng, bounds);
    expect(b.mode).toBe('perch');
    expect(birdPose(b, 0)).toBe('perch');
    expect(birdPose({ ...b, mode: 'flee' }, 0)).not.toBe('perch');
    expect(LAKE_BIRDS).toBeLessThanOrEqual(BIRD_PERCHES.length);
  });
});

describe('fish, butterflies, leaves', () => {
  it('fish stay inside their water rect, also when scared', () => {
    let fish = Array.from({ length: 4 }, (_, i) => newFishShadow(i));
    fish = scareFish(fish, { x: fish[0]!.x + 5, y: fish[0]!.y });
    expect(fish[0]!.fleeMs).toBeGreaterThan(0);
    for (let i = 0; i < 400; i++) fish = fish.map((f) => stepFish(f, 50));
    for (const f of fish) {
      const r = LAKE_WATER[f.rect]!;
      expect(f.x).toBeGreaterThanOrEqual(r.x);
      expect(f.x).toBeLessThanOrEqual(r.x + r.w);
      expect(f.y).toBeGreaterThanOrEqual(r.y);
      expect(f.y).toBeLessThanOrEqual(r.y + r.h);
    }
  });
  it('a far cast does not scare', () => {
    const f = newFishShadow(0);
    expect(scareFish([f], { x: f.x + 500, y: f.y })[0]!.fleeMs).toBe(0);
  });
  it('butterflies and leaves are whole px and deterministic', () => {
    const a = butterflyAt(1, 5000, { x: 100, y: 200 });
    expect(a).toEqual(butterflyAt(1, 5000, { x: 100, y: 200 }));
    expect(Number.isInteger(a.x) && Number.isInteger(a.y)).toBe(true);
    const trees = LAKE_TREES.map((t) => ({ ...t }));
    let falling = 0;
    for (let t = 0; t < 60_000; t += 500) if (leafAt(0, t, trees)) falling++;
    expect(falling).toBeGreaterThan(0);
    expect(falling).toBeLessThan(120);
    expect(leafAt(0, 1000, [])).toBeNull();
  });
});
