import { describe, expect, it } from 'vitest';
import { GEMS, GEM_RANK_MULT } from './config.ts';
import { gemDrop, type GemSource } from './gems.ts';
import type { Rank, Rng } from './types.ts';

/** An rng that returns these numbers in turn (then the last one forever). */
const seq = (...v: number[]): Rng => {
  let i = 0;
  return () => v[Math.min(i++, v.length - 1)]!;
};

const SOURCES = Object.keys(GEMS) as GemSource[];
const RANKS: Rank[] = ['common', 'rare', 'ultra_rare', 'legendary'];

describe('gemDrop', () => {
  it('has a source for every place that gives gems', () => {
    for (const s of ['block', 'harvest', 'chest', 'kill', 'mimic', 'boss', 'rock', 'chop', 'fish', 'quest', 'book']) expect(SOURCES).toContain(s);
  });

  it.each(SOURCES)('%s: nothing when the roll is at or above the chance', (source) => {
    const g = GEMS[source];
    if (g.chance >= 1) return;
    expect(gemDrop(source, 'common', seq(g.chance, 0))).toBe(0);
    expect(gemDrop(source, 'legendary', seq(0.999, 0))).toBe(0);
  });

  it.each(SOURCES)('%s: min with a low roll, max with a high one, times the rank bonus', (source) => {
    const g = GEMS[source];
    for (const rank of RANKS) {
      expect(gemDrop(source, rank, seq(0, 0))).toBe(g.min * GEM_RANK_MULT[rank]);
      expect(gemDrop(source, rank, seq(0, 0.999))).toBe(g.max * GEM_RANK_MULT[rank]);
    }
  });

  it('always drops where the chance is 1 (boss, quest, Book)', () => {
    for (const s of ['boss', 'quest', 'book'] as const) expect(gemDrop(s, 'common', seq(0.9999, 0))).toBeGreaterThan(0);
  });

  it('is small: no source gives more than 3 at common rank', () => {
    for (const s of SOURCES) expect(GEMS[s].max).toBeLessThanOrEqual(3);
  });

  it('uses its rolls in a fixed order (chance, then amount) with a fixed rng', () => {
    const calls: number[] = [];
    const rng: Rng = () => {
      calls.push(calls.length);
      return 0;
    };
    gemDrop('chest', 'rare', rng);
    expect(calls.length).toBe(2);
    calls.length = 0;
    gemDrop('chest', 'rare', () => {
      calls.push(1);
      return 0.99;
    });
    expect(calls.length).toBe(1);
  });
});
