import { describe, expect, it } from 'vitest';
import { DUST_MAX, DUST_PER_LIGHT, FLICKER_BRIGHTNESS, FLICKER_RADIUS, FURNITURE_TYPES, IDLE_SHIFT_EVERY_MS, LIGHT_STEP_MS, PALETTE, getFurnitureType, type FurnitureItem } from '@pixel-hotel/shared';
import { dustLightCount, dustSpeck, ellipseRows, flickerAt, hash01, idleShift, itemLights, lightFalloff, lightPoint, shadowSize } from './atmosphere.ts';

const item = (uid: number, typeId: string, over: Partial<FurnitureItem> = {}): FurnitureItem => ({ uid, typeId, ownerId: 1, roomId: 1, x: 100, y: 200, facing: 'down', onItemUid: null, ...over });

describe('hash01', () => {
  it('is stable and stays in [0, 1)', () => {
    for (let i = 0; i < 200; i++) {
      const v = hash01(i, i * 7);
      expect(v).toBe(hash01(i, i * 7));
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('lightFalloff', () => {
  it('is 1 at the flame, 0 at the edge and beyond, and only gets weaker on the way', () => {
    expect(lightFalloff(0)).toBe(1);
    expect(lightFalloff(1)).toBe(0);
    expect(lightFalloff(2)).toBe(0);
    expect(lightFalloff(-1)).toBe(1);
    let last = 1;
    for (let d = 0.1; d <= 1; d += 0.1) {
      const v = lightFalloff(d);
      expect(v).toBeLessThan(last);
      last = v;
    }
    // Most of the light is near the flame.
    expect(lightFalloff(0.5)).toBeLessThan(0.5);
  });
});

describe('flickerAt', () => {
  it('a steady light never changes', () => {
    expect(flickerAt(3, 12345, 0)).toEqual({ radius: 1, brightness: 1 });
  });
  it('stays inside the small flicker range and only changes per step', () => {
    let changed = false;
    for (let t = 0; t < 20_000; t += 37) {
      const f = flickerAt(5, t, 1);
      expect(f.radius).toBeLessThanOrEqual(1);
      expect(f.radius).toBeGreaterThanOrEqual(1 - FLICKER_RADIUS);
      expect(f.brightness).toBeLessThanOrEqual(1);
      expect(f.brightness).toBeGreaterThanOrEqual(1 - FLICKER_BRIGHTNESS);
      expect(f).toEqual(flickerAt(5, Math.floor(t / LIGHT_STEP_MS) * LIGHT_STEP_MS, 1));
      if (f.brightness !== flickerAt(5, 0, 1).brightness) changed = true;
    }
    expect(changed).toBe(true);
  });
});

describe('lights from furniture data', () => {
  it('the candle stand, counter, skull lamp and wall torch are light sources with palette colours', () => {
    const lit = FURNITURE_TYPES.filter((t) => t.light).map((t) => t.id);
    expect(lit.sort()).toEqual(['counter', 'lamp', 'skull_lamp', 'wall_torch']);
    for (const t of FURNITURE_TYPES) {
      if (!t.light) continue;
      expect(PALETTE[t.light.color]).toBeDefined();
      expect(t.light.radius).toBeGreaterThan(0);
      expect(t.light.flicker).toBeGreaterThanOrEqual(0);
      expect(t.light.flicker).toBeLessThanOrEqual(1);
    }
  });
  it('a floor light sits in the middle of its footprint, a wall light halfway up', () => {
    const lamp = getFurnitureType('lamp');
    expect(lightPoint(item(1, 'lamp'), lamp)).toEqual({ x: 100, y: 200 - lamp.d / 2 });
    const torch = getFurnitureType('wall_torch');
    expect(lightPoint(item(2, 'wall_torch', { y: 0 }), torch)).toEqual({ x: 100, y: -torch.height / 2 });
  });
  it('itemLights takes only lit items of this room that are shown', () => {
    const items = [item(1, 'lamp'), item(2, 'chair'), item(3, 'lamp', { roomId: 2 }), item(4, 'lamp', { roomId: null }), item(5, 'wall_torch')];
    expect(itemLights(items, 1, getFurnitureType).map((l) => l.seed)).toEqual([1, 5]);
    expect(itemLights(items, 1, getFurnitureType, new Set([1])).map((l) => l.seed)).toEqual([5]);
  });
});

describe('ellipseRows', () => {
  it('is symmetric, widest in the middle and inside rx', () => {
    const rows = ellipseRows(12, 4);
    expect(rows.map((r) => r.dy)).toEqual([-3, -2, -1, 0, 1, 2, 3]);
    expect(rows[3]?.half).toBe(12);
    for (let i = 0; i < rows.length; i++) {
      expect(rows[i]?.half).toBe(rows[rows.length - 1 - i]?.half);
      expect(rows[i]?.half).toBeLessThanOrEqual(12);
    }
    expect(rows[0]!.half).toBeLessThan(rows[1]!.half);
  });
});

describe('shadowSize', () => {
  it('is a bit wider than the footprint and stays flat', () => {
    expect(shadowSize(32, 32)).toEqual({ rx: 19, ry: 6 });
    expect(shadowSize(24, 4).ry).toBe(3);
    expect(shadowSize(80, 200).ry).toBe(6);
  });
});

describe('idleShift', () => {
  it('is mostly 0, sometimes one px to a side', () => {
    const seen = new Set<number>();
    let still = 0;
    const n = 2000;
    for (let i = 0; i < n; i++) {
      const s = idleShift(-3, i * 97);
      seen.add(s);
      if (s === 0) still++;
    }
    expect([...seen].sort()).toEqual([-1, 0, 1]);
    expect(still / n).toBeGreaterThan(0.6);
    expect(idleShift(-3, 500)).toBe(idleShift(-3, 500));
    expect(IDLE_SHIFT_EVERY_MS).toBeGreaterThan(0);
  });
});

describe('dust', () => {
  it('never asks for more specks than DUST_MAX', () => {
    expect(dustLightCount(2)).toBe(2);
    expect(dustLightCount(100) * DUST_PER_LIGHT).toBeLessThanOrEqual(DUST_MAX);
  });
  it('specks stay inside their pool, on whole px, and move slowly', () => {
    const light = { x: 200, y: 150, seed: 9, light: { radius: 96, color: 10, flicker: 1 } };
    for (let i = 0; i < DUST_PER_LIGHT; i++) {
      for (let t = 0; t < 120_000; t += 1700) {
        const s = dustSpeck(light, i, t);
        expect(Number.isInteger(s.x) && Number.isInteger(s.y)).toBe(true);
        expect(Math.hypot(s.x - light.x, s.y - (light.y - 18))).toBeLessThanOrEqual(96);
      }
      const a = dustSpeck(light, i, 1000);
      const b = dustSpeck(light, i, 1100);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeLessThanOrEqual(3);
    }
  });
});
