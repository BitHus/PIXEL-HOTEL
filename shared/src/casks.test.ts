// Step K2: casks on the keg rack (fill, ripen in real time, collect at the current tier), the tier items, taps with aged drinks, the taste guests and the migration 25 -> 26.

import { describe, expect, it } from 'vitest';
import { CASK_SLOTS, RIPEN, RIPEN_AFTER_MIN, TASTE_AGED_CHANCE } from './config.ts';
import { applyChange } from './ledger.ts';
import { DRINK_TYPES, TIER_DRINK_TYPES, getDrinkType, getMaterialType, isBaseDrinkId, isDrinkId } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { seededRng } from './rng.ts';
import { readSave, toSaveText } from './save.ts';
import { caskTier, caskViews, collectCask, fillCask, kegRacks, returnOrphanCasks } from './casks.ts';
import { loadTap, mugsOnTaps } from './taps.ts';
import { chooseOrder, menuOffers, menuRows, tasteOffers } from './tavern.ts';
import { startBrew } from './brewing.ts';
import { ledgerMaterials } from './testState.ts';
import { withItem } from './tavernTest.ts';
import type { GameState } from './gameState.ts';

const MIN = 60_000;
/** A new game with a keg rack in the tavern (far from the bar) and 7 root ale in the bag (the start ale taken off its tap). */
function withRack(): GameState {
  const s0 = createNewPlayer(undefined, 0);
  const s = withItem(s0, 70, 'keg_rack', 96, 288);
  return applyChange({ ...s, tavern: { ...s.tavern, taps: [] } }, { reason: 'debug', materials: { root_ale: 7, carrot_cider: 6 } }, 0)!;
}

describe('the tier items (built from drinks.json)', () => {
  it('every drink has an aged, a vintage and a reserve item with the numbers 1.6x, 3x and 5x (CEL-5), same icon, vintage and reserve one rank up at most', () => {
    expect(TIER_DRINK_TYPES).toHaveLength(DRINK_TYPES.length * 3);
    expect(RIPEN.map((r) => [r.tier, r.valueMult, r.tipMult])).toEqual([['aged', 1.6, 1.2], ['vintage', 3, 1], ['reserve', 5, 1.5]]);
    const ale = getDrinkType('root_ale');
    expect(getMaterialType('root_ale_aged')).toMatchObject({ name: 'Aged root ale', group: 'drink', baseValue: Math.round(ale.baseValue * 1.6), rank: 'common' });
    expect(getMaterialType('root_ale_vintage')).toMatchObject({ name: 'Vintage root ale', baseValue: ale.baseValue * 3, rank: 'rare' });
    expect(getMaterialType('root_ale_reserve')).toMatchObject({ name: 'Reserve root ale', baseValue: ale.baseValue * 5, rank: 'rare' });
    expect(getMaterialType('glowcap_tonic_vintage').rank).toBe('ultra_rare');
    expect(getDrinkType('root_ale_aged').icon).toEqual(ale.icon);
    expect(getDrinkType('glowcap_tonic_aged').tip).toBeCloseTo(0.25 * 1.2);
    expect(isDrinkId('root_ale_vintage')).toBe(true);
    expect(isBaseDrinkId('root_ale_vintage')).toBe(false);
  });
  it('a barrel never brews a tier item', () => {
    const s = withRack();
    const barrel = s.items.find((i) => i.typeId === 'brewing_barrel')!;
    expect(startBrew({ ...s, tavern: { ...s.tavern, brews: [] } }, barrel.uid, 'root_ale_aged', 1)).toBeNull();
  });
});

