// SK-3..5 (docs/PLAN-SKILLTREE.md 4.3): the hooks of the tavern, kitchen, farm, home, fishing, mining and dungeon stats. One test per helper (no bonus = the old number
// exactly) and one per rule that reads it. Pure.
import { describe, expect, it } from 'vitest';
import { APPEAL_MAX_PER_TYPE, BLOCK_HIT_COOLDOWN_MS, BLOCK_REACH, DIG_CAVEIN_TELL_MS, GUEST_PATIENCE_MS, LUNCH_BOX_MAX, OFFLINE_MAX_MS, PLAYER_ATTACK_COOLDOWN_MS, POUR_FULL_MS, PREP_BONUS, SEED_BACK_CHANCE, SPLICE_BONUS_MS, TASTE_RESERVE_CHANCE, TREE_REGROW_MS } from './config.ts';
import { tavernAppeal } from './appeal.ts';
import { startBrew, collectBrew, brewMs, barrels } from './brewing.ts';
import { cookMs, startCook, stoves } from './cooking.ts';
import { caskTier, ripenMinutes } from './casks.ts';
import { maxHpAt } from './levels.ts';
import { gemDrop, tavernGemChance } from './gems.ts';
import type { GameState } from './gameState.ts';
import { harvestPlant } from './farm.ts';
import { applyChange } from './ledger.ts';
import { getFoodType } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { pourFill } from './pour.ts';
import { prepBonus } from './kitchen.ts';
import { seededRng } from './rng.ts';
import {
  HOOKED_STATS, appealPlusOf, appealTypeCapOf, attackCooldownOf, blastNow, blockHitCooldownOf, blockReachOf, bonusesOf, brewMsScaled, brewMugsOf, caveTellMsOf,
  chopCooldownOf, cookMsScaled, damageTakenOf, foodHealOf, gemTipChanceOf, growMsScaled, guestIntervalScaled, guestPatienceOf, harvestGemChanceOf, harvestQtyOf, heavyHitOf,
  inputsKept, lunchBoxMaxOf, maxHpScaled, offlineMaxMsOf, plantCapOf, pourFullMsOf, prepAnywhereOf, prepBonusMaxOf, questGemsOf, ripenScaled, seedBackChanceOf,
  spliceBonusMsOf, tasteReserveOf, treeRegrowMsOf, walkSpeedIn,
} from './skillRules.ts';
import { spliceGrowMs } from './splice.ts';
import { guestIntervalMs, tasteOffers } from './tavern.ts';
import { chop, emptyLakeside, isStump } from './woodcut.ts';
import { packLunch } from './dungeon/bank.ts';
import { combatStats } from './dungeon/run.ts';
import { kitchenRoomIds } from './workRooms.ts';
import type { MaterialId } from './types.ts';

const rng0 = (): number => 0;
const withRanks = (s: GameState, ranks: Record<string, number>): GameState => ({ ...s, player: { ...s.player, skills: { ranks, respecs: 0, tree: 2 } as never } });
const fresh = (): GameState => createNewPlayer(undefined, 1000);
const give = (s: GameState, m: Partial<Record<MaterialId, number>>): GameState => applyChange(s, { reason: 'debug', materials: m }, 1000)!;

