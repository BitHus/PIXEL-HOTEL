import { describe, expect, it } from 'vitest';
import { SEED_GROW_MS, SPLICE_BONUS_MS, SPLICE_RANK_CAP, SPLICE_UP_ONE_IN } from './config.ts';
import { SEED_CATEGORIES, seedCategory } from './seedCategory.ts';
import { allRecipes, categoryWeights, fnv1a32, generalResult, isSpecialPair, resultRankIndex, spliceResult } from './spliceRule.ts';
import { allSeedIds, isSpliceable, isStarterSeed, seedGrowMs, seedRank } from './seeds.ts';
import { SPLICE_RECIPES, pairKey, recipeFor, splicePreview, spliceGrowMs } from './splice.ts';
import { RANKS } from './ranks.ts';
import type { Plant } from './room.ts';
import type { SeedId } from './types.ts';

const seeds = (): SeedId[] => allSeedIds().filter(isSpliceable);
const rk = (s: SeedId): number => RANKS.indexOf(seedRank(s));

// Frozen results of 30 general pairs (step SG1). If this test fails, a change to SPLICE_SALT, spliceRules.json, the pool or the hash moved
// results players may already have found: do not "fix" it by re-pinning once the content has shipped (NOTES SG1).
const GOLDEN: [string, string, string][] = [
  ['amberbud_seed', 'baggy_seed', 'flower_crown_seed'],
  ['amberbud_seed', 'glowcap_spore', 'flaxbloom_seed'],
  ['amberbud_seed', 'stone_seed', 'gilded_chair_seed'],
  ['baggy_seed', 'flaxbloom_seed', 'amberbud_seed'],
  ['baggy_seed', 'pumpkin_seed', 'tunic_seed'],
  ['brick_seed', 'flaxbloom_seed', 'vine_bench_seed'],
  ['brick_seed', 'pumpkin_seed', 'vine_bench_seed'],
  ['carrot_seed', 'flower_crown_seed', 'mohawk_seed'],
  ['carrot_seed', 'stone_seed', 'hopvine_seed'],
  ['cinder_block_seed', 'honeybloom_seed', 'honey_table_seed'],
  ['cinder_block_seed', 'vine_bench_seed', 'gilded_chair_seed'],
  ['clay_seed', 'lantern_block_seed', 'vine_bench_seed'],
  ['dirt_seed', 'flower_crown_seed', 'ember_lamp_seed'],
  ['dirt_seed', 'tunic_seed', 'mohawk_seed'],
  ['ember_lamp_seed', 'mossy_stone_seed', 'gilded_chair_seed'],
  ['flaxbloom_seed', 'gilded_chair_seed', 'amberbud_seed'],
  ['flaxbloom_seed', 'pumpkin_seed', 'amberbud_seed'],
  ['flower_crown_seed', 'honeybloom_seed', 'hopvine_seed'],
  ['flower_crown_seed', 'turnip_seed', 'spiritbrew_seed'],
  ['gilded_chair_seed', 'pumpkin_seed', 'spiritbrew_seed'],
  ['glass_seed', 'planks_seed', 'vine_bench_seed'],
  ['glowcap_spore', 'lantern_block_seed', 'honeybloom_seed'],
  ['honey_table_seed', 'honeybloom_seed', 'flower_crown_seed'],
  ['honey_table_seed', 'tunic_seed', 'flower_crown_seed'],
  ['honeybloom_seed', 'vine_bench_seed', 'hopvine_seed'],
  ['lantern_block_seed', 'mohawk_seed', 'vine_bench_seed'],
  ['mohawk_seed', 'pumpkin_seed', 'spiritbrew_seed'],
  ['mossy_stone_seed', 'stone_seed', 'vine_bench_seed'],
  ['potato_seed', 'thatch_seed', 'honeybloom_seed'],
  ['spiritbrew_seed', 'thatch_seed', 'ember_lamp_seed'],
];

