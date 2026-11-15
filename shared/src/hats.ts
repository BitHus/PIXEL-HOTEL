// Hats (step 9g-1): buying a catalog hat. Other hats come from events (Book rewards today; the rest are wired by their own events).
// Pure: the clock is passed in; gold goes through the ledger (reason 'catalog').

import { applyChange } from './ledger.ts';
import { hatCatalogPrice, getClothing } from './clothing.ts';
import { FISH_TYPES } from './fish.ts';
import type { GameState } from './gameState.ts';
import { enemyKey, isSeen, seenCount } from './seen.ts';
import type { Player } from './types.ts';

/** Buys a catalog hat for baseValue * 3 gold and unlocks it. Null = not sold, already owned, or not enough gold. */
export function buyHat(state: GameState, id: string, at: number): GameState | null {
  const price = hatCatalogPrice(id);
  if (price === null || !getClothing(id)) return null;
  if (state.player.unlockedClothing.includes(id)) return null;
  return applyChange(state, { reason: 'catalog', gold: -price, addClothing: [id], note: `hat ${id}` }, at);
}

/** Skeleton kills that earn the skull cap (the loot-table style drop, made certain so no luck is needed). */
export const SKULL_CAP_KILLS = 5;
/** Mine visits that earn the miner lamp cap. */
export const MINER_CAP_VISITS = 10;

/**
 * The event hats the player has earned from what the game already remembers (Player.seen, mineVisits), owned or not:
 * fisher_hat (a rare or better fish caught), skull_cap (SKULL_CAP_KILLS skeletons killed), knight_helm (the Bone King killed),
 * sunken_crown_hat (the sunken crown caught), miner_lamp_cap (the MINER_CAP_VISITS-th mine visit). flower_crown comes from a splice
 * seed (farm.ts harvest) and the Book hats from claimBookReward.
 */
export function earnedHats(p: Pick<Player, 'seen' | 'mineVisits'>): string[] {
  const out: string[] = [];
  if (FISH_TYPES.some((f) => f.rank !== 'common' && isSeen(p.seen, f.id))) out.push('fisher_hat');
  if (seenCount(p.seen, enemyKey('skeleton')) >= SKULL_CAP_KILLS) out.push('skull_cap');
  if (seenCount(p.seen, enemyKey('bone_king')) >= 1) out.push('knight_helm');
  if (isSeen(p.seen, 'sunken_crown')) out.push('sunken_crown_hat');
  if (p.mineVisits >= MINER_CAP_VISITS) out.push('miner_lamp_cap');
  return out;
}

/** Unlocks every earned hat not owned yet (straight into unlockedClothing, like a splice harvest: no gold or items move, so no ledger line); the same state when there is nothing new. */
export function grantEarnedHats(state: GameState): GameState {
  const fresh = earnedHats(state.player).filter((id) => !state.player.unlockedClothing.includes(id));
  if (fresh.length === 0) return state;
  return { ...state, player: { ...state.player, unlockedClothing: [...state.player.unlockedClothing, ...fresh] } };
}
