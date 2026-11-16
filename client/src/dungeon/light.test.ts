import { describe, expect, it } from 'vitest';
import { DUNGEON_BLOCK, type Chest, type DungeonMap, type Enemy } from '@pixel-hotel/shared';
import { LightPerf, dynamicLights, flickerRadius, lightRings, staticLights, stepRadius, vignetteAlpha } from './light.ts';

function map(): DungeonMap {
  const cols = 40;
  const rows = 40;
  const blocks = new Array(cols * rows).fill('wall');
  for (let r = 10; r < 30; r++) for (let c = 5; c < 35; c++) blocks[r * cols + c] = 'floor';
  return { seed: 1, n: 1, round: 1, cols, rows, blocks, rooms: [], spawn: { x: 200, y: 400 }, exit: { c: 20, r: 20 } } as unknown as DungeonMap;
}

describe('light', () => {
  it('steps radii to whole steps', () => {
    expect(stepRadius(77, 4)).toBe(76);
    expect(stepRadius(1, 4)).toBe(4);
  });
  it('flicker is stable per clock step, whole steps and bounded', () => {
    const a = flickerRadius(100, 500, 3, 8, 120, 4);
    expect(flickerRadius(100, 510, 3, 8, 120, 4)).toBe(a);
    for (let t = 0; t < 5000; t += 120) {
      const r = flickerRadius(100, t, 3, 8, 120, 4);
      expect(r % 4).toBe(0);
      expect(Math.abs(r - 100)).toBeLessThanOrEqual(8);
    }
  });
  it('rings go from big to small', () => {
    const rings = lightRings(100, 5, 0.05, 4);
    expect(rings).toHaveLength(5);
    expect(rings[0]!.r).toBe(100);
    expect(rings[4]!.r).toBeLessThan(rings[0]!.r);
  });
  it('static lights are stable and the torches sit on wall blocks', () => {
    const m = map();
    const a = staticLights(m, 'crypt');
    expect(staticLights(m, 'crypt')).toEqual(a);
    expect(a.some((s) => s.kind === 'exit')).toBe(true);
    for (const s of a.filter((x) => x.kind === 'torch')) {
      const c = Math.floor(s.x / DUNGEON_BLOCK);
      const r = Math.floor(s.y / DUNGEON_BLOCK);
      expect(m.blocks[r * m.cols + c]).not.toBe('floor');
    }
    expect(staticLights(m, 'mine').every((s) => s.kind !== 'torch')).toBe(true);
  });
  it('dynamic lights: closed chests and the king only', () => {
    const chests = [
      { id: 1, kind: 'golden', mimic: false, opened: false, x: 10, y: 50 },
      { id: 2, kind: 'wooden', mimic: false, opened: true, x: 10, y: 50 },
    ] as Chest[];
    const enemies = [{ id: 3, kind: 'bone_king', x: 5, y: 80 }, { id: 4, kind: 'slime', x: 1, y: 1 }] as Enemy[];
    expect(dynamicLights(chests, enemies).map((s) => s.kind)).toEqual(['gold_chest', 'crown']);
  });
  it('vignette is 0 inside and steps up to the max', () => {
    expect(vignetteAlpha(0.3, 0.55, 5, 0.5)).toBe(0);
    expect(vignetteAlpha(1, 0.55, 5, 0.5)).toBeCloseTo(0.5);
    expect(vignetteAlpha(0.7, 0.55, 5, 0.5)).toBeLessThan(0.5);
  });
  it('perf guard fails on a slow window only', () => {
    const fast = new LightPerf(50, 10);
    for (let i = 0; i < 30; i++) fast.feed(16.7);
    expect(fast.failed).toBe(false);
    const slow = new LightPerf(50, 10);
    for (let i = 0; i < 10; i++) slow.feed(33);
    expect(slow.failed).toBe(true);
  });
});

describe('light: props (DG2)', () => {
  it('braziers and other glow props add static lights; old maps have none', () => {
    const m = map();
    const base = staticLights(m, 'crypt').length;
    (m as { decor?: unknown }).decor = [
      { id: 1, kind: 'brazier', c: 10, r: 12, solid: false },
      { id: 2, kind: 'barrel', c: 11, r: 12, solid: false },
      { id: 3, kind: 'gem_pile', c: 12, r: 12, solid: false },
    ];
    const lights = staticLights(m, 'crypt');
    expect(lights.length).toBe(base + 1);
    const l = lights.find((x) => x.kind === 'decor')!;
    expect(l.color).toBeTruthy();
    expect(l.x).toBe(10.5 * DUNGEON_BLOCK);
  });
});