describe('the general splice rule (step SG1)', () => {
  it('fnv1a32 is the standard hash', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('is deterministic and order free for every pair', () => {
    const list = seeds();
    for (const a of list) {
      for (const b of list) {
        expect(spliceResult(a, b), `${a}+${b}`).toBe(spliceResult(b, a));
        expect(spliceResult(a, b)).toBe(spliceResult(a, b));
      }
    }
  });

  it('the same seed twice, a legendary seed and a noSplice seed do nothing; every other pair makes a seed', () => {
    for (const a of seeds()) expect(spliceResult(a, a)).toBeNull();
    expect(spliceResult('dirt_seed', 'heartwood_throne_seed')).toBeNull();
    expect(spliceResult('heartwood_throne_seed', 'turnip_seed')).toBeNull();
    expect(isSpliceable('heartwood_throne_seed')).toBe(false);
    const n = seeds().length;
    expect(allRecipes().length).toBe((n * (n - 1)) / 2); // no pair is left without a result
  });

  it('special recipes win, all of them, in both orders, and allRecipes marks them', () => {
    expect(SPLICE_RECIPES.length).toBeGreaterThanOrEqual(38);
    for (const r of SPLICE_RECIPES) {
      expect(spliceResult(r.a, r.b)).toBe(r.result);
      expect(spliceResult(r.b, r.a)).toBe(r.result);
      expect(recipeFor(r.a, r.b)).toEqual(r);
      expect(isSpecialPair(r.a, r.b)).toBe(true);
    }
    expect(allRecipes().filter((r) => r.special).length).toBe(SPLICE_RECIPES.length);
  });

  it('the rank rule: never legendary, never above the cap, never a starter seed or an ingredient', () => {
    const cap = RANKS.indexOf(SPLICE_RANK_CAP);
    for (const r of allRecipes().filter((x) => !x.special)) {
      expect(rk(r.result), `${r.a}+${r.b}`).toBeLessThanOrEqual(cap);
      expect(r.result).not.toBe(r.a);
      expect(r.result).not.toBe(r.b);
      expect(isStarterSeed(r.result), r.result).toBe(false);
      expect(isSpliceable(r.result)).toBe(true);
    }
  });

  it('the rank the rule asks for is the higher input, one up in about 1 of SPLICE_UP_ONE_IN equal pairs, capped', () => {
    const cap = RANKS.indexOf(SPLICE_RANK_CAP);
    let up = 0;
    let same = 0;
    const list = seeds();
    for (const a of list) {
      for (const b of list) {
        if (a >= b) continue;
        const want = resultRankIndex(a, b);
        const hi = Math.max(rk(a), rk(b));
        expect(want).toBeLessThanOrEqual(Math.min(hi + 1, cap));
        expect(want).toBeGreaterThanOrEqual(Math.min(hi, cap));
        if (rk(a) === rk(b)) {
          same++;
          if (want > hi) up++;
        }
      }
    }
    expect(up / same).toBeGreaterThan(0.5 / SPLICE_UP_ONE_IN);
    expect(up / same).toBeLessThan(2 / SPLICE_UP_ONE_IN);
  });

  it('the category weights are symmetric and defined for every pair of categories', () => {
    for (const a of SEED_CATEGORIES) {
      for (const b of SEED_CATEGORIES) {
        const w = categoryWeights(a, b);
        expect(w, `${a}+${b}`).toEqual(categoryWeights(b, a));
        const total = Object.values(w).reduce((s, x) => s + (x ?? 0), 0);
        expect(total, `${a}+${b}`).toBeGreaterThan(0);
        for (const k of Object.keys(w)) expect(SEED_CATEGORIES).toContain(k);
        // A written table entry, not the fallback: every pair of categories has its own line in spliceRules.json.
        expect(Object.keys(w).length, `${a}+${b}`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('every seed has a category', () => {
    for (const s of allSeedIds()) expect(SEED_CATEGORIES).toContain(seedCategory(s));
    expect(seedCategory('turnip_seed')).toBe('crop');
    expect(seedCategory('dirt_seed')).toBe('block');
    expect(seedCategory('hopvine_seed')).toBe('drink');
    expect(seedCategory('vine_bench_seed')).toBe('furniture');
    expect(seedCategory('mohawk_seed')).toBe('clothing');
    expect(seedCategory('flaxbloom_seed')).toBe('material');
  });

  it('GOLDEN: 30 general results are frozen (a changed rule or pool shows here)', () => {
    for (const [a, b, result] of GOLDEN) {
      expect(isSpecialPair(a as SeedId, b as SeedId), `${a}+${b} must be a general pair`).toBe(false);
      expect(generalResult(a as SeedId, b as SeedId), `${a}+${b}`).toBe(result);
      expect(spliceResult(b as SeedId, a as SeedId), `${b}+${a}`).toBe(result);
    }
  });

  it('every pool seed is the result of at least one pair (nothing in the pool is unreachable)', () => {
    const made = new Set(allRecipes().map((r) => r.result));
    for (const s of allSeedIds()) if (!isStarterSeed(s) && isSpliceable(s)) expect(made.has(s), s).toBe(true);
  });

  it('a splice cell grows for the longest of the two seeds and the result rank, plus the bonus (a rank up cannot skip time)', () => {
    for (const r of allRecipes()) {
      expect(spliceGrowMs(r.a, r.b)).toBe(Math.max(seedGrowMs(r.a), seedGrowMs(r.b), seedGrowMs(r.result)) + SPLICE_BONUS_MS);
    }
    const up = allRecipes().find((r) => rk(r.a) === 0 && rk(r.b) === 0 && rk(r.result) === 1);
    if (up) expect(spliceGrowMs(up.a, up.b)).toBe(SEED_GROW_MS.rare + SPLICE_BONUS_MS);
  });
});

describe('splicePreview (step SG1)', () => {
  const plant = (over: Partial<Plant> = {}): Plant => ({ seed: 'dirt_seed', plantedAt: 0, readyAt: 100_000, ...over });

  it('no plant, already spliced, ripe and nothing are told apart', () => {
    expect(splicePreview(null, 'turnip_seed', [], 0)).toEqual({ status: 'no_plant', uses: null });
    expect(splicePreview(plant({ with: 'turnip_seed' }), 'potato_seed', [], 0).status).toBe('already_spliced');
    expect(splicePreview(plant(), 'turnip_seed', [], 100_000).status).toBe('ripe');
    expect(splicePreview(plant(), 'dirt_seed', [], 0).status).toBe('nothing');
    expect(splicePreview(plant(), 'heartwood_throne_seed', [], 0).status).toBe('nothing');
  });

  it('a new mix shows rank and time only; a found mix also shows the result', () => {
    const fresh = splicePreview(plant(), 'turnip_seed', [], 0);
    const result = spliceResult('dirt_seed', 'turnip_seed')!;
    expect(fresh).toEqual({ status: 'new', uses: ['dirt_seed', 'turnip_seed'], rank: seedRank(result), growMs: spliceGrowMs('dirt_seed', 'turnip_seed') });
    expect(fresh.result).toBeUndefined();
    const known = splicePreview(plant(), 'turnip_seed', [pairKey('dirt_seed', 'turnip_seed')], 0);
    expect(known).toMatchObject({ status: 'known', result, rank: seedRank(result) });
  });

  it('works for a general pair too (no recipe in splice.json)', () => {
    const p = splicePreview(plant({ seed: 'brick_seed' }), 'flaxbloom_seed', [], 0);
    expect(p.status).toBe('new');
    expect(p.growMs).toBe(spliceGrowMs('brick_seed', 'flaxbloom_seed'));
  });
});
