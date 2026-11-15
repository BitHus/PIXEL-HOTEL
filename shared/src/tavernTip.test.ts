// Step S3: the gem a happy tavern guest sometimes leaves with the coins. Pure rule, fixed rng.

import { describe, expect, it } from 'vitest';
import { GEMS, SHOP_TICK_MS, TAVERN_GEM_CHANCE_MULT } from './config.ts';
import { RANKS } from './ranks.ts';
import { tavernGemChance, tavernGemDrop, tavernTipGems } from './gems.ts';
import { catchUpTavern, guestTip, stepTavern } from './guests.ts';
import type { GameState } from './gameState.ts';
import { clearDish, collectCoins, tavernSeats, type Guest } from './tavern.ts';
import { legacyStart, tavernWorld, withAle } from './tavernTest.ts';
import { ledgerGems, ledgerGold } from './testState.ts';
import type { Rng } from './types.ts';

const always = (v: number): Rng => () => v;

/** A guest on the first start seat who is eating and finishes in the next step. */
function eating(s: GameState, patch: Partial<Guest> = {}, item: 'root_ale' | 'pumpkin_pie' = 'root_ale'): GameState {
  const seat = tavernSeats(s.items, s.tavern.roomId)[0]!;
  const g: Guest = {
    id: -1, kind: 'browser', look: s.look, x: seat.x, y: seat.y, facing: seat.facing, path: [], speed: 72, phase: 'eat', groupId: -1,
    seat: { uid: seat.uid, index: seat.index }, seated: true, tolerance: 1, waitMs: SHOP_TICK_MS, order: { item, price: 9, coins: 9 },
    patienceMs: 90_000, warned: false, talkInMs: 99_999, sipInMs: 99_999, reaction: 'smile', ...patch,
  };
  return { ...s, tavern: { ...s.tavern, guests: [g] } };
}

describe('the tavern gem tip (step S3)', () => {
  it('the chance is set by the rank of what was ordered: common lowest, never over 1', () => {
    const chances = RANKS.map((r) => tavernGemChance(r));
    expect(chances[0]).toBeCloseTo(GEMS.tavern.chance);
    for (let i = 1; i < chances.length; i++) expect(chances[i]!).toBeGreaterThan(chances[i - 1]!);
    for (const r of RANKS) expect(tavernGemChance(r)).toBeLessThanOrEqual(1);
    expect(tavernGemChance('rare')).toBeCloseTo(GEMS.tavern.chance * TAVERN_GEM_CHANCE_MULT.rare);
  });

  it('tavernGemDrop with a fixed rng: a low roll gives the minimum, a high roll nothing; the rolls come in a fixed order', () => {
    expect(tavernGemDrop('common', always(0))).toBe(GEMS.tavern.min);
    expect(tavernGemDrop('common', always(0.999))).toBe(0);
    const calls: number[] = [];
    const rng: Rng = () => (calls.push(1), 0);
    tavernGemDrop('rare', rng);
    expect(calls).toHaveLength(2); // the chance, then the amount
    const one: number[] = [];
    tavernGemDrop('common', () => (one.push(1), 0.999));
    expect(one).toHaveLength(1);
  });

  it('is small: the expected gems of one happy guest are well under one', () => {
    for (const r of RANKS) expect(tavernTipGems(r)).toBeLessThan(GEMS.tavern.max);
    expect(tavernTipGems('common')).toBeLessThan(0.1);
  });

  it('a guest who had to call out for the order, or frowned, leaves no tip', () => {
    expect(guestTip({ warned: false, reaction: 'smile' }, 'root_ale', always(0))).toBe(1);
    expect(guestTip({ warned: false, reaction: 'big_smile' }, 'root_ale', always(0))).toBe(1);
    expect(guestTip({ warned: true, reaction: 'smile' }, 'root_ale', always(0))).toBe(0);
    expect(guestTip({ warned: false, reaction: 'frown' }, 'root_ale', always(0))).toBe(0);
  });

  it('a happy guest who finishes eating leaves coins AND the gem on the table spot (nothing is paid yet)', () => {
    let s = eating(withAle());
    const gold = s.player.wallet.gold;
    const r = stepTavern(s, tavernWorld(s), SHOP_TICK_MS, always(0), 100);
    s = r.state;
    expect(s.tavern.mess).toHaveLength(1);
    expect(s.tavern.mess[0]).toMatchObject({ coins: 9, gems: 1, dish: 'root_ale' });
    expect(r.events.find((e) => e.t === 'coins')).toMatchObject({ mess: { gems: 1 } });
    expect(s.player.wallet.gold).toBe(gold); // never automatic
    expect(s.player.wallet.gems).toBe(0);
  });

  it('with a high roll the guest leaves coins only', () => {
    const s = stepTavern(eating(withAle()), tavernWorld(withAle()), SHOP_TICK_MS, always(0.999), 100).state;
    expect(s.tavern.mess[0]).toMatchObject({ coins: 9, gems: 0 });
  });

  it('a rarer order tips more often: with a roll of 0.12 a pumpkin pie (rare) tips and root ale (common) does not', () => {
    const base = withAle();
    const pie = stepTavern(eating(base, {}, 'pumpkin_pie'), tavernWorld(base), SHOP_TICK_MS, always(0.12), 100).state;
    const ale = stepTavern(eating(base, {}, 'root_ale'), tavernWorld(base), SHOP_TICK_MS, always(0.12), 100).state;
    expect(pie.tavern.mess[0]!.gems).toBeGreaterThan(0);
    expect(ale.tavern.mess[0]!.gems).toBe(0);
  });

  it('one tap on the table takes the coins and the gem together: wallet, ledger and popup numbers agree; the dish stays until cleared', () => {
    let s = stepTavern(eating(withAle()), tavernWorld(withAle()), SHOP_TICK_MS, always(0), 100).state;
    const id = s.tavern.mess[0]!.id;
    const before = s;
    const got = collectCoins(s, id, 500)!;
    expect(got).toMatchObject({ coins: 9, gems: 1 });
    s = got.state;
    expect(s.player.wallet).toEqual({ gold: before.player.wallet.gold + 9, gems: before.player.wallet.gems + 1 });
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'tavern', goldDelta: 9, gemsDelta: 1 });
    expect(s.player.wallet.gold).toBe(ledgerGold(s));
    expect(s.player.wallet.gems).toBe(ledgerGems(s));
    expect(s.tavern.mess[0]).toMatchObject({ coins: 0, gems: 0, dish: 'root_ale' });
    expect(collectCoins(s, id, 600)).toBeNull(); // nothing left to take twice
    expect(clearDish(s, id)!.tavern.mess).toEqual([]);
  });

  it('coins without a gem pay gold only, no gem entry', () => {
    const s = stepTavern(eating(withAle()), tavernWorld(withAle()), SHOP_TICK_MS, always(0.999), 100).state;
    const got = collectCoins(s, s.tavern.mess[0]!.id, 500)!;
    expect(got.gems).toBe(0);
    expect(got.state.ledger.at(-1)!.gemsDelta).toBeUndefined();
  });

  it('after a closed game the guests who were eating have left their gem too (catch-up maths, fixed rng)', () => {
    const s = eating(withAle());
    const r = catchUpTavern(s, tavernWorld(s), 60_000, always(0));
    expect(r.state.tavern.mess.some((m) => m.gems === 1 && m.coins === 9)).toBe(true);
  });

  it('a new game starts a tavern with no gem on any table', () => {
    expect(legacyStart().tavern.mess).toEqual([]);
  });
});
