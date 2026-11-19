// MG-7 (docs/PLAN-MINIGAMES.md 4): the skill tree's stats, read by the rules. Every helper takes the Bonuses (skills.ts skillStats) and returns the value a
// rule uses; no bonus = the plain config number, exactly. No node adds gold directly (CLAUDE.md 13). Pure.

import {
  APPEAL_MAX_PER_TYPE,
  AXE_COOLDOWN_MS,
  BLOCK_HIT_COOLDOWN_MS,
  BLOCK_REACH,
  DIG_CAVEIN_TELL_MS,
  GUEST_PATIENCE_MS,
  LUNCH_BOX_MAX,
  OFFLINE_MAX_MS,
  PLAYER_ATTACK_COOLDOWN_MS,
  PLANTS_ROOM_CAP,
  POUR_FULL_MS,
  PREP_BONUS,
  SEED_BACK_CHANCE,
  SPLICE_BONUS_MS,
  TASTE_RESERVE_CHANCE,
  TREE_REGROW_MS,
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
import { effective, type Bonuses, type StatId } from './stats.ts';
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

// ---------- SK-3 (tavern + home) ----------
/** Patient guests: how long a TABLE guest waits for the order (ms; bar guests keep their own number, their speed tip counts from it). */
export const guestPatienceOf = (b?: Bonuses): number => Math.max(15_000, Math.round(effective(GUEST_PATIENCE_MS, 'guestPatiencePct', b)));
/** Warm welcome: the ms between groups of guests, shorter for more guests (guestRatePct = +% more often). Never faster than half. */
export const guestIntervalScaled = (ms: number, b?: Bonuses): number => {
  const r = b?.guestRatePct ?? 0;
  return r === 0 ? ms : Math.max(ms / 2, ms / (1 + r / 100));
};
/** Smooth pour: ms of holding to a full mug (shorter with the skill; the perfect window stays the same share of it). */
export const pourFullMsOf = (b?: Bonuses): number => Math.max(500, effective(POUR_FULL_MS, 'pourFullPct', b));
/** Regulars' gem: the chance of the tavern gem tip is scaled (gems, never gold). */
export const gemTipChanceOf = (chance: number, b?: Bonuses): number => Math.min(1, effective(chance, 'gemTipPct', b));
/** House pride + Decorator: the appeal on top (flat) and how many pieces of one type count. */
export const appealPlusOf = (b?: Bonuses): number => effective(0, 'appealPlus', b);
export const appealTypeCapOf = (b?: Bonuses): number => effective(APPEAL_MAX_PER_TYPE, 'decorTypeCapPlus', b);
/** Long nap: how far back the offline catch-up looks (ms). */
export const offlineMaxMsOf = (b?: Bonuses): number => OFFLINE_MAX_MS + effective(0, 'offlineHoursPlus', b) * 3_600_000;
/** Pack lunch: lunch box slots. */
export const lunchBoxMaxOf = (b?: Bonuses): number => effective(LUNCH_BOX_MAX, 'lunchBoxPlus', b);
/** Quest hand: a quest or achievement gem reward gets +1 gem with this percent chance (rng only used with the skill and a reward). */
export const questGemsOf = (base: number, b: Bonuses | undefined, rng: () => number): number => (base > 0 && (b?.questGemsPct ?? 0) > 0 && rng() < (b?.questGemsPct ?? 0) / 100 ? base + 1 : base);
/** The walk speed in a room of this kind: Quick feet everywhere, Wanderer feet (outdoorWalkPct) also on the farm and at the lakeside. */
export const walkSpeedIn = (base: number, roomKind: string, b?: Bonuses): number =>
  roomKind === 'farm' || roomKind === 'lakeside' ? effective(roomSpeedOf(base, b), 'outdoorWalkPct', b) : roomSpeedOf(base, b);
/** Wanderer feet: the axe cooldown (ms). */
export const chopCooldownOf = (b?: Bonuses): number => Math.max(150, Math.round(effective(AXE_COOLDOWN_MS, 'chopCdPct', b)));
/** Wanderer keystone: tree regrow time (negative = faster). */
export const treeRegrowMsOf = (b?: Bonuses): number => Math.max(30_000, Math.round(effective(TREE_REGROW_MS, 'treeRegrowPct', b)));

// ---------- SK-4 (kitchen + farm) ----------
/** Quick simmer / Hot stove: batch time. */
export const cookMsScaled = (ms: number, b?: Bonuses): number => (b?.cookMsPct ? Math.max(5_000, Math.round(effective(ms, 'cookMsPct', b))) : ms);
/** Brew sense: brew time. */
export const brewMsScaled = (ms: number, b?: Bonuses): number => (b?.brewMsPct ? Math.max(10_000, Math.round(effective(ms, 'brewMsPct', b))) : ms);
/** Extra mug: mugs per brew. */
export const brewMugsOf = (base: number, b?: Bonuses): number => effective(base, 'brewYieldPlus', b);
/** Patient cellar: minutes in the cask count shorter (ripenMsPct -10 = ripens 10% sooner). */
export const ripenScaled = (minutes: number, b?: Bonuses): number => effective(minutes, 'ripenMsPct', b);
/** Taste sense: the share of guests who look only at reserve drinks. */
export const tasteReserveOf = (b?: Bonuses): number => Math.min(0.5, TASTE_RESERVE_CHANCE + (b?.tasteReservePts ?? 0));
/** Hearty food: what a lunch-box food heals. */
export const foodHealOf = (base: number, b?: Bonuses): number => Math.round(effective(base, 'foodHealPct', b));
/** Master kitchen: the prep bonus cap and whether a prep table counts outside the kitchen zone. */
export const prepBonusMaxOf = (b?: Bonuses): number => PREP_BONUS.max + (b?.prepBonusPlus ?? 0);
export const prepAnywhereOf = (b?: Bonuses): boolean => (b?.prepAnywhere ?? 0) > 0;
/**
 * Thrifty cook: each unit of a batch's inputs is kept with the skill's chance (rng only used with the skill). Returns what to give back
 * (the same shape as the inputs).
 */
export const inputsKept = (inputs: Partial<Record<string, number>>, b: Bonuses | undefined, rng: () => number): Record<string, number> => {
  const pct = b?.inputKeepPct ?? 0;
  const out: Record<string, number> = {};
  if (pct <= 0) return out;
  for (const [id, n] of Object.entries(inputs)) {
    let kept = 0;
    for (let i = 0; i < (n ?? 0); i++) if (rng() < pct / 100) kept++;
    if (kept > 0) out[id] = kept;
  }
  return out;
};
/** Green thumb: grow time. */
export const growMsScaled = (ms: number, b?: Bonuses): number => (b?.growMsPct ? Math.max(10_000, Math.round(effective(ms, 'growMsPct', b))) : ms);
/** Seed keeper: the chance the seed comes back. */
export const seedBackChanceOf = (b?: Bonuses): number => Math.min(0.95, SEED_BACK_CHANCE + (b?.seedBackPts ?? 0) / 100);
/** Strong fist: the block / plant hit cooldown (ms), never under 100. */
export const blockHitCooldownOf = (b?: Bonuses): number => Math.max(100, Math.round(effective(BLOCK_HIT_COOLDOWN_MS, 'blockHitCdPct', b)));
/** Long arms: block reach in cells. */
export const blockReachOf = (b?: Bonuses): number => effective(BLOCK_REACH, 'blockReachPlus', b);
/** Quick splice: the extra time a splice adds (SPLICE_BONUS_MS), shorter. */
export const spliceBonusMsOf = (b?: Bonuses): number => Math.max(0, Math.round(effective(SPLICE_BONUS_MS, 'spliceMsPct', b)));
/** Big garden: plants per room (the bonus is the farm's only). */
export const plantCapOf = (kind: keyof typeof PLANTS_ROOM_CAP, b?: Bonuses): number => PLANTS_ROOM_CAP[kind] + (kind === 'farm' ? (b?.plantCapPlus ?? 0) : 0);
/** Bountiful: a harvest of `qty` crops or blocks gets +1 with this percent chance (rng only used with the skill). */
export const harvestQtyOf = (qty: number, b: Bonuses | undefined, rng: () => number): number => {
  const pct = b?.harvestBonusPct ?? 0;
  return pct > 0 && rng() < pct / 100 ? qty + 1 : qty;
};
/** Lucky sprout: the harvest gem chance is scaled. */
export const harvestGemChanceOf = (chance: number, b?: Bonuses): number => Math.min(1, effective(chance, 'harvestGemPct', b));

// ---------- SK-5 (mining + dungeon) ----------
/** Sure footing: how long a cave-in tile cracks before it hurts (ms, longer = more time to step off). */
export const caveTellMsOf = (b?: Bonuses): number => DIG_CAVEIN_TELL_MS + (b?.caveTellMs ?? 0);
/** Quick strike: the attack cooldown (ms), never under 150. */
export const attackCooldownOf = (b?: Bonuses): number => Math.max(150, Math.round(effective(PLAYER_ATTACK_COOLDOWN_MS, 'attackCdPct', b)));
/** Guardian / Brawler: max hp after the flat bonus, then the percent share. */
export const maxHpScaled = (base: number, b?: Bonuses): number => Math.max(1, Math.round(effective(effective(base, 'maxHpPlus', b), 'maxHpPct', b)));
/** Guardian: damage taken per enemy hit, never under the armor's minimum. */
export const damageTakenOf = (damage: number, minDamage: number, b?: Bonuses): number => Math.max(minDamage, damage + (b?.damageTakenPlus ?? 0));
/** Bone breaker: every Nth hit of a run counts double (0 = never). `count` = hits made so far including this one. */
export const heavyHitOf = (count: number, b?: Bonuses): boolean => {
  const n = b?.heavyEvery ?? 0;
  return n > 0 && count % n === 0;
};
/** Blaster: every Nth swing of the pickaxe breaks the whole block at once (0 = never). */
export const blastNow = (count: number, b?: Bonuses): boolean => {
  const n = b?.blastEvery ?? 0;
  return n > 0 && count % n === 0;
};

/**
 * SK-1: the stats a rule reads today (through a helper above, or fishing.ts / mineStep.ts / step.ts / run.ts directly). A node is `live` in skills.json only
 * when every effect is one of these (skills.test checks it); the other StatIds wait for their hook batch (docs/PLAN-SKILLTREE.md 4.3, SK-3..5).
 */
export const HOOKED_STATS: readonly StatId[] = [
  'roomWalkPct', 'trayPlus', 'seatsPlus', 'pourWindowPlus', 'batchPlus', 'tapCapPlus', 'caskSlotsPlus',
  'maxHpPlus', 'runBagPlus', 'attackPlus', 'runSpeedPct', 'potionHealPct', 'enemyMissMs', 'chestGlintBlocks', 'lastStand',
  'biteWaitPct', 'boxSizePct', 'tensionRisePct', 'strikeWindowMs', 'rankOddsPct',
  'digSpeedPct', 'lightPlus', 'glintBlocks', 'hazardDmgPct', 'doubleStrikePct', 'mineBagPlus', 'oreBonusPct', 'gemChancePts',
  // SK-3..5 (tavern, kitchen, farm, home, fishing, mining, dungeon)
  'guestPatiencePct', 'guestRatePct', 'pourFullPct', 'gemTipPct', 'cookMsPct', 'brewMsPct', 'brewYieldPlus', 'inputKeepPct', 'ripenMsPct', 'foodHealPct', 'tasteReservePts', 'prepAnywhere', 'prepBonusPlus', 'growMsPct', 'seedBackPts', 'blockHitCdPct', 'harvestBonusPct', 'blockReachPlus', 'spliceMsPct', 'harvestGemPct', 'plantCapPlus', 'doubleCatchPct', 'caveTellMs', 'blastEvery', 'attackCdPct', 'maxHpPct', 'damageTakenPlus', 'heavyEvery', 'appealPlus', 'decorTypeCapPlus', 'questGemsPct', 'offlineHoursPlus', 'lunchBoxPlus', 'outdoorWalkPct', 'chopCdPct', 'treeRegrowPct',
];
