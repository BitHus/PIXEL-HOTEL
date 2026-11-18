// CEL-1 (docs/PLAN-CELLAR.md): the kitchen and cellar room kinds, their shapes, the cellar numbers and the 34 -> 35 migration.
import { describe, expect, it } from 'vitest';
import { CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, CELLAR_UNLOCK_LEVEL, CELLAR_UPGRADE_COST } from './config.ts';
import { MIGRATIONS } from './save.ts';
import { createRoom, defaultShape, doorRect, shapesFor } from './room.ts';
import { AMBIENT_LIGHT } from './config.ts';

describe('the cellar room (CEL-1; the kitchen is a walled tavern area since SAVE 37)', () => {
  it('the cellar has its shape with three growing levels, and there is no kitchen room kind', () => {
    expect(shapesFor('cellar' as const).map((s) => s.id)).toEqual(['cellar_room']);
    expect(shapesFor('cellar').map((s) => s.id)).toEqual(['cellar_room']);
    const sizes = (kind: 'cellar') => ([1, 2, 3] as const).map((l) => { const r = createRoom(1, kind, l, 1); return [r.w / 32, r.h / 32]; });
    expect(sizes('cellar')).toEqual([[8, 5], [10, 5], [10, 7]]);
    expect(defaultShape('cellar')).toBe('cellar_room');
  });

  it('has a door zone and a light', () => {
    for (const kind of ['cellar'] as const) {
      const r = createRoom(7, kind, 1, 1);
      expect(r.kind).toBe(kind);
      expect(doorRect(r).w).toBeGreaterThan(0);
      expect(AMBIENT_LIGHT[kind].strength).toBeGreaterThan(0);
    }
  });

  it('keeps the proposed cellar numbers', () => {
    expect([CELLAR_BUILD_COST, CELLAR_UNLOCK_LEVEL, [...CELLAR_UPGRADE_COST], [...CELLAR_RACK_MAX_BY_LEVEL]]).toEqual([300, 2, [400, 900], [2, 3, 3]]);
  });

  it('34 -> 35 leaves an old save as it is (the optional ids are simply missing)', () => {
    const old = { player: { id: 1 }, rooms: [], items: [] };
    expect(MIGRATIONS[34]!(old)).toBe(old);
  });
});
