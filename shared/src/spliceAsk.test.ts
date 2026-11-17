import { describe, expect, it } from 'vitest';
import { allSeedIds, seedRank } from './seeds.ts';
import { spliceDialogText, spliceGrowText, spliceNeedsAsk } from './spliceAsk.ts';
import { splicePreview, pairKey } from './splice.ts';
import type { Plant } from './room.ts';

const plant = (seed: string): Plant => ({ seed, plantedAt: 0, readyAt: 1e9 }) as Plant;

describe('spliceNeedsAsk (SG5)', () => {
  it('a new mix always asks; a known mix of common seeds does not', () => {
    const commons = allSeedIds().filter((s) => seedRank(s) === 'common');
    let checked = 0;
    for (const a of commons.slice(0, 8)) {
      for (const b of commons.slice(0, 8)) {
        const fresh = splicePreview(plant(a), b, [], 0);
        if (fresh.status === 'new') {
          expect(spliceNeedsAsk(fresh)).toBe(true);
          const known = splicePreview(plant(a), b, [pairKey(a, b)], 0);
          expect(known.status).toBe('known');
          expect(spliceNeedsAsk(known)).toBe(known.rank !== 'common');
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('a known mix with a rare+ ingredient asks; non-splice statuses never ask', () => {
    const rare = allSeedIds().find((s) => seedRank(s) !== 'common')!;
    const p = splicePreview(plant(rare), 'turnip_seed', [pairKey(rare, 'turnip_seed')], 0);
    if (p.status === 'known') expect(spliceNeedsAsk(p)).toBe(true);
    expect(spliceNeedsAsk({ status: 'ripe', uses: ['a', 'b'] as never })).toBe(false);
    expect(spliceNeedsAsk({ status: 'nothing', uses: ['a', 'b'] as never })).toBe(false);
    expect(spliceNeedsAsk({ status: 'no_plant', uses: null })).toBe(false);
  });
});

describe('spliceDialogText (SG5, no spoilers)', () => {
  it('a new mix hides the result, a known one shows it', () => {
    const a = 'dirt_seed';
    const b = 'turnip_seed';
    const fresh = splicePreview(plant(a), b, [], 0);
    expect(fresh.result).toBeUndefined();
    expect(spliceDialogText(fresh).resultId).toBeNull();
    const known = splicePreview(plant(a), b, [pairKey(a, b)], 0);
    expect(spliceDialogText(known).resultId).toBe(known.result);
  });
  it('grow text', () => {
    expect(spliceGrowText(22 * 60_000)).toBe('about 22 min');
    expect(spliceGrowText(3 * 3_600_000)).toBe('about 3 h');
    expect(spliceGrowText(1000)).toBe('about 1 min');
  });
});
