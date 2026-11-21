// 3e REFILL LOOP: taps and the food stash run down, the player refills them (Refill all, low-stock marks, 'Tap N is empty').
import { describe, expect, it } from 'vitest';
import { REFILL_LOW_AT, STASH_CAP, TAP_CAP } from './config.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { createNewPlayer } from './newPlayer.ts';
import { lowStockMarks, refillStash, refillTaps, stashView, tapNumber } from './refill.ts';
import { forget, memoKey, recalled, remember } from './slotMemo.ts';
import { addToStash, stashPieces, takePlate, unloadStash } from './stash.ts';
import { loadTap, tapStands, unloadTap } from './taps.ts';

const fresh = (): GameState => createNewPlayer(undefined, 0);
const give = (s: GameState, m: Record<string, number>): GameState => applyChange(s, { reason: 'debug', materials: m }, 0)!;
const hatch = (s: GameState) => stashPieces(s.items, s.tavern.roomId)[0]!;
const stand = (s: GameState) => tapStands(s.items, s.tavern.roomId)[0]!;
/** A serve took plates from the stash (the slot keeps its memory, like tavern.ts pourOrder). */
const served = (s: GameState, dish: string, n: number): GameState => {
  let stash = s.tavern.stash;
  for (let k = 0; k < n; k++) stash = takePlate(stash, dish)!.stash;
  return { ...s, tavern: { ...s.tavern, stash } };
};

describe('slot memory', () => {
  it('remembers, recalls and forgets one slot or a whole piece', () => {
    let m = remember(undefined, 'tap', 3, 0, 'root_ale');
    m = remember(m, 'tap', 3, 1, 'carrot_cider');
    m = remember(m, 'stash', 3, 0, 'roasted_turnip');
    expect(memoKey('tap', 3, 1)).toBe('tap:3:1');
    expect(recalled(m, 'tap', 3, 1)).toBe('carrot_cider');
    expect(recalled(forget(m, 'tap', 3, 1), 'tap', 3, 1)).toBeUndefined();
    expect(forget(m, 'tap', 3)).toEqual({ 'stash:3:0': 'roasted_turnip' });
  });
});

describe('refill all', () => {
  it('the stash: a slot that ran dry is filled again with what it held, from the bag; nothing to do = 0', () => {
    let s = addToStash(give(fresh(), { roasted_turnip: 9 }), 'roasted_turnip', 0)!.state;
    s = served(s, 'roasted_turnip', STASH_CAP);
    expect(s.tavern.stash).toEqual([]);
    expect(lowStockMarks(s)).toContainEqual({ uid: hatch(s).uid, kind: 'stash', level: 'empty' });
    const r = refillStash(s, 0);
    expect(r.moved).toBe(3);
    expect(r.state.tavern.stash).toEqual([{ pieceUid: hatch(s).uid, slot: 0, dish: 'roasted_turnip', plates: 3 }]);
    expect(refillStash(r.state, 0).moved).toBe(0); // the bag is empty now
  });

  it('the taps: every tap that holds or held a drink is topped up; an emptied-by-hand tap stays empty', () => {
    let s = fresh();
    const uid = stand(s).uid;
    s = give(s, { root_ale: 20, carrot_cider: 4 });
    s = loadTap(s, uid, 1, 'carrot_cider', 2, 0)!;
    const r = refillTaps(s, 0);
    // tap 0 had the start ale (7 of 12): +5; tap 1 cider 2: +2 (only 4 in the bag)
    expect(r.moved).toBe(TAP_CAP - 7 + 2);
    expect(r.state.tavern.taps.map((t) => [t.slot, t.drink, t.mugs])).toEqual([[0, 'root_ale', TAP_CAP], [1, 'carrot_cider', 4]]);
    const emptied = unloadTap(r.state, uid, 1, 'all', 0)!;
    expect(refillTaps(emptied, 0).state.tavern.taps.map((t) => t.slot)).toEqual([0]);
  });
});

describe('low-stock marks and tap numbers', () => {
  it(`a piece with ${REFILL_LOW_AT} or fewer left is low, a slot that ran dry is empty, a slot emptied by hand has no mark`, () => {
    let s = addToStash(give(fresh(), { roasted_turnip: 3 }), 'roasted_turnip', 0)!.state;
    const uid = hatch(s).uid;
    expect(lowStockMarks(s).find((m) => m.kind === 'stash')).toBeUndefined(); // 3 left
    s = served(s, 'roasted_turnip', 1);
    expect(lowStockMarks(s).find((m) => m.kind === 'stash')).toEqual({ uid, kind: 'stash', level: 'low' });
    expect(lowStockMarks(unloadStash(s, uid, 0, 'all', 0)!).find((m) => m.kind === 'stash')).toBeUndefined();
    s = served(s, 'roasted_turnip', 2);
    expect(lowStockMarks(s).find((m) => m.kind === 'stash')).toEqual({ uid, kind: 'stash', level: 'empty' });
  });

  it('the start tap is tap 1, the second slot tap 2; not a stand = 0', () => {
    const s = fresh();
    expect(tapNumber(s, stand(s).uid, 0)).toBe(1);
    expect(tapNumber(s, stand(s).uid, 1)).toBe(2);
    expect(tapNumber(s, 9999, 0)).toBe(0);
  });
});

describe('the Stash panel view', () => {
  it('slots on top (a dry slot remembers its dish), the bag dishes below, Refill all only when it would move something', () => {
    let s = addToStash(give(fresh(), { roasted_turnip: 2 }), 'roasted_turnip', 0)!.state;
    const uid = hatch(s).uid;
    s = served(s, 'roasted_turnip', 2);
    let v = stashView([uid], s.tavern.stash, s.tavern.lastLoaded, s.player.materials);
    expect(v.slots[0]).toMatchObject({ dish: null, plates: 0, remembered: 'roasted_turnip', low: false });
    expect(v.canRefill).toBe(false); // none in the bag
    s = give(s, { roasted_turnip: 3 });
    v = stashView([uid], s.tavern.stash, s.tavern.lastLoaded, s.player.materials);
    expect(v.canRefill).toBe(true);
    expect(v.bag).toEqual([{ dish: 'roasted_turnip', inBag: 3 }]);
    s = refillStash(s, 0).state;
    v = stashView([uid], s.tavern.stash, s.tavern.lastLoaded, s.player.materials);
    expect(v.slots[0]).toMatchObject({ dish: 'roasted_turnip', plates: 3, remembered: null, low: false });
    expect(v.slots).toHaveLength(4);
  });
});
