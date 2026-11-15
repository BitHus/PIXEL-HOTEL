// Gems in the dungeon and the mine (step BG4): sources, pickups, the death rule, banking through the ledger.

import { describe, expect, it } from 'vitest';
import { DEATH_GOLD_LOSS, GEMS, GEM_PICKUP_REACH, GEM_RANK_MULT, MINE_LANTERN_MS, ROCK_HITS } from '../config.ts';
import { gainsFromRunEvents } from '../gains.ts';
import { createNewPlayer } from '../newPlayer.ts';
import { seededRng } from '../rng.ts';
import type { Rng } from '../types.ts';
import { finishRun } from './bank.ts';
import { blockCenter } from './grid.ts';
import type { DungeonRun } from './run.ts';
import { step } from './step.ts';
import { enemyAt, testRun } from './testRun.ts';

const start = blockCenter(5, 5);
/** An rng that always rolls 0: every chance hits, every amount is the minimum. */
const low: Rng = () => 0;
const gemEvents = (r: DungeonRun) => r.events.filter((e) => e.t === 'gem_drop' || e.t === 'gem_pickup');

describe('gem sources in the run', () => {
  it('a kill drops a pile at the enemy (the enemy rank scales it)', () => {
    const r = step(testRun({ at: start, enemies: [enemyAt(1, start.x + 100, start.y, 'skeleton', 1)] }), [{ t: 'click_enemy', id: 1 }], 0, low);
    // The skeleton is out of reach: walk there, then the hit lands and it dies.
    let s = r;
    for (let i = 0; i < 40 && s.enemies.length > 0; i++) s = step(s, [], 100, low);
    expect(s.enemies).toEqual([]);
    expect(s.pickups.length + s.bag.gems).toBeGreaterThan(0);
  });

  it('a wooden chest drops common gems, a golden chest rare ones (x2)', () => {
    const wooden = step(testRun({ at: start, chests: [{ id: 1, kind: 'wooden', mimic: false, opened: false, x: start.x, y: start.y }] }), [], 200, low);
    const golden = step(testRun({ at: start, chests: [{ id: 1, kind: 'golden', mimic: false, opened: false, x: start.x, y: start.y }] }), [], 200, low);
    // The pile lies on the chest, next to the player: picked up on the next tick.
    expect(wooden.bag.gems).toBe(GEMS.chest.min * GEM_RANK_MULT.common);
    expect(golden.bag.gems).toBe(GEMS.chest.min * GEM_RANK_MULT.rare);
  });

  it('a mine rock drops gems by its kind', () => {
    const rock = { id: 1, kind: 'mithril' as const, hitsLeft: 1, x: start.x + 20, y: start.y };
    let r: DungeonRun = { ...testRun({ at: start }), place: 'mine', rocks: [rock], lanternEndsAt: MINE_LANTERN_MS };
    r = { ...r, player: { ...r.player, minesMithril: true } };
    r = step(r, [{ t: 'click_rock', id: 1 }], 100, low);
    expect(ROCK_HITS.mithril).toBeGreaterThan(1);
    expect(r.bag.gems).toBe(GEMS.rock.min * GEM_RANK_MULT.ultra_rare);
  });

  it('the Bone King always drops gems (boss source)', () => {
    let r = testRun({ at: start, floor: 3, enemies: [enemyAt(1, start.x + 20, start.y, 'bone_king', 1)] });
    r = step(r, [{ t: 'click_enemy', id: 1 }], 100, seededRng(3));
    expect(r.bossDefeated).toBe(true);
    // Dropped at the boss's feet, picked up at once, then banked with the boss.
    expect(r.banked.gems).toBeGreaterThanOrEqual(GEMS.boss.min * GEM_RANK_MULT.ultra_rare);
  });

  it('no gems when the roll misses', () => {
    const miss: Rng = () => 0.9999;
    const r = step(testRun({ at: start, chests: [{ id: 1, kind: 'wooden', mimic: false, opened: false, x: start.x, y: start.y }] }), [], 100, miss);
    expect(gemEvents(r)).toEqual([]);
  });
});

