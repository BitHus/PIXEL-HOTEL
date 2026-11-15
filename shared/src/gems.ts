// Gems (step BG5 starts them, BG4 adds the other sources): the second currency. You get them from
// what you do (today: breaking blocks), never from money, and they are never traded or sold.
// Pure: the rng is passed in.

import { GEMS, GEM_RANK_MULT } from './config.ts';
import type { Rank, Rng } from './types.ts';

export type GemSource = keyof typeof GEMS;

/** The gems one thing drops: nothing most of the time, else min to max times the rank bonus. */
export function gemDrop(source: GemSource, rank: Rank, rng: Rng): number {
  const g = GEMS[source];
  if (rng() >= g.chance) return 0;
  const n = g.min + Math.floor(rng() * (g.max - g.min + 1));
  return n * GEM_RANK_MULT[rank];
}
