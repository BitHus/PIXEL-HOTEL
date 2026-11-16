import { describe, expect, it } from 'vitest';
import { FURNITURE_TYPES } from '@pixel-hotel/shared';
import { DING_MS, FLAME_FRAME_COUNT, FLAME_SIZE, PROP_ANIMS, boxAnchor, dripAt, drawerHeightAt, flameFrame, flameRows, glintFrameAt, motionLevel, particleAlpha, pngToRel, spawnFor, twinkleFrame, type FlameKind } from './propAnimSpecs.ts';

describe('flame bitmaps', () => {
  it('every frame has the declared size and only known letters', () => {
    for (const kind of Object.keys(FLAME_SIZE) as FlameKind[]) {
      for (let f = 0; f < FLAME_FRAME_COUNT; f++) {
        const rows = flameRows(kind, f);
        expect(rows.length).toBe(FLAME_SIZE[kind].h);
        for (const r of rows) {
          expect(r.length).toBe(FLAME_SIZE[kind].w);
          expect(r).toMatch(/^[.wyrRdec]+$/);
        }
      }
    }
  });
  it('the last frame is the lowest', () => {
    const count = (rows: string[]): number => rows.join('').replace(/[.d]/g, '').length;
    for (const k of ['torch', 'fire_big', 'fire_med'] as FlameKind[]) expect(count(flameRows(k, 3))).toBeLessThan(count(flameRows(k, 0)));
  });
});

describe('timing', () => {
  it('flameFrame is deterministic, in range, and holds still on request', () => {
    for (let t = 0; t < 3000; t += 37) {
      const f = flameFrame(5, t, 1, false);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(FLAME_FRAME_COUNT);
      expect(flameFrame(5, t, 1, false)).toBe(f);
      expect(flameFrame(5, t, 1, true)).toBe(0);
    }
  });
  it('drawer opens and shuts; glint runs 5 frames then ends', () => {
    expect(drawerHeightAt(-1)).toBe(0);
    expect(drawerHeightAt(200)).toBe(5);
    expect(drawerHeightAt(DING_MS)).toBe(0);
    expect([40, 100, 160, 220, 280].map(glintFrameAt)).toEqual([0, 1, 2, 3, 4]);
    expect(glintFrameAt(400)).toBe(-1);
    const seen = new Set<number>();
    for (let t = 0; t < 4000; t += 20) seen.add(twinkleFrame(1, t, 3000));
    expect(seen.has(-1) && seen.has(2)).toBe(true);
  });
  it('a drip hangs, falls, splashes, rests', () => {
    const states = new Set<string>();
    for (let t = 0; t < 3400; t += 10) states.add(dripAt(1, t, 3400).state);
    expect([...states].sort()).toEqual(['fall', 'hang', 'none', 'splash']);
  });
});

describe('particles', () => {
  it('spawns are pure and alpha is stepped and fades', () => {
    const mk = (): (() => number) => { let s = 0.3; return () => (s = (s * 7.31 + 0.11) % 1); };
    expect(spawnFor('steam', mk())).toEqual(spawnFor('steam', mk()));
    expect(particleAlpha('steam', 0)).toBeGreaterThan(particleAlpha('steam', 0.9));
    expect(particleAlpha('smoke', 1)).toBe(0);
    expect(spawnFor('smoke', mk()).vy).toBeLessThan(0);
  });
  it('motion levels', () => {
    expect([motionLevel(false, false), motionLevel(true, false), motionLevel(true, true), motionLevel(false, true)]).toEqual([0, 1, 2, 2]);
  });
});

describe('placement and data', () => {
  it('boxAnchor picks the top box or a box by z', () => {
    const boxes = [{ dx: -3, dy: -13, w: 5, d: 5, z: 4, h: 22 }, { dx: -1, dy: -15, w: 3, d: 1, z: 32, h: 3 }];
    expect(boxAnchor(boxes, 'top')).toEqual({ x: 1, y: -47 });
    expect(boxAnchor(boxes, { z: 4 })).toEqual({ x: 0, y: -17 });
    expect(boxAnchor(boxes, { z: 9 })).toBeNull();
    expect(pngToRel(16, 70, 32, 76)).toEqual({ x: 0, y: -6 });
  });
  it('every animated id is a real furniture type', () => {
    const ids = new Set(FURNITURE_TYPES.map((t) => t.id));
    for (const id of Object.keys(PROP_ANIMS)) expect(ids.has(id)).toBe(true);
  });
});