describe('gem pickups', () => {
  const withPile = (at = { x: start.x + 100, y: start.y }): DungeonRun => ({ ...testRun({ at: start }), pickups: [{ id: 1, x: at.x, y: at.y, qty: 3 }] });

  it('a pile far away stays on the floor', () => {
    const r = step(withPile(), [], 100, low);
    expect(r.pickups).toHaveLength(1);
    expect(r.bag.gems).toBe(0);
  });

  it('walking onto it puts the gems in the bag (a click on the pile is a walk)', () => {
    let r = withPile();
    r = step(r, [{ t: 'click_point', x: start.x + 100, y: start.y }], 0, low);
    for (let i = 0; i < 20 && r.pickups.length > 0; i++) r = step(r, [], 100, low);
    expect(r.pickups).toEqual([]);
    expect(r.bag.gems).toBe(3);
  });

  it('is collected from GEM_PICKUP_REACH away', () => {
    const r = step(withPile({ x: start.x + GEM_PICKUP_REACH - 1, y: start.y }), [], 100, low);
    expect(r.bag.gems).toBe(3);
    expect(gainsFromRunEvents(r.events)).toEqual([{ itemId: 'gems', count: 3, rank: 'common' }]);
  });

  it('a pile the player left behind is gone with the floor', () => {
    let r: DungeonRun = { ...withPile(), status: 'exit_choice' };
    r = step(r, [{ t: 'choose_exit', choice: 'deeper' }], 0, low);
    expect(r.pickups).toEqual([]);
    expect(r.bag.gems).toBe(0);
  });
});

describe('gems when the run ends', () => {
  const bagged = (gems: number, gold = 0): DungeonRun => {
    const r = testRun({ at: start });
    return { ...r, bag: { slots: [], gold, gems } };
  };

  it('Leave keeps every gem (banked)', () => {
    let r: DungeonRun = { ...bagged(7), status: 'exit_choice' };
    r = step(r, [{ t: 'choose_exit', choice: 'leave' }], 0, low);
    expect(r.status).toBe('left');
    expect(r.banked.gems).toBe(7);
    expect(r.bag.gems).toBe(0);
  });

  it('death loses the same share as gold (rounded: the player keeps the rounded down part)', () => {
    let r = bagged(9, 41);
    r = { ...r, enemies: [enemyAt(1, start.x + 30, start.y, 'skeleton', 99)], player: { ...r.player, hp: 1 } };
    for (let i = 0; i < 12 && r.status === 'active'; i++) r = step(r, [], 100, seededRng(1));
    expect(r.status).toBe('dead');
    const kept = Math.floor(9 * (1 - DEATH_GOLD_LOSS));
    expect(r.banked.gems).toBe(kept);
    expect(r.lost.gems).toBe(9 - kept);
    expect(r.banked.gems + r.lost.gems).toBe(9);
    expect(r.bag.gems).toBe(0);
  });

  it('the mine carries the player out with all gems (ore is halved, gems are not)', () => {
    let r: DungeonRun = { ...bagged(5), place: 'mine', lanternEndsAt: MINE_LANTERN_MS, enemies: [enemyAt(1, start.x + 30, start.y, 'skeleton', 99)] };
    r = { ...r, player: { ...r.player, hp: 1 } };
    for (let i = 0; i < 12 && r.status === 'active'; i++) r = step(r, [], 100, seededRng(1));
    expect(r.status).toBe('dead');
    expect(r.banked.gems).toBe(5);
    expect(r.lost.gems).toBe(0);
  });

  it('banking: the ledger adds the banked gems to the wallet, once, and the entry says so', () => {
    const state = createNewPlayer(undefined, 0);
    let r: DungeonRun = { ...bagged(6, 10), status: 'exit_choice' };
    r = step(r, [{ t: 'choose_exit', choice: 'leave' }], 0, low);
    const next = finishRun({ ...state, run: null }, r, 5)!;
    expect(next.player.wallet.gems).toBe(state.player.wallet.gems + 6);
    expect(next.player.wallet.gold).toBe(state.player.wallet.gold + 10);
    const entry = next.ledger.at(-1)!;
    expect(entry).toMatchObject({ reason: 'dungeon_bank', gemsDelta: 6, goldDelta: 10 });
    // The ledger adds up: the wallet is the sum of the deltas.
    expect(next.ledger.reduce((a, e) => a + (e.gemsDelta ?? 0), 0)).toBe(next.player.wallet.gems);
  });
});
