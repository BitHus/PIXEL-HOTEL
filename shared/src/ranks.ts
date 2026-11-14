// Ranks (step 9e): every item, material, crop, food, ore, gem and furniture type has one of four
// ranks. Pure helpers; the colours and the base odds are in config (RANK_COLORS, RANK_WEIGHTS).

import { RANK_WEIGHTS } from './config.ts';
import { FURNITURE_TYPES } from './furniture.ts';
import { MATERIAL_TYPES } from './materials.ts';
import type { Rank, Rng } from './types.ts';

/** Lowest first. */
export const RANKS: readonly Rank[] = ['common', 'rare', 'ultra_rare', 'legendary'];
export const RANK_NAMES: Record<Rank, string> = { common: 'Common', rare: 'Rare', ultra_rare: 'Ultra rare', legendary: 'Legendary' };

const BY_ID = new Map<string, Rank>([...MATERIAL_TYPES.map((m) => [m.id, m.rank] as const), ...FURNITURE_TYPES.map((f) => [f.id, f.rank] as const)]);

/** The rank of a material or furniture type id ('common' for anything else, like gold). */
export function rankOf(id: string): Rank {
  return BY_ID.get(id) ?? 'common';
}

/** True for the ranks that get a sparkle (ultra_rare and legendary). */
export function sparkles(rank: Rank): boolean {
  return rank === 'ultra_rare' || rank === 'legendary';
}

/** The odds of each rank: RANK_WEIGHTS times a table's multiplier (missing = 1), as weights. */
export function rankWeights(multiplier: Partial<Record<Rank, number>> = {}): Record<Rank, number> {
  const out = {} as Record<Rank, number>;
  for (const r of RANKS) out[r] = RANK_WEIGHTS[r] * (multiplier[r] ?? 1);
  return out;
}

/**
 * Rolls a rank by weight. `has` says which ranks can come (a table without a legendary drop):
 * a rolled rank that cannot come falls to the next lower one that can, then to a higher one.
 */
export function rollRank(rng: Rng, multiplier: Partial<Record<Rank, number>> = {}, has: readonly Rank[] = RANKS): Rank {
  const w = rankWeights(multiplier);
  const total = RANKS.reduce((a, r) => a + w[r], 0);
  let roll = rng() * total;
  let picked = RANKS[RANKS.length - 1]!;
  for (const r of RANKS) {
    if (roll < w[r]) {
      picked = r;
      break;
    }
    roll -= w[r];
  }
  const at = RANKS.indexOf(picked);
  for (let i = at; i >= 0; i--) if (has.includes(RANKS[i]!)) return RANKS[i]!;
  for (let i = at + 1; i < RANKS.length; i++) if (has.includes(RANKS[i]!)) return RANKS[i]!;
  return picked;
}
