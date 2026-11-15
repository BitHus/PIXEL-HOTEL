// Splicing (step BG7, brief 10b): two different seeds in one cell make a new seed from a fixed table. No random
// failure: a pair that is not in the table does nothing and the seeds stay in the bag. Pure; the rng is passed in.

import { SPLICE_BONUS_MS } from './config.ts';
import { seedGrowMs } from './seeds.ts';
import { SPLICE_RECIPES, pairKey, type SpliceRecipe } from './spliceData.ts';
import type { SeedId } from './types.ts';

export { SPLICE_RECIPES, SPLICE_SEEDS, pairKey } from './spliceData.ts';
export type { SeedGrows, SpliceRecipe, SpliceSeedType } from './spliceData.ts';

const BY_PAIR = new Map<string, SpliceRecipe>(SPLICE_RECIPES.map((r) => [pairKey(r.a, r.b), r]));

/** The recipe of a pair (any order), or null. A seed with itself has none. */
export function recipeFor(a: SeedId, b: SeedId): SpliceRecipe | null {
  return a === b ? null : (BY_PAIR.get(pairKey(a, b)) ?? null);
}

/** The new seed two seeds make, or null ("nothing happens"). */
export function splice(a: SeedId, b: SeedId): SeedId | null {
  return recipeFor(a, b)?.result ?? null;
}

/** How long a spliced cell grows: the longer of the two grow times plus SPLICE_BONUS_MS. */
export function spliceGrowMs(a: SeedId, b: SeedId): number {
  return Math.max(seedGrowMs(a), seedGrowMs(b)) + SPLICE_BONUS_MS;
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