describe('SK-3..5: nothing owned = the plain number, exactly', () => {
  it('every helper answers the config value without a bonus', () => {
    expect(guestPatienceOf()).toBe(GUEST_PATIENCE_MS);
    expect(guestIntervalScaled(45_000)).toBe(45_000);
    expect(pourFullMsOf()).toBe(POUR_FULL_MS);
    expect(gemTipChanceOf(0.05)).toBe(0.05);
    expect(appealPlusOf()).toBe(0);
    expect(appealTypeCapOf()).toBe(APPEAL_MAX_PER_TYPE);
    expect(offlineMaxMsOf()).toBe(OFFLINE_MAX_MS);
    expect(lunchBoxMaxOf()).toBe(LUNCH_BOX_MAX);
    expect(cookMsScaled(20_000)).toBe(20_000);
    expect(brewMsScaled(480_000)).toBe(480_000);
    expect(brewMugsOf(7)).toBe(7);
    expect(ripenScaled(100)).toBe(100);
    expect(tasteReserveOf()).toBe(TASTE_RESERVE_CHANCE);
    expect(foodHealOf(10)).toBe(10);
    expect(prepBonusMaxOf()).toBe(PREP_BONUS.max);
    expect(prepAnywhereOf()).toBe(false);
    expect(growMsScaled(120_000)).toBe(120_000);
    expect(seedBackChanceOf()).toBe(SEED_BACK_CHANCE);
    expect(blockHitCooldownOf()).toBe(BLOCK_HIT_COOLDOWN_MS);
    expect(blockReachOf()).toBe(BLOCK_REACH);
    expect(spliceBonusMsOf()).toBe(SPLICE_BONUS_MS);
    expect(plantCapOf('farm')).toBe(80);
    expect(harvestGemChanceOf(0.25)).toBe(0.25);
    expect(caveTellMsOf()).toBe(DIG_CAVEIN_TELL_MS);
    expect(attackCooldownOf()).toBe(PLAYER_ATTACK_COOLDOWN_MS);
    expect(maxHpScaled(30)).toBe(30);
    expect(damageTakenOf(5, 1)).toBe(5);
    expect(heavyHitOf(5)).toBe(false);
    expect(blastNow(10)).toBe(false);
    expect(treeRegrowMsOf()).toBe(TREE_REGROW_MS);
    expect(walkSpeedIn(128, 'farm')).toBe(128);
    expect(chopCooldownOf()).toBe(chopCooldownOf({}));
    expect(questGemsOf(2, undefined, rng0)).toBe(2);
    expect(harvestQtyOf(3, undefined, rng0)).toBe(3);
    expect(inputsKept({ turnip: 2 }, undefined, rng0)).toEqual({});
  });
});

