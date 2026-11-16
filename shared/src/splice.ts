// Splicing (steps BG7 and SG1, brief 10b): two different seeds in one cell make a new seed. A hand-authored SPECIAL recipe (splice.json) wins,
// else the general rule of spliceRule.ts decides (a pure hash of the pair, no random failure). Only the same seed twice, a legendary seed or a
// noSplice seed does nothing, and then both seeds stay in the bag. Pure; no rng.

import { SPLICE_BONUS_MS } from './config.ts';
import { seedGrowMs, seedRank } from './seeds.ts';
import { spliceResult } from './spliceRule.ts';
import type { Plant } from './room.ts';
import type { Rank } from './types.ts';
import { SPLICE_RECIPES, pairKey, type SpliceRecipe } from './spliceData.ts';
import type { SeedId } from './types.ts';

export { SPLICE_RECIPES, SPLICE_SEEDS, pairKey } from './spliceData.ts';
export type { SeedGrows, SpliceRecipe, SpliceSeedType } from './spliceData.ts';

const BY_PAIR = new Map<string, SpliceRecipe>(SPLICE_RECIPES.map((r) => [pairKey(r.a, r.b), r]));

/** The recipe of a pair (any order): the special one, else the general rule's; null when nothing happens. */
export function recipeFor(a: SeedId, b: SeedId): SpliceRecipe | null {
  const special = BY_PAIR.get(pairKey(a, b));
  if (special) return special;
  const result = spliceResult(a, b);
  return result ? { a, b, result } : null;
}

/** The new seed two seeds make, or null ("nothing happens"). */
export function splice(a: SeedId, b: SeedId): SeedId | null {
  return spliceResult(a, b);
}

/**
 * How long a spliced cell grows: the longest of the two seeds' grow times and the grow time of the RESULT's rank (so a rank-up cannot skip
 * time), plus SPLICE_BONUS_MS. A pair that makes nothing: the longer of the two plus the bonus.
 */
export function spliceGrowMs(a: SeedId, b: SeedId): number {
  const result = spliceResult(a, b);
  return Math.max(seedGrowMs(a), seedGrowMs(b), result ? seedGrowMs(result) : 0) + SPLICE_BONUS_MS;
}

/** True if this seed can be the result of a splice. */
export function isSpliceResult(seed: string): boolean {
  return SPLICE_RECIPES.some((r) => r.result === seed);
}

/** The recipes a seed is part of (as an ingredient). */
export function recipesWith(seed: SeedId): SpliceRecipe[] {
  return SPLICE_RECIPES.filter((r) => r.a === seed || r.b === seed);
}

/** The ingredient the Book shows for a recipe not found yet: the first one the player has seen (a seeds' own ids), else null. */
export function recipeHint(recipe: SpliceRecipe, seen: Readonly<Record<string, unknown>>): SeedId | null {
  if (seen[recipe.a] !== undefined) return recipe.a;
  if (seen[recipe.b] !== undefined) return recipe.b;
  return null;
}

// ---------- The preview (step SG1; the client dialog is SG5) ----------

export type SplicePreviewStatus = 'no_plant' | 'already_spliced' | 'ripe' | 'nothing' | 'known' | 'new';

export interface SplicePreview {
  status: SplicePreviewStatus;
  /** The two seeds that would be used up (the planted one, the one in the hand), or null without a plant. */
  uses: [SeedId, SeedId] | null;
  /** Only for a pair the player has found before ('known'): the seed it makes. A new mix keeps its result (and category) hidden. */
  result?: SeedId;
  /** For 'known' and 'new': the rank of what it makes. */
  rank?: Rank;
  /** For 'known' and 'new': how long the cell would grow, ms. */
  growMs?: number;
}

/** What tapping this plant with this seed would do, without changing anything. `found` = Player.splicesFound (pair keys). */
export function splicePreview(plant: Plant | null, seed: SeedId, found: readonly string[], at: number): SplicePreview {
  if (!plant) return { status: 'no_plant', uses: null };
  const uses: [SeedId, SeedId] = [plant.seed, seed];
  if (plant.with) return { status: 'already_spliced', uses };
  if (at >= plant.readyAt) return { status: 'ripe', uses };
  const result = spliceResult(plant.seed, seed);
  if (!result) return { status: 'nothing', uses };
  const growMs = spliceGrowMs(plant.seed, seed);
  if (found.includes(pairKey(plant.seed, seed))) return { status: 'known', uses, result, rank: seedRank(result), growMs };
  return { status: 'new', uses, rank: seedRank(result), growMs };
}
