// MG-7 (docs/PLAN-MINIGAMES.md 4): the skill tree's stats, read by the rules. Every helper takes the Bonuses (skills.ts skillStats) and returns the value a
// rule uses; no bonus = the plain config number, exactly. No node adds gold directly (CLAUDE.md 13). Pure.

import {
  AWAY_ORDERS_MAX,
  BAG_SLOTS,
  CASK_SLOTS,
  GUEST_MAX,
  PICKAXE_COOLDOWN_MS,
  RUN_BAG_SLOTS,
  POUR_PERFECT_RANGE,
  STOVE_BATCH_MAX,
  TAP_CAP,
  TRAY_MAX,
  GEM_CHANCE,
  ENEMY_WINDUP_MS,
  DIG_GLINT_BLOCKS,
  DIG_LIGHT_BLOCKS,
  DUNGEON_BLOCK,
} from './config.ts';
import { effective, type Bonuses } from './stats.ts';
import { skillStats } from './skills.ts';
import type { Player } from './types.ts';

/** The bonuses of a player's owned skill ranks (empty without skills). */
export function bonusesOf(p: Pick<Player, 'skills'>): Bonuses {
  return skillStats(p);
}

// ---------- tavern ----------
/** Steady hands: the waiter's tray holds this many. */
export const trayMaxOf = (b?: Bonuses): number => effective(TRAY_MAX, 'trayPlus', b);
/** Roomy tavern: the guest cap and the away-orders cap (guests still need a seat each). */
export const guestMaxOf = (b?: Bonuses): number => effective(GUEST_MAX, 'seatsPlus', b);
export const awayOrdersMaxOf = (b?: Bonuses): number => effective(AWAY_ORDERS_MAX, 'seatsPlus', b);
/** Keen eye: the perfect pour window widens by this on each side. */
export const pourRangeOf = (b?: Bonuses): readonly [number, number] => {
  const w = effective(0, 'pourWindowPlus', b);
  return [POUR_PERFECT_RANGE[0] - w, POUR_PERFECT_RANGE[1] + w];
};
/** Big batch: dishes the stove takes per batch. */
export const stoveBatchMaxOf = (b?: Bonuses): number => effective(STOVE_BATCH_MAX, 'batchPlus', b);
/** Wide kegs: mugs one tap holds. */
export const tapCapOf = (b?: Bonuses): number => effective(TAP_CAP, 'tapCapPlus', b);
/** Cellar racks: casks per keg rack. */
export const caskSlotsOf = (b?: Bonuses): number => effective(CASK_SLOTS, 'caskSlotsPlus', b);
/** Deep pockets: bag slots (a bonus changes how many rows the bag shows). */
export const bagSlotsOf = (b?: Bonuses): number => effective(BAG_SLOTS, 'bagSlotsPlus', b);
/** Quick feet: the avatar's walk speed in a room (px/s) from the base speed. */
export const roomSpeedOf = (base: number, b?: Bonuses): number => effective(base, 'roomWalkPct', b);

// ---------- dungeon ----------
/** Light feet: the run walk speed. */
export const runSpeedOf = (base: number, b?: Bonuses): number => effective(base, 'runSpeedPct', b);
/** Second wind: what a potion heals. */
export const potionHealOf = (base: number, b?: Bonuses): number => Math.round(effective(base, 'potionHealPct', b));
/** Parry: the enemy wind-up takes this long (ms): more time to step away. */
export const enemyWindupOf = (b?: Bonuses): number => effective(ENEMY_WINDUP_MS, 'enemyMissMs', b);

// ---------- mining ----------
/** Strong arm: the pickaxe cooldown (shorter for more dig speed). */
export const pickCooldownOf = (b?: Bonuses): number => Math.max(100, Math.round(PICKAXE_COOLDOWN_MS / (1 + (b?.digSpeedPct ?? 0) / 100)));
/** Gem eye: the chance a rock drops a gem. */
export const rockGemChanceOf = (b?: Bonuses): number => effective(GEM_CHANCE, 'gemChancePts', b ? { gemChancePts: (b.gemChancePts ?? 0) / 100 } : undefined);

/** Satchel (crypt) or Pack mule (mine): the run bag's slots. */
export const runBagSlotsOf = (place: 'crypt' | 'mine', b?: Bonuses): number => effective(RUN_BAG_SLOTS, place === 'mine' ? 'mineBagPlus' : 'runBagPlus', b);
/** Prospector: the ore a broken rock gives. The bonus is a share of the base (8% of 2 ore = 0.16 ore): the whole part is added, the rest is a chance of one more (rng only used with a bonus). */
export const oreQtyOf = (base: number, b: Bonuses | undefined, rng: () => number): number => {
  const pct = b?.oreBonusPct ?? 0;
  if (pct <= 0) return base;
  const x = (base * pct) / 100;
  return base + Math.floor(x) + (rng() < x - Math.floor(x) ? 1 : 0);
};

/** Lantern (dig mine, MG-3): how far the light shows the cave around the player, in px. */
export const digLightPxOf = (b?: Bonuses): number => effective(DIG_LIGHT_BLOCKS, 'lightPlus', b) * DUNGEON_BLOCK;
/** Ore sense (dig mine): how many blocks away a rare block glints. */
export const glintBlocksOf = (b?: Bonuses): number => effective(DIG_GLINT_BLOCKS, 'glintBlocks', b);
/** Careful step (dig mine): cave-in damage (never below 1). */
export const hazardDamageOf = (base: number, b?: Bonuses): number => Math.max(1, Math.round(effective(base, 'hazardDmgPct', b)));
/** Treasure sense (crypt): how many blocks away a closed chest shines through the dark (0 without the skill). */
export const chestGlintBlocksOf = (b?: Bonuses): number => effective(0, 'chestGlintBlocks', b);

/** Stats of the tree no rule reads yet (the panel marks their nodes "not active yet"): they wait for bait and the bag rework. */
export const UNHOOKED_STATS: readonly string[] = ['baitSavePct', 'deepCast', 'keepBaitOnLoss', 'bagSlotsPlus'];
