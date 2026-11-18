// MG-7: the skill stats are read by the rules. Rank 0 = the plain config number exactly; a bought rank changes only its own number; no node adds gold.
import { describe, expect, it } from 'vitest';
import {
  CASK_SLOTS,
  ENEMY_WINDUP_MS,
  FISH_BOX_BASE,
  GUEST_MAX,
  HOTEL_WALK_SPEED,
  PICKAXE_COOLDOWN_MS,
  PLAYER_DUNGEON_SPEED,
  POUR_PERFECT_RANGE,
  RUN_BAG_SLOTS,
  STOVE_BATCH_MAX,
  TAP_CAP,
  TRAY_MAX,
} from './config.ts';
import { startCook } from './cooking.ts';
import { blockCenter } from './dungeon/grid.ts';
import { newRun } from './dungeon/run.ts';
import { step } from './dungeon/step.ts';
import { enemyAt, testRun } from './dungeon/testRun.ts';
import { fishStep, newFishSession } from './fishing.ts';
import type { GameState } from './gameState.ts';
import { POTION } from './gear.ts';
import { applyChange } from './ledger.ts';
import { levelForXp, maxHpAt } from './levels.ts';
import { pourGrade } from './pour.ts';
import { seededRng } from './rng.ts';
import {
  bonusesOf,
  caskSlotsOf,
  enemyWindupOf,
  guestMaxOf,
  oreQtyOf,
  pickCooldownOf,
  potionHealOf,
  pourRangeOf,
  rockGemChanceOf,
  roomSpeedOf,
  runBagSlotsOf,
  runSpeedOf,
  stoveBatchMaxOf,
  tapCapOf,
  trayMaxOf,
} from './skillRules.ts';
import { SKILL_NODES, skillStats } from './skills.ts';
import type { Bonuses } from './stats.ts';
import { loadRoom } from './taps.ts';
import { nextOrder } from './tavern.ts';
import { withAle } from './tavernTest.ts';
import { trayFull } from './tray.ts';

const ranks = (r: Record<string, number>): Bonuses => skillStats({ skills: { ranks: r, respecs: 0 } });
const withRanks = (s: GameState, r: Record<string, number>): GameState => ({ ...s, player: { ...s.player, skills: { ranks: r, respecs: 0 } } });
const start = blockCenter(5, 5);

describe('rank 0 is the plain number', () => {
  it('every helper returns the config value without a bonus', () => {
    expect(trayMaxOf()).toBe(TRAY_MAX);
    expect(guestMaxOf({})).toBe(GUEST_MAX);
    expect(stoveBatchMaxOf()).toBe(STOVE_BATCH_MAX);
    expect(tapCapOf()).toBe(TAP_CAP);
    expect(caskSlotsOf()).toBe(CASK_SLOTS);
    expect(pourRangeOf()).toEqual([POUR_PERFECT_RANGE[0], POUR_PERFECT_RANGE[1]]);
    expect(roomSpeedOf(HOTEL_WALK_SPEED)).toBe(HOTEL_WALK_SPEED);
    expect(runSpeedOf(PLAYER_DUNGEON_SPEED, {})).toBe(PLAYER_DUNGEON_SPEED);
    expect(potionHealOf(POTION.heal)).toBe(POTION.heal);
    expect(runBagSlotsOf('crypt')).toBe(RUN_BAG_SLOTS);
    expect(pickCooldownOf()).toBe(PICKAXE_COOLDOWN_MS);
    expect(oreQtyOf(2, undefined, () => 0)).toBe(2);
    expect(enemyWindupOf()).toBe(ENEMY_WINDUP_MS);
    expect(bonusesOf({ skills: undefined })).toEqual({});
  });
  it('a new run and fish session are exactly the old ones without skills', () => {
    const a = newRun({ seed: 3, xp: 0, gear: [], potions: 0 });
    const b = newRun({ seed: 3, xp: 0, gear: [], potions: 0, skills: {} });
    expect(a.player.maxHp).toBe(b.player.maxHp);
    expect(newFishSession(seededRng(1), []).boxSize).toBe(FISH_BOX_BASE);
  });
});

