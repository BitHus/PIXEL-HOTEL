// Woodcutting on the lakeside (brief section 10d, step 9f). Eight trees at fixed places
// (lakeLayout.ts). Every tap is one swing with the axe (AXE_COOLDOWN_MS between swings, taps during
// the cooldown are ignored); a swing counts hitsPerSwing hits (the steel axe: 2). A tree falls
// after TREE_HITS hits and gives 2 to 3 wood plus, by a rolled rank, resin (rare), amber
// (ultra_rare) or a golden acorn (legendary). A stump is left and the tree grows back after
// TREE_REGROW_MS of real time: only felledAt is kept, so it also grows while the game is closed.
// Pure: the time and the rng are passed in. The loot goes through applyChange (ledger 'chop').

import {
  AXE_COOLDOWN_MS,
  TREE_HITS,
  TREE_REGROW_MS,
  TREE_WOOD_MAX,
  TREE_WOOD_MIN,
} from './config.ts';
import type { GameState } from './gameState.ts';
import { ownedAxe } from './gear.ts';
import { applyChange } from './ledger.ts';
import { TREE_COUNT } from './lakeLayout.ts';
import { gemDrop } from './gems.ts';
import { rollRank } from './ranks.ts';
import { rngInt } from './rng.ts';
import type { MaterialId, Rank, Rng } from './types.ts';

/** One tree: the hits it took so far (0 when whole), or the time it fell (a stump until it regrows). */
export interface TreeState {
  hits: number;
  felledAt: number | null;
}

export interface LakesideState {
  roomId: number;
  /** One per tree, in LAKE_TREES order. */
  trees: TreeState[];
  /** The axe can swing again from this time (the same clock as `now`). */
  axeReadyAt: number;
}

export function emptyLakeside(roomId: number): LakesideState {
  return { roomId, trees: Array.from({ length: TREE_COUNT }, () => ({ hits: 0, felledAt: null })), axeReadyAt: 0 };
}

/** True while a felled tree is a stump (it grows back TREE_REGROW_MS after it fell). */
export function isStump(tree: TreeState, now: number): boolean {
  return tree.felledAt !== null && now - tree.felledAt < TREE_REGROW_MS;
}

/** ms until a stump is a tree again, or null for a standing tree. */
export function regrowInMs(tree: TreeState, now: number): number | null {
  return isStump(tree, now) ? tree.felledAt! + TREE_REGROW_MS - now : null;
}

/** The trees as they are at `now`: a stump whose time is up is a whole tree again. */
export function growTrees(lake: LakesideState, now: number): LakesideState {
  if (!lake.trees.some((t) => t.felledAt !== null && !isStump(t, now))) return lake;
  return { ...lake, trees: lake.trees.map((t) => (t.felledAt !== null && !isStump(t, now) ? { hits: 0, felledAt: null } : t)) };
}

/** What a rank gives besides wood: resin (rare), amber (ultra_rare), a golden acorn (legendary), nothing for common. */
export const TREE_RANK_DROPS: Partial<Record<Rank, MaterialId>> = { rare: 'resin', ultra_rare: 'amber', legendary: 'golden_acorn' };

/** The loot of a felled tree: 2 to 3 wood and the rank drop (rolled with RANK_WEIGHTS), and the rank it rolled. */
export function fellRoll(rng: Rng): { loot: Partial<Record<MaterialId, number>>; rank: Rank } {
  const loot: Partial<Record<MaterialId, number>> = { wood: rngInt(rng, TREE_WOOD_MIN, TREE_WOOD_MAX) };
  const rank = rollRank(rng);
  const extra = TREE_RANK_DROPS[rank];
  if (extra) loot[extra] = 1;
  return { loot, rank };
}

/** The loot of a felled tree (see fellRoll). */
export function fellLoot(rng: Rng): Partial<Record<MaterialId, number>> {
  return fellRoll(rng).loot;
}

export type ChopKind = 'hit' | 'felled' | 'cooldown' | 'regrowing';

export interface ChopResult {
  kind: ChopKind;
  /** Hits the tree has taken now (0 after it fell). */
  hits: number;
  /** What a felled tree gave. */
  loot?: Partial<Record<MaterialId, number>>;
}

/**
 * One swing at tree `index`. 'cooldown' and 'regrowing' change nothing. Null if there is no such tree.
 * The first hit of a tree after a pause starts again from the hits it has (they are kept).
 */
export function chop(state: GameState, index: number, now: number, rng: Rng): { state: GameState; result: ChopResult } | null {
  const lake0 = state.lakeside;
  if (index < 0 || index >= TREE_COUNT || !lake0.trees[index]) return null;
  const lake = growTrees(lake0, now);
  const tree = lake.trees[index]!;
  if (isStump(tree, now)) return { state: { ...state, lakeside: lake }, result: { kind: 'regrowing', hits: 0 } };
  if (now < lake.axeReadyAt) return { state: { ...state, lakeside: lake }, result: { kind: 'cooldown', hits: tree.hits } };
  const hits = tree.hits + (ownedAxe(state.player.gear)?.hitsPerSwing ?? 1);
  const ready = now + AXE_COOLDOWN_MS;
  if (hits < TREE_HITS) {
    const trees = lake.trees.map((t, i) => (i === index ? { ...t, hits } : t));
    return { state: { ...state, lakeside: { ...lake, trees, axeReadyAt: ready } }, result: { kind: 'hit', hits } };
  }
  const { loot, rank } = fellRoll(rng);
  // Gems (step BG4): rolled after the wood and the rank drop, by the rank the tree rolled.
  const gems = gemDrop('chop', rank, rng);
  const paid = applyChange(state, { reason: 'chop', materials: loot, ...(gems > 0 ? { gems } : {}), note: `felled tree ${index}` }, now);
  if (!paid) return null;
  const trees = lake.trees.map((t, i) => (i === index ? { hits: 0, felledAt: now } : t));
  return { state: { ...paid, lakeside: { ...lake, trees, axeReadyAt: ready } }, result: { kind: 'felled', hits: 0, loot } };
}
