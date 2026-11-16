import { describe, expect, it } from 'vitest';
import { generateFloor, type DungeonMap } from '@pixel-hotel/shared';
import { decorIsFlat, decorKind, decorLights, decorVariant, drawDecorProp, landmarkOf, landmarkToast } from './decor.ts';
import { PROP_KINDS } from './propArt.ts';

describe('decor (DG2)', () => {
  it('every kind of 40 crypt floors has art, an alias or the gem pile', () => {
    const known = new Set<string>([...PROP_KINDS, 'gem_pile']);
    for (let seed = 1; seed <= 40; seed++) {
      for (const d of generateFloor(seed, 1, 2).map.decor ?? []) {
        expect(known.has(decorKind(d.kind)), d.kind).toBe(true);
        expect(drawDecorProp(d.kind, d.c, d.r, 0).children.length).toBeGreaterThan(0);
      }
    }
  });
  it('a floor has one landmark line; the lights sit on the props', () => {
    const { map } = generateFloor(7, 1, 2);
    expect(landmarkOf(map)).not.toBeNull();
    expect(landmarkToast(map)).toBeTruthy();
    for (const l of decorLights(map)) expect(l.kind).toBe('decor');
  });
  it('an old run without decor has no props, lights or landmark', () => {
    const { map } = generateFloor(7, 1, 2);
    const old = { ...map } as { decor?: unknown; extras?: unknown; links?: unknown };
    delete old.decor;
    delete old.extras;
    delete old.links;
    const m = old as unknown as DungeonMap;
    expect(decorLights(m)).toEqual([]);
    expect(landmarkOf(m)).toBeNull();
    expect(landmarkToast(m)).toBeNull();
  });
  it('variants are stable; decals are flat, tall props are not', () => {
    expect(decorVariant(3, 4)).toBe(decorVariant(3, 4));
    expect(decorIsFlat('crack')).toBe(true);
    expect(decorIsFlat('statue')).toBe(false);
  });
});
