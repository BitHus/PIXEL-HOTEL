import { describe, expect, it } from 'vitest';
import { barrels, brewCards, brewOf, brewReady, brewReadyInMs, collectBrew, returnOrphanBrews, startBrew } from './brewing.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { DRINK_TYPES, getMaterialType } from './materials.ts';
import { createNewPlayer } from './newPlayer.ts';
import { readSave, toSaveText } from './save.ts';
import { ledgerMaterials } from './testState.ts';

const MIN = 60_000;
/** A new game as it was before step T1: the barrel holds 7 root ale ready to collect, the taps are empty. The real start (7 mugs on a tap, an idle barrel) is the first test. */
const fresh = (): GameState => {
  const s = createNewPlayer(undefined, 1000);
  const uid = s.items.find((i) => i.typeId === 'brewing_barrel')!.uid;
  return { ...s, tavern: { ...s.tavern, taps: [], brews: [{ barrelUid: uid, drink: 'root_ale', readyAt: 1000 }] } };
};
const barrelUid = (s: GameState): number => s.items.find((i) => i.typeId === 'brewing_barrel')!.uid;
const withCrops = (s: GameState): GameState => applyChange(s, { reason: 'debug', materials: { turnip: 4, potato: 4, carrot: 4, pumpkin: 1, glowcap: 1 } }, 1000)!;