describe('SK-3 tavern and home', () => {
  it('Patient guests, Warm welcome, Smooth pour, Regulars gem, House pride, Decorator, Long nap, Pack lunch scale their number', () => {
    expect(guestPatienceOf({ guestPatiencePct: 30 })).toBe(Math.round(GUEST_PATIENCE_MS * 1.3));
    expect(guestPatienceOf({ guestPatiencePct: -20 })).toBe(Math.round(GUEST_PATIENCE_MS * 0.8));
    expect(guestIntervalScaled(40_000, { guestRatePct: 10 })).toBeCloseTo(40_000 / 1.1);
    expect(guestIntervalScaled(40_000, { guestRatePct: 500 })).toBe(20_000); // never faster than half
    expect(guestIntervalScaled(40_000, { guestRatePct: -10 })).toBeGreaterThan(40_000 / 2);
    expect(pourFullMsOf({ pourFullPct: -15 })).toBeCloseTo(POUR_FULL_MS * 0.85);
    expect(pourFill(POUR_FULL_MS * 0.85, { pourFullPct: -15 })).toBeCloseTo(1);
    expect(pourFill(POUR_FULL_MS * 0.85)).toBeCloseTo(0.85);
    expect(gemTipChanceOf(0.05, { gemTipPct: 20 })).toBeCloseTo(0.06);
    expect(tavernGemChance('common', { gemTipPct: 20 })).toBeGreaterThan(tavernGemChance('common'));
    expect(appealPlusOf({ appealPlus: 5 })).toBe(5);
    expect(appealTypeCapOf({ decorTypeCapPlus: 2 })).toBe(APPEAL_MAX_PER_TYPE + 2);
    expect(offlineMaxMsOf({ offlineHoursPlus: 4 })).toBe(OFFLINE_MAX_MS + 4 * 3_600_000);
    expect(lunchBoxMaxOf({ lunchBoxPlus: 1 })).toBe(LUNCH_BOX_MAX + 1);
  });

  it('a tavern with House pride has more appeal (still capped at 100) and a longer guest interval is shorter with Warm welcome', () => {
    const s = fresh();
    const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
    const base = tavernAppeal(room, s.items);
    expect(tavernAppeal(room, s.items, [], { appealPlus: 4 })).toBe(Math.min(100, base + 4));
    expect(tavernAppeal(room, s.items, [], { appealPlus: 500 })).toBe(100);
    expect(guestIntervalScaled(guestIntervalMs(base), { guestRatePct: 15 })).toBeLessThan(guestIntervalMs(base));
  });

  it('Quest hand adds one gem with its chance (never when there is none)', () => {
    expect(questGemsOf(2, { questGemsPct: 100 }, rng0)).toBe(3);
    expect(questGemsOf(0, { questGemsPct: 100 }, rng0)).toBe(0);
    expect(questGemsOf(2, { questGemsPct: 15 }, () => 0.9)).toBe(2);
  });

  it('Taste sense raises the reserve-only guests, the rng only moves with a reserve drink on a tap', () => {
    expect(tasteReserveOf({ tasteReservePts: 0.05 })).toBeCloseTo(TASTE_RESERVE_CHANCE + 0.05);
    const offers = [{ id: 'root_ale', price: 5, baseValue: 5, stock: 3 }] as never;
    expect(tasteOffers(offers, rng0, { tasteReservePts: 0.5 })).toEqual(offers);
  });

  it('Pack lunch lets one more food into the box', () => {
    const s = give(fresh(), { roasted_turnip: 5 });
    const ask = ['roasted_turnip', 'roasted_turnip', 'roasted_turnip', 'roasted_turnip'];
    expect(packLunch(s, ask)).toHaveLength(LUNCH_BOX_MAX);
    expect(packLunch(withRanks(s, { pack_lunch: 1 }), ask)).toHaveLength(LUNCH_BOX_MAX + 1);
  });

  it('Wanderer feet: faster outdoors only, the axe is quicker and a felled tree grows back sooner', () => {
    expect(walkSpeedIn(100, 'farm', { outdoorWalkPct: 10 })).toBeCloseTo(110);
    expect(walkSpeedIn(100, 'lakeside', { outdoorWalkPct: 10, roomWalkPct: 10 })).toBeCloseTo(121);
    expect(walkSpeedIn(100, 'hotel', { outdoorWalkPct: 10 })).toBe(100);
    expect(chopCooldownOf({ chopCdPct: -10 })).toBeLessThan(chopCooldownOf());
    expect(treeRegrowMsOf({ treeRegrowPct: -20 })).toBe(Math.round(TREE_REGROW_MS * 0.8));
    // The rule: a tree felled with Wanderer is a stump for the shorter time only.
    const s0 = fresh();
    const lake = emptyLakeside(s0.lakeside.roomId);
    const prepared = withRanks({ ...s0, lakeside: { ...lake, trees: lake.trees.map((t, i) => (i === 0 ? { hits: 4, felledAt: null } : t)) } }, { wanderer: 1 });
    const done = chop(prepared, 0, 10_000, seededRng(3))!;
    const felled = done.state.lakeside.trees[0]!;
    expect(done.result.kind).toBe('felled');
    expect(isStump(felled, 10_000 + 1000, treeRegrowMsOf(bonusesOf(done.state.player)))).toBe(true);
    expect(isStump(felled, 10_000 + Math.round(TREE_REGROW_MS * 0.8) + 1, treeRegrowMsOf(bonusesOf(done.state.player)))).toBe(false);
    expect(isStump(felled, 10_000 + Math.round(TREE_REGROW_MS * 0.8) + 1)).toBe(true);
  });
});

