// Gems (step BG5 starts them, BG4 adds the other sources): the second currency. You get them from
// what you do (today: breaking blocks), never from money, and they are never traded or sold.
// Pure: the rng is passed in.

import { BLOCK_DROPS, GEMS, GEM_RANK_MULT, GEM_TIERS } from './config.ts';
import type { Rank, Rng } from './types.ts';

export type GemSource = keyof typeof GEMS;

/** The gems one thing drops: nothing most of the time, else min to max times the rank bonus. */
export function gemDrop(source: GemSource, rank: Rank, rng: Rng): number {
  const g = GEMS[source];
  if (rng() >= g.chance) return 0;
  const n = g.min + Math.floor(rng() * (g.max - g.min + 1));
  return n * GEM_RANK_MULT[rank];
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
