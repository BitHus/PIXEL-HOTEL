// What a seed is (steps BG6 and BG7): what it grows, its rank and its grow time. Block seeds grow their block, crop
// seeds their crop, splice seeds (spliceData.ts) a drink, furniture, clothes or a rarer good. Pure.

import { SEED_GROW_MS } from './config.ts';
import { isBlockId } from './blockTypes.ts';
import { cropOfSeed, getMaterialType } from './materials.ts';
import { SPLICE_SEEDS, type SeedGrows, type SpliceSeedType } from './spliceData.ts';
import type { MaterialId, Rank, SeedId } from './types.ts';

const SPLICE_BY_ID = new Map<string, SpliceSeedType>(SPLICE_SEEDS.map((s) => [s.id, s]));

export function spliceSeedType(seed: string): SpliceSeedType | undefined {
  return SPLICE_BY_ID.get(seed);
}

/** What a seed grows when planted (a block or crop seed: the block or crop). */
export function seedGrows(seed: SeedId): SeedGrows {
  const s = SPLICE_BY_ID.get(seed);
  if (s) return s.grows;
  const block = seed.endsWith('_seed') ? seed.slice(0, -'_seed'.length) : null;
  if (block !== null && isBlockId(block)) return { kind: 'material', id: block };
  return { kind: 'material', id: cropOfSeed(seed).id };
}

/** The material a seed grows; a seed that grows furniture or clothes gives the seed's own id (its icon is the picture). */
export function seedProduct(seed: SeedId): MaterialId {
  const g = seedGrows(seed);
  return g.kind === 'material' ? g.id : seed;
}

/** The rank of a seed: a splice seed has its own, else the rank of what it grows. */
export function seedRank(seed: SeedId): Rank {
  const s = SPLICE_BY_ID.get(seed);
  return s ? s.rank : getMaterialType(seedProduct(seed)).rank;
}

/** How long a fresh plant of this seed takes to be fully grown, ms (config SEED_GROW_MS by rank). */
export function seedGrowMs(seed: SeedId): number {
  return SEED_GROW_MS[seedRank(seed)];
}