describe('SK-4 kitchen and farm', () => {
  it('Quick simmer and Hot stove cook faster; the batch is ready sooner', () => {
    const food = getFoodType('roasted_turnip');
    expect(cookMs(food, { cookMsPct: -40 })).toBe(Math.round(cookMs(food) * 0.6));
    const s = give(fresh(), { turnip: 8 });
    const uid = stoves(s.items, kitchenRoomIds(s))[0]!.uid;
    const slow = startCook(s, uid, 'roasted_turnip', 1, 1000)!;
    const fast = startCook(withRanks(s, { hot_stove: 1 }), uid, 'roasted_turnip', 1, 1000)!;
    expect(fast.tavern.cooks[0]!.readyAt).toBeLessThan(slow.tavern.cooks[0]!.readyAt);
  });

  it('Hot stove takes one dish off the batch size (batchPlus -1)', () => {
    const s = withRanks(give(fresh(), { turnip: 8 }), { hot_stove: 1 });
    const uid = stoves(s.items, kitchenRoomIds(s))[0]!.uid;
    expect(startCook(s, uid, 'roasted_turnip', 4, 1000)).toBeNull();
    expect(startCook(s, uid, 'roasted_turnip', 3, 1000)).not.toBeNull();
  });

  it('Brew sense brews faster and Extra mug gives one more mug', () => {
    expect(brewMs('root_ale', { brewMsPct: -24 })).toBe(Math.round(brewMs('root_ale') * 0.76));
    const s0 = give(fresh(), { turnip: 4, potato: 4 });
    const uid = barrels(s0.items, kitchenRoomIds(s0))[0]!.uid;
    for (const [ranks, extra] of [[{}, 0], [{ extra_mug: 2 }, 2]] as const) {
      const s = withRanks(s0, ranks);
      const brewing = startBrew(s, uid, 'root_ale', 1000)!;
      const out = collectBrew(brewing, uid, 1000 + brewMs('root_ale') + 1)!;
      expect(out.mugs).toBe(7 + extra);
    }
  });

  it('Thrifty cook keeps inputs with its chance, only when an rng is given', () => {
    expect(inputsKept({ turnip: 2, potato: 1 }, { inputKeepPct: 100 }, rng0)).toEqual({ turnip: 2, potato: 1 });
    expect(inputsKept({ turnip: 2 }, { inputKeepPct: 10 }, () => 0.5)).toEqual({});
    const s0 = give(fresh(), { turnip: 4, potato: 4 });
    const uid = barrels(s0.items, kitchenRoomIds(s0))[0]!.uid;
    const s = withRanks(s0, { thrifty_cook: 2 });
    const kept = startBrew(s, uid, 'root_ale', 1000, rng0)!;
    const plain = startBrew(s, uid, 'root_ale', 1000)!;
    expect((kept.player.materials.turnip ?? 0)).toBeGreaterThan(plain.player.materials.turnip ?? 0);
  });

  it('Patient cellar makes the ripening marks come sooner', () => {
    const base = ripenMinutes('root_ale');
    const fast = ripenMinutes('root_ale', { ripenMsPct: -20 });
    expect(fast.aged).toBeCloseTo(base.aged * 0.8);
    expect(fast.reserve).toBeCloseTo(base.reserve * 0.8);
    const cask = { rackUid: 1, slot: 0, drink: 'root_ale', mugs: 1, startedAt: 0 } as const;
    const at = base.aged * 60_000 * 0.85;
    expect(caskTier(cask as never, at)).toBe('fresh');
    expect(caskTier(cask as never, at, 'reserve', { ripenMsPct: -20 })).toBe('aged');
  });

  it('Hearty food heals more', () => {
    expect(foodHealOf(10, { foodHealPct: 30 })).toBe(13);
  });

  it('Master kitchen: the prep cap grows by one and a prep table counts anywhere in the tavern', () => {
    expect(prepBonusMaxOf({ prepBonusPlus: 1 })).toBe(PREP_BONUS.max + 1);
    expect(prepAnywhereOf({ prepAnywhere: 1 })).toBe(true);
    const s = fresh();
    const room = s.rooms.find((r) => r.id === s.tavern.roomId);
    const uid = stoves(s.items, kitchenRoomIds(s))[0]!.uid;
    expect(prepBonus(s.items, room, uid, { prepAnywhere: 1 })).toBeGreaterThanOrEqual(prepBonus(s.items, room, uid));
  });

  it('Green thumb, Seed keeper, Strong fist, Long arms, Big garden, Quick splice scale their numbers', () => {
    expect(growMsScaled(120_000, { growMsPct: -20 })).toBe(96_000);
    expect(growMsScaled(1000, { growMsPct: -99 })).toBe(10_000); // never under ten seconds
    expect(seedBackChanceOf({ seedBackPts: 10 })).toBeCloseTo(SEED_BACK_CHANCE + 0.1);
    expect(seedBackChanceOf({ seedBackPts: 900 })).toBe(0.95);
    expect(blockHitCooldownOf({ blockHitCdPct: -20 })).toBe(Math.round(BLOCK_HIT_COOLDOWN_MS * 0.8));
    expect(blockHitCooldownOf({ blockHitCdPct: -99 })).toBe(100);
    expect(blockReachOf({ blockReachPlus: 1 })).toBe(BLOCK_REACH + 1);
    expect(plantCapOf('farm', { plantCapPlus: 20 })).toBe(100);
    expect(plantCapOf('hotel', { plantCapPlus: 20 })).toBe(16); // the farm only
    expect(spliceBonusMsOf({ spliceMsPct: -50 })).toBe(SPLICE_BONUS_MS / 2);
    expect(spliceGrowMs('turnip_seed', 'potato_seed', { spliceMsPct: -50 })).toBe(spliceGrowMs('turnip_seed', 'potato_seed') - SPLICE_BONUS_MS / 2);
  });

  it('a harvest: Seed keeper raises the seed-back chance, Bountiful adds +1 with its chance, Lucky sprout widens the gem chance', () => {
    const plant = { seed: 'turnip_seed', plantedAt: 0, readyAt: 0 } as never;
    const seq = (...v: number[]) => { let i = 0; return () => v[i++ % v.length]!; };
    // rolls: qty (rngInt), the bonus roll (only with Bountiful), seed back, gems
    expect(harvestPlant(plant, seq(0.99, SEED_BACK_CHANCE + 0.04, 0.99), [], { seedBackPts: 5 }).seedBack).toBe(true);
    expect(harvestPlant(plant, seq(0.99, SEED_BACK_CHANCE + 0.04, 0.99)).seedBack).toBe(false);
    const plain = harvestPlant(plant, seq(0, 0, 0, 0));
    const more = harvestPlant(plant, seq(0, 0, 0, 0), [], { harvestBonusPct: 10 });
    expect(more.qty).toBe(plain.qty + 1);
    expect(harvestGemChanceOf(0.25, { harvestGemPct: 20 })).toBeCloseTo(0.3);
  });
});