describe('tavern stats', () => {
  it('each tavern node moves its own number', () => {
    expect(trayMaxOf(ranks({ steady_hands: 1 }))).toBe(TRAY_MAX + 1);
    expect(guestMaxOf(ranks({ quick_feet: 1, roomy_tavern: 2 }))).toBe(GUEST_MAX + 2);
    expect(stoveBatchMaxOf(ranks({ big_batch: 2 }))).toBe(STOVE_BATCH_MAX + 2);
    expect(tapCapOf(ranks({ wide_kegs: 1 }))).toBe(TAP_CAP + 4);
    expect(caskSlotsOf(ranks({ cellar_racks: 1 }))).toBe(CASK_SLOTS + 1);
    expect(roomSpeedOf(128, ranks({ quick_feet: 3 }))).toBeCloseTo(128 * 1.18);
    expect(pourRangeOf(ranks({ keen_eye: 2 }))[1]).toBeCloseTo(POUR_PERFECT_RANGE[1] + 0.06);
  });
  it('the tray holds one more with Steady hands', () => {
    const s = withRanks(withAle(), { steady_hands: 1 });
    const full = { tray: Array.from({ length: TRAY_MAX }, () => ({ item: 'root_ale' as const })) };
    expect(trayFull(full)).toBe(true);
    expect(trayFull(full, trayMaxOf(bonusesOf(s.player)))).toBe(false);
    expect(nextOrder(s)).toBeNull(); // no guest: nothing to carry, the rule still runs
  });
  it('a tap takes more mugs with Wide kegs', () => {
    const s = applyChange(withAle(), { reason: 'debug', materials: { root_ale: 40 } }, 0)!;
    const stand = s.items.find((i) => i.typeId === 'tap_stand')!;
    const empty = { ...s, tavern: { ...s.tavern, taps: [] } };
    expect(loadRoom(empty, stand.uid, 0, 'root_ale')).toBe(TAP_CAP);
    expect(loadRoom(withRanks(empty, { wide_kegs: 1 }), stand.uid, 0, 'root_ale')).toBe(TAP_CAP + 4);
  });
  it('a stove takes a bigger batch with Big batch', () => {
    const s = applyChange(withAle(), { reason: 'debug', materials: { turnip: 40 } }, 0)!;
    const stove = s.items.find((i) => i.typeId === 'stove')!;
    expect(startCook(s, stove.uid, 'roasted_turnip', STOVE_BATCH_MAX + 1, 1)).toBeNull();
    expect(startCook(withRanks(s, { big_batch: 1 }), stove.uid, 'roasted_turnip', STOVE_BATCH_MAX + 1, 1)).not.toBeNull();
  });
  it('a pour a little over the plain window is perfect with Keen eye', () => {
    const ms = 1.17 * 1400; // fill 1.17, over 1.15
    expect(pourGrade(ms)).toBe('over');
    expect(pourGrade(ms, ranks({ keen_eye: 2 }))).toBe('perfect');
  });
});

