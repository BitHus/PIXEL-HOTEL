import { describe, expect, it } from 'vitest';
import { PALETTE } from './palette.ts';
import { RANK_COLORS, RANK_WEIGHTS } from './config.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import { MATERIAL_TYPES } from './materials.ts';
import { RANKS, rankOf, rankWeights, rollRank, sparkles } from './ranks.ts';
import { seededRng } from './rng.ts';

describe('ranks (step 9e)', () => {
  it('there are four ranks, each with a palette colour, and the base odds add up to 100', () => {
    expect(RANKS).toEqual(['common', 'rare', 'ultra_rare', 'legendary']);
    for (const r of RANKS) expect(PALETTE[RANK_COLORS[r]]).toBeDefined();
    expect(new Set(RANKS.map((r) => RANK_COLORS[r])).size).toBe(4);
    expect(RANKS.reduce((a, r) => a + RANK_WEIGHTS[r], 0)).toBe(100);
    expect(RANK_WEIGHTS).toEqual({ common: 75, rare: 20, ultra_rare: 4.5, legendary: 0.5 });
  });

  it('every material, seed, crop, food, ore, gem and furniture type has one of the four ranks', () => {
    for (const m of MATERIAL_TYPES) expect(RANKS, m.id).toContain(m.rank);
    for (const f of FURNITURE_TYPES) expect(RANKS, f.id).toContain(f.rank);
    // The old ranks are gone from the data (uncommon -> rare, rare -> ultra_rare, epic -> legendary).
    expect(rankOf('bone_throne')).toBe('legendary');
    expect(rankOf('coffin_table')).toBe('ultra_rare');
    expect(rankOf('chair')).toBe('common');
    expect(rankOf('crystal')).toBe('rare');
    expect(rankOf('gold')).toBe('common');
    expect(sparkles('rare')).toBe(false);
    expect(sparkles('ultra_rare') && sparkles('legendary')).toBe(true);
  });

  it('rolls ranks at the base odds', () => {
    const rng = seededRng(7);
    const n: Record<string, number> = {};
    const N = 200_000;
    for (let i = 0; i < N; i++) {
      const r = rollRank(rng);
      n[r] = (n[r] ?? 0) + 1;
    }
    expect(n.common! / N).toBeCloseTo(0.75, 2);
    expect(n.rare! / N).toBeCloseTo(0.2, 2);
    expect(n.ultra_rare! / N).toBeCloseTo(0.045, 2);
    expect(n.legendary! / N).toBeCloseTo(0.005, 2);
  });

  it('a multiplier shifts the odds', () => {
    expect(rankWeights({ legendary: 10 })).toEqual({ common: 75, rare: 20, ultra_rare: 4.5, legendary: 5 });
    const rng = seededRng(8);
    let legendary = 0;
    const N = 100_000;
    for (let i = 0; i < N; i++) if (rollRank(rng, { common: 0.4, rare: 2.5, ultra_rare: 5, legendary: 10 }) === 'legendary') legendary++;
    // 5 of 30 + 50 + 22.5 + 5 = 107.5
    expect(legendary / N).toBeCloseTo(5 / 107.5, 2);
  });

  it('a rank that cannot come falls to the next lower one, else to a higher one', () => {
    expect(rollRank(() => 0.999, {}, ['common', 'rare', 'ultra_rare'])).toBe('ultra_rare');
    expect(rollRank(() => 0.999, {}, ['common'])).toBe('common');
    expect(rollRank(() => 0.8, {}, ['common', 'legendary'])).toBe('common'); // a rare roll
    expect(rollRank(() => 0.1, {}, ['ultra_rare'])).toBe('ultra_rare'); // a common roll, nothing lower
    expect(rollRank(() => 0)).toBe('common');
    expect(rollRank(() => 0.7499)).toBe('common');
    expect(rollRank(() => 0.75)).toBe('rare');
    expect(rollRank(() => 0.95)).toBe('ultra_rare');
    expect(rollRank(() => 0.995)).toBe('legendary');
  });
});