describe('casks', () => {
  it('only a keg rack that stands in the tavern has casks: the flag is on the data', () => {
    const s = withRack();
    expect(kegRacks(s.items, s.tavern.roomId).map((i) => i.uid)).toEqual([70]);
    expect(CASK_SLOTS).toBe(3);
  });

  it('fill: the mugs leave the bag (ledger), the slot is taken, limits are enforced', () => {
    let s = withRack();
    s = fillCask(s, 70, 0, 'root_ale', 7, 1000)!;
    expect(s.player.materials.root_ale).toBeUndefined();
    expect(s.tavern.casks).toEqual([{ rackUid: 70, slot: 0, drink: 'root_ale', mugs: 7, startedAt: 1000 }]);
    expect(s.ledger.at(-1)).toMatchObject({ reason: 'cask_fill', materials: { root_ale: -7 } });
    expect(fillCask(s, 70, 0, 'carrot_cider', 6, 1000)).toBeNull(); // taken
    expect(fillCask(s, 70, CASK_SLOTS, 'carrot_cider', 6, 1000)).toBeNull(); // no such slot
    expect(fillCask(s, 70, 1, 'carrot_cider', 7, 1000)).toBeNull(); // more than one brew (6)
    expect(fillCask(s, 70, 1, 'carrot_cider', 0, 1000)).toBeNull();
    expect(fillCask(s, 70, 1, 'root_ale_aged', 1, 1000)).toBeNull(); // not a fresh drink
    expect(fillCask(s, 70, 1, 'carrot_cider', 6, 1000)).not.toBeNull();
    expect(fillCask(s, 99, 1, 'carrot_cider', 6, 1000)).toBeNull(); // no such rack
    expect(fillCask(withRack(), 70, 1, 'root_ale', 8, 0)).toBeNull();
    expect(fillCask({ ...withRack(), player: { ...withRack().player, materials: {} } }, 70, 1, 'root_ale', 1, 0)).toBeNull(); // nothing in the bag
    expect(s.player.materials).toEqual(ledgerMaterials(s));
  });

  it('the tier changes at the exact millisecond (common: aged 30 min, vintage 3 h)', () => {
    const cask = { rackUid: 70, slot: 0, drink: 'root_ale' as const, mugs: 7, startedAt: 5000 };
    const aged = RIPEN_AFTER_MIN.common.aged * MIN;
    const vintage = RIPEN_AFTER_MIN.common.vintage * MIN;
    expect(caskTier(cask, 5000)).toBe('fresh');
    expect(caskTier(cask, 5000 + aged - 1)).toBe('fresh');
    expect(caskTier(cask, 5000 + aged)).toBe('aged');
    expect(caskTier(cask, 5000 + vintage - 1)).toBe('aged');
    expect(caskTier(cask, 5000 + vintage)).toBe('vintage');
    // A rare drink waits longer (pumpkin stout: rare).
    const stout = { ...cask, drink: 'pumpkin_stout' as const };
    expect(caskTier(stout, 5000 + aged)).toBe('fresh');
    expect(caskTier(stout, 5000 + RIPEN_AFTER_MIN.rare.aged * MIN)).toBe('aged');
  });

  it('collect gives the CURRENT tier (fresh when too early), frees the slot, and the ledger adds up', () => {
    const base = fillCask(withRack(), 70, 0, 'root_ale', 7, 1000)!;
    const early = collectCask(base, 70, 0, 1000 + 29 * MIN)!;
    expect(early).toMatchObject({ item: 'root_ale', mugs: 7, tier: 'fresh' });
    expect(early.state.tavern.casks).toEqual([]);
    const aged = collectCask(base, 70, 0, 1000 + 30 * MIN)!;
    expect(aged).toMatchObject({ item: 'root_ale_aged', mugs: 7, tier: 'aged' });
    expect(aged.state.player.materials.root_ale_aged).toBe(7);
    expect(aged.state.ledger.at(-1)).toMatchObject({ reason: 'cask_collect', materials: { root_ale_aged: 7 } });
    expect(aged.state.player.seen.root_ale_aged?.count).toBe(7); // a Book find
    const old = collectCask(base, 70, 0, 1000 + 5 * 60 * MIN)!;
    expect(old).toMatchObject({ item: 'root_ale_vintage', tier: 'vintage' });
    expect(old.state.player.materials).toEqual(ledgerMaterials(old.state));
    expect(collectCask(old.state, 70, 0, 9e9)).toBeNull(); // empty now
    // The slot can be filled again.
    expect(fillCask(old.state, 70, 0, 'root_ale', 1, 9e9 - 1)).toBeNull(); // the bag is empty (7 root ale went in)
  });

  it('ripens across a save and a reload (the time is just the clock)', () => {
    const s = fillCask(withRack(), 70, 0, 'root_ale', 7, 1000)!;
    const back = readSave(toSaveText(s, 5));
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(caskViews(back.state, 1000 + 31 * MIN).find((v) => v.slot === 0)).toMatchObject({ drink: 'root_ale', mugs: 7, tier: 'aged' });
    expect(collectCask(back.state, 70, 0, 1000 + 31 * MIN)!.item).toBe('root_ale_aged');
  });

  it('caskViews lists CASK_SLOTS slots per rack with the time to the next tier', () => {
    const s = fillCask(withRack(), 70, 1, 'root_ale', 7, 0)!;
    const v = caskViews(s, 10 * MIN);
    expect(v).toHaveLength(CASK_SLOTS);
    expect(v[0]).toMatchObject({ drink: null, mugs: 0 });
    expect(v[1]).toMatchObject({ drink: 'root_ale', tier: 'fresh', nextInMs: 20 * MIN });
    expect(caskViews(s, 40 * MIN)[1]).toMatchObject({ tier: 'aged', nextInMs: 140 * MIN });
    expect(caskViews(s, 200 * MIN)[1]).toMatchObject({ tier: 'vintage', nextInMs: 0, progress: 1 });
  });

  it('a rack that is gone gives the fresh mugs back (no find); a rack in the bag keeps its casks', () => {
    const s = fillCask(withRack(), 70, 0, 'root_ale', 7, 0)!;
    const inBag = { ...s, items: s.items.map((i) => (i.uid === 70 ? { ...i, roomId: null, onItemUid: null } : i)) };
    expect(returnOrphanCasks(inBag, 5).tavern.casks).toHaveLength(1);
    expect(collectCask(inBag, 70, 0, 9e9)).toBeNull(); // not placed: cannot collect
    const sold = returnOrphanCasks({ ...inBag, items: inBag.items.filter((i) => i.uid !== 70) }, 5);
    expect(sold.tavern.casks).toEqual([]);
    expect(sold.player.materials.root_ale).toBe(7);
    expect(sold.player.materials).toEqual(ledgerMaterials(sold));
  });
});