describe('dungeon stats', () => {
  it('Thick skin and Sharp edge raise max hp and attack', () => {
    const base = newRun({ seed: 3, xp: 0, gear: [], potions: 0 });
    const run = newRun({ seed: 3, xp: 0, gear: [], potions: 0, skills: ranks({ thick_skin: 3, sharp_edge: 2 }) });
    expect(run.player.maxHp).toBe(maxHpAt(levelForXp(0)) + 9);
    expect(run.player.hp).toBe(run.player.maxHp);
    expect(run.player.attackMin).toBe(base.player.attackMin + 2);
    expect(run.player.attackMax).toBe(base.player.attackMax + 2);
  });
  it('Light feet walks faster', () => {
    const go = (skills?: Bonuses) => {
      let r = testRun({ at: start, ...(skills ? { skills } : {}) });
      r = step(r, [{ t: 'click_point', x: start.x + 300, y: start.y }], 0, seededRng(1));
      for (let t = 0; t < 1000; t += 100) r = step(r, [], 100, seededRng(1));
      return r.player.x - start.x;
    };
    expect(go()).toBeCloseTo(PLAYER_DUNGEON_SPEED, 0);
    expect(go(ranks({ light_feet: 2 })) / go()).toBeCloseTo(1.08, 2);
  });
  it('Second wind heals more; Satchel adds bag slots; Parry lengthens the wind-up', () => {
    const b = ranks({ second_wind: 2, satchel: 2, parry: 1 });
    let r = testRun({ potions: 1, skills: b });
    r = { ...r, player: { ...r.player, hp: 1, maxHp: 99 } };
    r = step(r, [{ t: 'drink_potion' }], 0, seededRng(1));
    expect(r.player.hp).toBe(1 + Math.round(POTION.heal * 1.4));
    expect(r.player.bagSlots).toBe(RUN_BAG_SLOTS + 4);
    expect(enemyWindupOf(b)).toBe(ENEMY_WINDUP_MS + 40);
  });
  it('Last stand keeps one lethal hit per run at 1 hp', () => {
    const mk = (skills?: Bonuses) => {
      let r = testRun({ at: start, enemies: [enemyAt(1, start.x + 30, start.y, 'bat', 99)], ...(skills ? { skills } : {}) });
      r = { ...r, player: { ...r.player, hp: 1 }, enemies: [{ ...r.enemies[0]!, windupMs: 100 }] };
      return step(r, [], 100, seededRng(1));
    };
    expect(mk().player.hp).toBeLessThanOrEqual(0);
    const saved = mk(ranks({ last_stand: 1 }));
    expect(saved.player.hp).toBe(1);
    expect(saved.player.lastStandUsed).toBe(true);
    const again = step({ ...saved, enemies: [{ ...saved.enemies[0]!, windupMs: 100 }] }, [], 100, seededRng(1));
    expect(again.player.hp).toBeLessThanOrEqual(0); // spent
  });
});

describe('mining stats', () => {
  it('Strong arm, Pack mule, Prospector and Gem eye', () => {
    expect(pickCooldownOf(ranks({ strong_arm: 3 }))).toBe(Math.round(PICKAXE_COOLDOWN_MS / 1.18));
    expect(runBagSlotsOf('mine', ranks({ pack_mule: 2 }))).toBe(RUN_BAG_SLOTS + 4);
    expect(runBagSlotsOf('mine', ranks({ satchel: 2 }))).toBe(RUN_BAG_SLOTS); // the crypt bag is not the mine bag
    expect(oreQtyOf(2, ranks({ prospector: 2 }), () => 0.99)).toBe(2);
    expect(oreQtyOf(2, ranks({ prospector: 2 }), () => 0)).toBe(3);
    expect(oreQtyOf(30, ranks({ prospector: 2 }), () => 0.99)).toBe(34);
    expect(rockGemChanceOf(ranks({ gem_eye: 1 }))).toBeCloseTo(0.08);
  });
});

describe('fishing stats', () => {
  it('Wide box, Patient, Sharp eye and Reel master change the session', () => {
    const b = ranks({ wide_box: 3, patient: 2, sharp_eye: 2, reel_master: 2 });
    const plain = newFishSession(seededRng(5), []);
    const s = newFishSession(seededRng(5), [], b);
    expect(s.boxSize).toBeCloseTo(FISH_BOX_BASE * 1.12);
    expect(s.waitMs).toBeLessThan(plain.waitMs);
    expect(s.strikeBonusMs).toBe(120);
    expect(s.drainScale).toBeCloseTo(0.84);
    const t = fishStep({ ...s, waitMs: 50 }, [], 100, seededRng(1));
    const p = fishStep({ ...plain, waitMs: 50 }, [], 100, seededRng(1));
    expect(t.phase).toBe('bite');
    expect(t.biteMs).toBeGreaterThan(p.biteMs);
  });
});

describe('no node adds gold', () => {
  it('no skill effect is a gold stat', () => {
    for (const n of SKILL_NODES) for (const e of n.effects) expect(String(e.stat)).not.toMatch(/gold/i);
  });
});