describe('SK-5 mining and dungeon', () => {
  it('Sure footing, Quick strike, Guardian, Bone breaker, Blaster and the hp share', () => {
    expect(caveTellMsOf({ caveTellMs: 300 })).toBe(DIG_CAVEIN_TELL_MS + 300);
    expect(attackCooldownOf({ attackCdPct: -16 })).toBe(Math.round(PLAYER_ATTACK_COOLDOWN_MS * 0.84));
    expect(attackCooldownOf({ attackCdPct: -90 })).toBe(150);
    expect(maxHpScaled(30, { maxHpPct: 15 })).toBe(35);
    expect(maxHpScaled(30, { maxHpPlus: 3, maxHpPct: -10 })).toBe(Math.round(33 * 0.9));
    expect(damageTakenOf(5, 1, { damageTakenPlus: -1 })).toBe(4);
    expect(damageTakenOf(1, 1, { damageTakenPlus: -1 })).toBe(1); // never under the armor's minimum
    expect(heavyHitOf(5, { heavyEvery: 5 })).toBe(true);
    expect(heavyHitOf(4, { heavyEvery: 5 })).toBe(false);
    expect(heavyHitOf(10, { heavyEvery: 5 })).toBe(true);
    expect(blastNow(10, { blastEvery: 10 })).toBe(true);
    expect(blastNow(9, { blastEvery: 10 })).toBe(false);
  });

  it('combatStats gives Guardian hp and the run starts with the Quick strike cooldown', () => {
    const base = combatStats(1, []);
    expect(base.maxHp).toBe(maxHpAt(1));
    expect(combatStats(1, [], { maxHpPct: 15 }).maxHp).toBe(Math.round(maxHpAt(1) * 1.15));
  });
});

describe('the Skills panel stops saying Soon for the hooked stats', () => {
  it('every stat of this batch is hooked', () => {
    for (const k of ['guestPatiencePct', 'guestRatePct', 'pourFullPct', 'gemTipPct', 'cookMsPct', 'brewMsPct', 'brewYieldPlus', 'inputKeepPct', 'ripenMsPct', 'foodHealPct', 'tasteReservePts', 'prepAnywhere', 'prepBonusPlus', 'growMsPct', 'seedBackPts', 'blockHitCdPct', 'harvestBonusPct', 'blockReachPlus', 'spliceMsPct', 'harvestGemPct', 'plantCapPlus', 'doubleCatchPct', 'caveTellMs', 'blastEvery', 'attackCdPct', 'maxHpPct', 'damageTakenPlus', 'heavyEvery', 'appealPlus', 'decorTypeCapPlus', 'questGemsPct', 'offlineHoursPlus', 'lunchBoxPlus', 'outdoorWalkPct', 'chopCdPct', 'treeRegrowPct'] as const) {
      expect(HOOKED_STATS, k).toContain(k);
    }
  });
});