describe('aged drinks on the taps and the menu', () => {
  it('load, menu stock and price work with the tier items unchanged (T1 rules)', () => {
    let s = fillCask(withRack(), 70, 0, 'root_ale', 7, 0)!;
    s = collectCask(s, 70, 0, 40 * MIN)!.state;
    const stand = s.items.find((i) => i.typeId === 'tap_stand')!;
    s = loadTap(s, stand.uid, 1, 'root_ale_aged', 7, 40 * MIN)!;
    expect(mugsOnTaps(s.tavern.taps, 'root_ale_aged')).toBe(7);
    expect(menuRows(s).find((r) => r.id === 'root_ale_aged')).toMatchObject({ stock: 7, on: true, price: Math.round(9 * 1.6), baseValue: Math.round(9 * 1.6) });
    expect(menuOffers(s).some((o) => o.id === 'root_ale_aged')).toBe(true);
  });
});

describe('taste guests', () => {
  const plain = { id: 'root_ale' as const, price: 9, baseValue: 9, stock: 5 };
  const aged = { id: 'root_ale_aged' as const, price: 14, baseValue: 14, stock: 5 };

  it('with no aged drink on a tap nothing changes and the rng is not used', () => {
    let used = 0;
    const rng = () => (used++, 0.1);
    expect(tasteOffers([plain], rng)).toEqual([plain]);
    expect(used).toBe(0);
  });
  it('a taste guest (roll under TASTE_AGED_CHANCE) looks only at the aged offers; else at everything', () => {
    expect(tasteOffers([plain, aged], () => TASTE_AGED_CHANCE - 0.01)).toEqual([aged]);
    expect(tasteOffers([plain, aged], () => TASTE_AGED_CHANCE)).toEqual([plain, aged]);
  });
  it('the price rule accepts an aged drink up to tolerance x its value (1.6x of the plain drink)', () => {
    const rng = seededRng(1);
    expect(chooseOrder([aged], 1, rng)).toMatchObject({ order: { id: 'root_ale_aged' }, reaction: 'smile' });
    expect(chooseOrder([{ ...aged, price: 25 }], 1, rng)!.order).toBeNull(); // far above 1.6 x 9
    expect(chooseOrder([{ ...aged, price: 14 }], 1.1, rng)).toMatchObject({ order: { id: 'root_ale_aged' } });
  });
  it('over many guests about TASTE_AGED_CHANCE of the orders are aged when both are on the menu', () => {
    const rng = seededRng(7);
    let agedOrders = 0;
    const n = 2000;
    for (let k = 0; k < n; k++) if (chooseOrder(tasteOffers([plain, aged], rng), 1, rng)?.order?.id === 'root_ale_aged') agedOrders++;
    // A taste guest always takes the aged one; others pick either of two at random.
    expect(agedOrders / n).toBeGreaterThan(TASTE_AGED_CHANCE + (1 - TASTE_AGED_CHANCE) * 0.5 - 0.06);
    expect(agedOrders / n).toBeLessThan(TASTE_AGED_CHANCE + (1 - TASTE_AGED_CHANCE) * 0.5 + 0.06);
  });
});

describe('migration 25 -> 26 (step K2)', () => {
  it('adds an empty casks list and changes nothing else; no second migration', () => {
    const base = createNewPlayer(undefined, 3);
    const { casks: _gone, ...tavern } = base.tavern;
    const old = { ...base, tavern };
    const r = readSave(JSON.stringify({ version: 25, savedAt: 9, state: old }));
    expect(r).toMatchObject({ ok: true, migrated: true, version: 25 });
    if (!r.ok) return;
    expect(r.state.tavern.casks).toEqual([]);
    expect({ ...r.state, tavern: { ...r.state.tavern, casks: undefined } }).toEqual({ ...old, tavern: { ...old.tavern, casks: undefined } });
    expect(readSave(toSaveText(r.state, 9))).toMatchObject({ ok: true, migrated: false });
  });
});
