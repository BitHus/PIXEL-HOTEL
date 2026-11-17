// The GENERAL SPLICE RULE (step SG1, brief 10b, docs/PLAN-SPLICE-DUNGEON.md 2.2). Any seed with almost any other seed makes a new seed,
// by a pure hash of the sorted pair key: no rng, no clock, the same pair always gives the same result, in any order.
//   1. Same seed twice, a legendary seed or a seed marked noSplice: nothing happens.
//   2. A SPECIAL recipe (shared/data/splice.json, hand-authored, with a name and a hint) wins.
//   3. Else: a RANK (the higher of the two, one up in 1 of SPLICE_UP_ONE_IN pairs, at most SPLICE_RANK_CAP), a CATEGORY (weights from
//      shared/data/spliceRules.json by the two categories) and a seed of that category and rank from the POOL (not a starter seed, not
//      an ingredient, sorted by id). An empty pool steps the rank down, then up, then tries the next category.
// Three independent hashes (rank, category, index) of `${SPLICE_SALT}:${kind}:${pairKey}` are used so the choices do not correlate.
// FROZEN once the content ships (SG3): SPLICE_SALT, spliceRules.json and the pool order (ids sorted). Golden test: spliceRule.test.ts.

import { SPLICE_RANK_CAP, SPLICE_SALT, SPLICE_UP_ONE_IN } from './config.ts';
import rulesData from '../data/spliceRules.json';
import { SEED_CATEGORIES, seedCategory, type SeedCategory } from './seedCategory.ts';
import { allSeedIds, isSpliceable, isStarterSeed, seedRank } from './seeds.ts';
import { SPLICE_RECIPES, pairKey, type SpliceRecipe } from './spliceData.ts';
import type { Rank, SeedId } from './types.ts';

/** 32 bit FNV-1a of a string (the hash of the rule). */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

type Weights = Partial<Record<SeedCategory, number>>;
const RULES = rulesData as unknown as Record<string, Weights | string>;

const SPECIAL = new Map<string, SpliceRecipe>(SPLICE_RECIPES.map((r) => [pairKey(r.a, r.b), r]));
const RANK_INDEX: Record<Rank, number> = { common: 0, rare: 1, ultra_rare: 2, legendary: 3 };
const CAP_INDEX = RANK_INDEX[SPLICE_RANK_CAP];

/** The category weights for two seed categories (symmetric: the key is sorted). Falls back to the two categories themselves. */
export function categoryWeights(a: SeedCategory, b: SeedCategory): Weights {
  const w = RULES[pairKey(a, b)];
  if (w && typeof w === 'object') return w;
  return a === b ? { [a]: 1 } : { [a]: 1, [b]: 1 };
}

/** The result pool: seeds that are not starters, not legendary, not noSplice, listed by category and rank, sorted by id. Built once. */
let POOL: Map<string, SeedId[]> | null = null;
function poolOf(category: SeedCategory, rank: number): SeedId[] {
  if (!POOL) {
    POOL = new Map();
    for (const id of allSeedIds()) {
      if (isStarterSeed(id) || !isSpliceable(id)) continue;
      const k = `${seedCategory(id)}:${RANK_INDEX[seedRank(id)]}`;
      POOL.set(k, [...(POOL.get(k) ?? []), id]);
    }
  }
  return POOL.get(`${category}:${rank}`) ?? [];
}

/** SG6: every seed the general rule can hand out (the pool: not a starter, splice-able, rank at most SPLICE_RANK_CAP), sorted by id. */
export function poolResultSeeds(): SeedId[] {
  return allSeedIds()
    .filter((id) => !isStarterSeed(id) && isSpliceable(id) && RANK_INDEX[seedRank(id)] <= CAP_INDEX)
    .sort();
}

/** The category a hash picks from the weights (heaviest first, ties by category order, so the table order never matters). */
function pickCategory(w: Weights, h: number): SeedCategory[] {
  const list = SEED_CATEGORIES.filter((c) => (w[c] ?? 0) > 0).sort((p, q) => (w[q] ?? 0) - (w[p] ?? 0) || SEED_CATEGORIES.indexOf(p) - SEED_CATEGORIES.indexOf(q));
  const total = list.reduce((s, c) => s + (w[c] ?? 0), 0);
  let x = ((h >>> 8) & 0xffff) / 0x10000 * total;
  let at = 0;
  for (let i = 0; i < list.length; i++) {
    x -= w[list[i]!] ?? 0;
    if (x < 0) {
      at = i;
      break;
    }
  }
  return [...list.slice(at), ...list.slice(0, at)];
}

/** The result rank index of a general splice (before the pool steps): the higher input, one up in 1 of SPLICE_UP_ONE_IN pairs of equal ranks, capped. */
export function resultRankIndex(a: SeedId, b: SeedId): number {
  const ra = RANK_INDEX[seedRank(a)];
  const rb = RANK_INDEX[seedRank(b)];
  let rr = Math.max(ra, rb);
  if (ra === rb && fnv1a32(`${SPLICE_SALT}:rank:${pairKey(a, b)}`) % SPLICE_UP_ONE_IN === 0) rr += 1;
  return Math.min(rr, CAP_INDEX);
}

/** The general result of a pair, ignoring the special recipes (null when the rule finds nothing). */
export function generalResult(a: SeedId, b: SeedId): SeedId | null {
  const key = pairKey(a, b);
  const rr = resultRankIndex(a, b);
  const cats = pickCategory(categoryWeights(seedCategory(a), seedCategory(b)), fnv1a32(`${SPLICE_SALT}:cat:${key}`));
  // The categories the pick did not reach come last in the fixed category order, so a game with few seeds still finds something.
  const order = [...cats, ...SEED_CATEGORIES.filter((c) => !cats.includes(c))];
  const hIdx = fnv1a32(`${SPLICE_SALT}:idx:${key}`);
  for (const cat of order) {
    const ranks = [...Array.from({ length: rr + 1 }, (_, i) => rr - i), ...Array.from({ length: CAP_INDEX - rr }, (_, i) => rr + 1 + i)];
    for (const rk of ranks) {
      const pool = poolOf(cat, rk).filter((s) => s !== a && s !== b);
      if (pool.length > 0) return pool[hIdx % pool.length]!;
    }
  }
  return null;
}

/** The new seed two seeds make, or null ("nothing happens"). Order free. */
export function spliceResult(a: SeedId, b: SeedId): SeedId | null {
  if (a === b || !isSpliceable(a) || !isSpliceable(b)) return null;
  return SPECIAL.get(pairKey(a, b))?.result ?? generalResult(a, b);
}

/** True if this pair has a hand-authored (special) recipe. */
export function isSpecialPair(a: SeedId, b: SeedId): boolean {
  return a !== b && SPECIAL.has(pairKey(a, b));
}

export interface PairRecipe extends SpliceRecipe {
  /** True = a hand-authored recipe of splice.json. */
  special: boolean;
}

let ALL: PairRecipe[] | null = null;
/** Every pair of splice-able seeds that makes something (special and general), a < b by id, sorted by pair key. Built once. */
export function allRecipes(): readonly PairRecipe[] {
  if (!ALL) {
    const seeds = allSeedIds().filter(isSpliceable);
    const out: PairRecipe[] = [];
    for (let i = 0; i < seeds.length; i++) {
      for (let j = i + 1; j < seeds.length; j++) {
        const a = seeds[i]!;
        const b = seeds[j]!;
        const result = spliceResult(a, b);
        if (result) out.push({ a, b, result, special: isSpecialPair(a, b) });
      }
    }
    ALL = out;
  }
  return ALL;
}
