// Gems (step BG5 starts them, BG4 adds the other sources): the second currency. You get them from
// what you do (today: breaking blocks), never from money, and they are never traded or sold.
// Pure: the rng is passed in.

import { BLOCK_DROPS, GEMS, GEM_RANK_MULT, GEM_TIERS, TAVERN_GEM_CHANCE_MULT } from './config.ts';
import { gemTipChanceOf, harvestGemChanceOf, questGemsOf } from './skillRules.ts';
import type { Bonuses } from './stats.ts';
import type { Rank, Rng } from './types.ts';

export type GemSource = keyof typeof GEMS;

/** The gems one thing drops: nothing most of the time, else min to max times the rank bonus. */
export function gemDrop(source: GemSource, rank: Rank, rng: Rng, b?: Bonuses): number {
  const g = GEMS[source];
  if (rng() >= (source === 'harvest' ? harvestGemChanceOf(g.chance, b) : g.chance)) return 0; // Lucky sprout: the harvest chance
  const n = g.min + Math.floor(rng() * (g.max - g.min + 1));
  return source === 'quest' ? questGemsOf(n * GEM_RANK_MULT[rank], b, rng) : n * GEM_RANK_MULT[rank]; // Quest hand
}

/** One gem piece as it falls out of a block: its value (1, 5, 10) and the colours of its icon. */
export interface GemPiece {
  value: number;
  colors: readonly [string, string];
}

/** Splits an amount into pieces, biggest first (7 -> 5, 1, 1; 10 -> one 10). The values add up to the amount. */
export function gemPieces(amount: number): GemPiece[] {
  const out: GemPiece[] = [];
  let left = Math.max(0, Math.floor(amount));
  for (const t of GEM_TIERS) {
    while (left >= t.value) {
      out.push({ value: t.value, colors: t.colors });
      left -= t.value;
    }
  }
  return out;
}

/** The gems a broken block drops: its own table by rank (BLOCK_DROPS), 0 most of the time. */
export function blockGemDrop(rank: Rank, rng: Rng): number {
  const t = BLOCK_DROPS[rank];
  if (rng() >= t.gem) return 0;
  return t.gemMin + Math.floor(rng() * (t.gemMax - t.gemMin + 1));
}

/** The chance (0 to 1) that a happy guest who ordered something of this rank leaves a gem. */
export function tavernGemChance(rank: Rank, b?: Bonuses): number {
  return gemTipChanceOf(Math.min(1, GEMS.tavern.chance * TAVERN_GEM_CHANCE_MULT[rank]), b);
}

/** Expected gems of one happy guest's tip for an order of this rank (the closed form of tavernGemDrop). */
export function tavernTipGems(rank: Rank): number {
  return tavernGemChance(rank) * ((GEMS.tavern.min + GEMS.tavern.max) / 2);
}

/** The gems a happy tavern guest leaves with the coins (step S3): nothing most of the time, else min to max. Pure: the rng is passed in. */
export function tavernGemDrop(rank: Rank, rng: Rng, b?: Bonuses): number {
  if (rng() >= tavernGemChance(rank, b)) return 0;
  return GEMS.tavern.min + Math.floor(rng() * (GEMS.tavern.max - GEMS.tavern.min + 1));
}
