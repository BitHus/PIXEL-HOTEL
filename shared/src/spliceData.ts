// Splicing data (step BG7): the seeds only splicing makes (shared/data/spliceSeeds.json) and the recipe table
// (shared/data/splice.json). Data and types only, no other imports, so materials.ts can read it. Rules: splice.ts.

import recipeData from '../data/splice.json';
import seedData from '../data/spliceSeeds.json';
import type { Icon } from './icons.ts';
import type { MaterialId, Rank, SeedId, SpliceSeedId } from './types.ts';

/** What a seed grows when planted alone: a stackable good, a furniture item or a clothing piece (unlocked forever). */
export type SeedGrows = { kind: 'material'; id: MaterialId } | { kind: 'furniture'; id: string } | { kind: 'clothing'; id: string };

export interface SpliceSeedType {
  id: SpliceSeedId;
  name: string;
  rank: Rank;
  baseValue: number;
  icon: Icon;
  grows: SeedGrows;
  /** True = this seed never takes part in a splice (step SG1). */
  noSplice?: boolean;
}

/** One recipe: a + b = result (order does not matter). */
export interface SpliceRecipe {
  a: SeedId;
  b: SeedId;
  result: SeedId;
}

export const SPLICE_SEEDS = seedData as SpliceSeedType[];
export const SPLICE_RECIPES = recipeData as SpliceRecipe[];

/** The key of a pair: the two ids sorted, joined with '+' (a + b and b + a are the same key). */
export function pairKey(a: string, b: string): string {
  return a < b ? `${a}+${b}` : `${b}+${a}`;
}