describe('brewing (step 9t)', () => {
  it('has the four drinks of the brief, as stackable goods that sell as food', () => {
    expect(DRINK_TYPES.slice(0, 4).map((d) => [d.id, d.inputs, d.minutes, d.mugs])).toEqual([
      ['root_ale', { turnip: 2, potato: 1 }, 8, 7],
      ['carrot_cider', { carrot: 3 }, 20, 6],
      ['pumpkin_stout', { pumpkin: 1, potato: 2 }, 45, 8],
      ['glowcap_tonic', { glowcap: 1, carrot: 1 }, 30, 4],
    ]);
    expect(DRINK_TYPES.find((d) => d.id === 'glowcap_tonic')!.tip).toBeGreaterThan(0);
    for (const d of DRINK_TYPES) {
      expect(getMaterialType(d.id)).toMatchObject({ group: 'drink', baseValue: d.baseValue, rank: d.rank });
    }
  });

  it('a new game (step T1): the barrel is idle and the 7 root ale are already loaded on the first tap', () => {
    const s = createNewPlayer(undefined, 1000);
    expect(s.tavern.brews).toEqual([]);
    const stand = s.items.find((i) => i.typeId === 'tap_stand')!;
    expect(s.tavern.taps).toEqual([{ standUid: stand.uid, slot: 0, drink: 'root_ale', mugs: 7 }]);
    expect(s.player.materials.root_ale).toBeUndefined();
  });

  it('a barrel with a ready brew gives 7 root ale (collect)', () => {
    const s = fresh();
    const uid = barrelUid(s);
    expect(barrels(s.items, s.tavern.roomId).map((b) => b.uid)).toEqual([uid]);
    expect(s.tavern.brews).toEqual([{ barrelUid: uid, drink: 'root_ale', readyAt: 1000 }]);
    const got = collectBrew(s, uid, 1000)!;
    expect(got).toMatchObject({ drink: 'root_ale', mugs: 7 });
    expect(got.state.player.materials.root_ale).toBe(7);
    expect(got.state.tavern.brews).toEqual([]);
    expect(got.state.ledger.at(-1)).toMatchObject({ reason: 'brew', materials: { root_ale: 7 } });
    expect(got.state.player.seen.root_ale?.count).toBe(7);
    // An empty barrel gives nothing.
    expect(collectBrew(got.state, uid, 2000)).toBeNull();
  });

  it('brews over real time: the crops go in, the mugs come out when the time is up', () => {
    let s = withCrops(collectBrew(fresh(), barrelUid(fresh()), 1000)!.state);
    const uid = barrelUid(s);
    s = startBrew(s, uid, 'carrot_cider', 5000)!;
    expect(s.player.materials.carrot).toBe(1);
    const brew = brewOf(s.tavern.brews, uid)!;
    expect(brew.readyAt).toBe(5000 + 20 * MIN);
    expect(brewReady(brew, 5000 + 20 * MIN - 1)).toBe(false);
    expect(brewReadyInMs(brew, 5000 + 5 * MIN)).toBe(15 * MIN);
    expect(collectBrew(s, uid, 5000 + 20 * MIN - 1)).toBeNull();
    // The barrel is in use; a second brew needs a second barrel.
    expect(startBrew(s, uid, 'root_ale', 6000)).toBeNull();
    const got = collectBrew(s, uid, 5000 + 20 * MIN)!;
    expect(got.state.player.materials.carrot_cider).toBe(6);
    expect(got.state.player.materials).toEqual(ledgerMaterials(got.state));
  });

  it('refuses a brew without the crops, an unknown drink, or something that is not a placed barrel', () => {
    const s = collectBrew(fresh(), barrelUid(fresh()), 1000)!.state;
    const uid = barrelUid(s);
    expect(startBrew(s, uid, 'root_ale', 2000)).toBeNull();
    const rich = withCrops(s);
    expect(startBrew(rich, uid, 'turnip', 2000)).toBeNull();
    expect(startBrew(rich, rich.items.find((i) => i.typeId === 'counter')!.uid, 'root_ale', 2000)).toBeNull();
    const inBag = { ...rich, items: rich.items.map((i) => (i.uid === uid ? { ...i, roomId: null } : i)) };
    expect(startBrew(inBag, uid, 'root_ale', 2000)).toBeNull();
    expect(startBrew(rich, uid, 'root_ale', 2000)).not.toBeNull();
  });

  it('goes on while the game is closed: a brew survives a save and reload', () => {
    let s = withCrops(collectBrew(fresh(), barrelUid(fresh()), 1000)!.state);
    const uid = barrelUid(s);
    s = startBrew(s, uid, 'pumpkin_stout', 10_000)!;
    const loaded = readSave(toSaveText(s, 20_000));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(loaded.state.tavern.brews).toEqual(s.tavern.brews);
    expect(collectBrew(loaded.state, uid, 10_000 + 44 * MIN)).toBeNull();
    // Hours later (the game was closed meanwhile) it is simply ready.
    expect(collectBrew(loaded.state, uid, 10_000 + 6 * 60 * MIN)?.mugs).toBe(8);
  });

  it('a barrel in the bag keeps its brew; a barrel that was sold gives the crops back', () => {
    let s = withCrops(collectBrew(fresh(), barrelUid(fresh()), 1000)!.state);
    const uid = barrelUid(s);
    s = startBrew(s, uid, 'root_ale', 2000)!;
    const inBag = { ...s, items: s.items.map((i) => (i.uid === uid ? { ...i, roomId: null } : i)) };
    expect(returnOrphanBrews(inBag, 3000)).toBe(inBag);
    expect(collectBrew(inBag, uid, 2000 + 60 * MIN)).toBeNull();
    // A barrel that is gone (no longer one of the player's items) gives the crops back.
    const gone = { ...inBag, items: inBag.items.filter((i) => i.uid !== uid) };
    const back = returnOrphanBrews(gone, 3000);
    expect(back.tavern.brews).toEqual([]);
    expect(back.player.materials.turnip).toBe(4);
    expect(back.player.materials.potato).toBe(4);
    expect(back.player.materials).toEqual(ledgerMaterials(back));
    // Crops that only come back are no new finds.
    expect(back.player.seen.turnip?.count).toBe(4);
  });

  it('brewCards: one card per recipe with what the player owns, grey (short) when missing', () => {
    const cards = brewCards({ turnip: 1, potato: 1 });
    expect(cards.map((c) => c.id)).toEqual(DRINK_TYPES.map((d) => d.id));
    const ale = cards.find((c) => c.id === 'root_ale')!;
    expect(ale).toMatchObject({ minutes: 8, mugs: 7, value: 9, can: false });
    expect(ale.inputs).toEqual([
      { id: 'turnip', need: 2, have: 1, short: true },
      { id: 'potato', need: 1, have: 1, short: false },
    ]);
    expect(brewCards({ turnip: 2, potato: 1 }).find((c) => c.id === 'root_ale')!.can).toBe(true);
    expect(brewCards({}).every((c) => !c.can)).toBe(true);
  });
});
