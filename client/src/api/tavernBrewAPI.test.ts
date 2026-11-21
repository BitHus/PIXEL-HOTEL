// Step 9t part C through the GameAPI: brewing from the panel (startBrew), the menu calls and the intro flag.
import { describe, expect, it } from 'vitest';
import { applyChange, createNewPlayer, saveKey, seededRng, toSaveText, type GameState } from '@pixel-hotel/shared';
import { ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const MIN = 60_000;
let t = 1000;

function stateWith(materials: Record<string, number>, mutate: (s: GameState) => GameState = (s) => s): GameState {
  const s = { ...createNewPlayer(undefined, 0), playerCreated: true };
  return mutate(applyChange(s, { reason: 'debug', materials }, 0)!);
}

function open(state: GameState) {
  const storage = memoryStorage({ [saveKey()]: toSaveText(state, 0) });
  return { storage, api: LocalGameAPI.open(storage, () => t, seededRng(4)).api };
}

async function inTavern(state: GameState) {
  t = 1000;
  const o = open(state);
  await o.api.enterRoom((await o.api.getPlayer()).shopRoomId);
  return o;
}

const barrelOf = (api: LocalGameAPI) => api.snapshot().items.find((i) => i.typeId === 'brewing_barrel')!;

describe('brewing through the GameAPI (step 9t C)', () => {
  it('brew a new batch (the start ale is on a tap): inputs out, ready later, collect gives the mugs and a gains list', async () => {
    const { api } = await inTavern(stateWith({ turnip: 4, potato: 2 }));
    const uid = barrelOf(api).uid;
    expect(await api.collectBrew(uid)).toBeNull(); // the new game's barrel is idle (step T1)
    expect(await api.startBrew(uid, 'root_ale')).toBe(true);
    const p = await api.getPlayer();
    expect(p.materials.turnip).toBe(2);
    expect(p.materials.potato).toBe(1);
    expect((await api.getTavern()).brews).toEqual([{ barrelUid: uid, drink: 'root_ale', readyAt: t + 8 * MIN }]); // root ale takes 8 minutes since S3
    expect(await api.collectBrew(uid)).toBeNull(); // not ready
    t += 8 * MIN - 1;
    expect(await api.collectBrew(uid)).toBeNull();
    t += 1;
    const got = (await api.collectBrew(uid))!;
    expect(got).toMatchObject({ drink: 'root_ale', mugs: 7 });
    expect(got.gains.some((g) => g.itemId === 'root_ale' && g.count === 7)).toBe(true);
    const end = api.snapshot();
    expect(ledgerMaterials(end)).toEqual(end.player.materials);
  });

  it('one brew per barrel; a second barrel brews at the same time', async () => {
    const { api } = await inTavern(stateWith({ turnip: 8, potato: 4, carrot: 3 }));
    const uid = barrelOf(api).uid;
    await api.collectBrew(uid);
    expect(await api.startBrew(uid, 'root_ale')).toBe(true);
    expect(await api.startBrew(uid, 'carrot_cider')).toBe(false); // in use
    expect((await api.getPlayer()).materials.carrot).toBe(3); // nothing was taken
    api.debugGiveFurniture(['brewing_barrel']);
    const second = api.snapshot().items.find((i) => i.typeId === 'brewing_barrel' && i.uid !== uid)!;
    expect(await api.startBrew(second.uid, 'root_ale')).toBe(false); // in the bag, not in the tavern
    const placed = await api.placeItem(second.uid, { center: { x: 528, y: 272 }, facing: 'down', snap: true });
    expect(placed).not.toBeNull();
    expect(await api.startBrew(second.uid, 'carrot_cider')).toBe(true);
    expect((await api.getTavern()).brews).toHaveLength(2);
    expect((await api.getPlayer()).materials.carrot ?? 0).toBe(0);
  });

  it('refuses a brew with missing crops, an unknown drink, outside the tavern; nothing is taken', async () => {
    const { api } = await inTavern(stateWith({ turnip: 1 }));
    const uid = barrelOf(api).uid;
    await api.collectBrew(uid);
    expect(await api.startBrew(uid, 'root_ale')).toBe(false);
    expect(await api.startBrew(uid, 'turnip' as never)).toBe(false);
    expect((await api.getPlayer()).materials.turnip).toBe(1);
    const p = await api.getPlayer();
    await api.enterRoom(p.hotelRoomId);
    expect(await api.startBrew(uid, 'root_ale')).toBe(false);
  });

  it('a brew goes on across a reload: ready after the game was closed', async () => {
    const { api, storage } = await inTavern(stateWith({ carrot: 3 }));
    const uid = barrelOf(api).uid;
    await api.collectBrew(uid);
    expect(await api.startBrew(uid, 'carrot_cider')).toBe(true);
    t += 3 * 60 * MIN; // the game is closed for 3 hours
    const again = LocalGameAPI.open(storage, () => t, seededRng(5)).api;
    await again.enterRoom((await again.getPlayer()).shopRoomId);
    expect((await again.collectBrew(uid))?.mugs).toBe(6);
  });
});

describe('the menu through the GameAPI (step 9t C)', () => {
  it('getMenu lists what the player owns; setMenuEntry switches and prices it; bad prices are refused', async () => {
    const { api } = await inTavern(stateWith({ roasted_turnip: 2 }));
    await api.collectBrew(barrelOf(api).uid);
    let rows = await api.getMenu();
    expect(rows.find((r) => r.id === 'root_ale')).toMatchObject({ on: true, stock: 7, price: 9 });
    expect(rows.find((r) => r.id === 'roasted_turnip')).toMatchObject({ on: true, stock: 0 }); // the early dish is on in a new game (S3); 3e: the stock is the food stash
    expect(await api.addToStash('roasted_turnip')).toBe(2); // one click: both plates into the serving hatch
    rows = await api.getMenu();
    expect(rows.find((r) => r.id === 'roasted_turnip')).toMatchObject({ on: true, stock: 2 });
    expect((await api.getTavern()).stash).toEqual([expect.objectContaining({ dish: 'roasted_turnip', plates: 2, slot: 0 })]);
    rows = (await api.setMenuEntry('roasted_turnip', { on: false }))!;
    expect(rows.find((r) => r.id === 'roasted_turnip')?.on).toBe(false);
    rows = (await api.setMenuEntry('roasted_turnip', { on: true }))!;
    expect(rows.find((r) => r.id === 'roasted_turnip')?.on).toBe(true);
    rows = (await api.setMenuEntry('roasted_turnip', { price: 20 }))!;
    expect(rows.find((r) => r.id === 'roasted_turnip')).toMatchObject({ on: true, price: 20 });
    expect(await api.setMenuEntry('roasted_turnip', { price: 0 })).toBeNull();
    expect(await api.setMenuEntry('turnip', { on: true })).toBeNull();
    // It is saved: the next call (and a reload) has the same menu.
    expect((await api.getMenu()).find((r) => r.id === 'roasted_turnip')).toMatchObject({ on: true, price: 20 });
  });

  it('a dish cooked at the stove shows up on the menu list and can go on', async () => {
    const { api } = await inTavern(stateWith({ turnip: 3 }));
    const stove = api.snapshot().items.find((i) => i.typeId === 'stove')!;
    expect(await api.startCook(stove.uid, 'roasted_turnip', 2)).toBe(true);
    t += 60_000;
    expect((await api.collectCook(stove.uid))?.qty).toBe(2);
    const row = (await api.getMenu()).find((r) => r.id === 'roasted_turnip')!;
    expect(row).toMatchObject({ on: true, stock: 0 }); // on from the start (S3); cooked into the bag, not yet in the food stash (3e)
    expect(await api.addToStash('roasted_turnip')).toBe(2);
    expect((await api.getMenu()).find((r) => r.id === 'roasted_turnip')).toMatchObject({ on: true, stock: 2 });
    const off = (await api.setMenuEntry('roasted_turnip', { on: false }))!;
    expect(off.find((r) => r.id === 'roasted_turnip')?.on).toBe(false);
    const on = (await api.setMenuEntry('roasted_turnip', { on: true }))!;
    expect(on.find((r) => r.id === 'roasted_turnip')?.on).toBe(true);
  });

  it('the tavern intro is shown once: introSeen turns true and stays', async () => {
    // An old save has introSeen false (migration 12 -> 13); a new game starts with true (it gets a short line instead).
    expect((await inTavern(stateWith({}))).api.snapshot().tavern.introSeen).toBe(true);
    const { api, storage } = await inTavern(stateWith({}, (s) => ({ ...s, tavern: { ...s.tavern, introSeen: false } })));
    expect((await api.getTavern()).introSeen).toBe(false);
    await api.markTavernIntroSeen();
    expect((await api.getTavern()).introSeen).toBe(true);
    const again = LocalGameAPI.open(storage, () => t, seededRng(5)).api;
    expect((await again.getTavern()).introSeen).toBe(true);
  });
});
