// Taps through the GameAPI (step T1): loading, the pour step in the serving chain, an empty tap, the menu, a save.

import { describe, expect, it } from 'vitest';
import { POUR_MS, TAP_CAP, applyChange, createNewPlayer, saveKey, toSaveText, type Rng, type TavernClientEvent } from '@pixel-hotel/shared';
import { ledgerMaterials } from '../../../shared/src/testState.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

function seeded(seed: number): Rng {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A storage holding a new game with these materials in the bag. */
function storageWith(materials: Record<string, number>) {
  const storage = memoryStorage();
  const state = applyChange(createNewPlayer(undefined, 1_000_000), { reason: 'debug', materials }, 1_000_000)!;
  storage.set(saveKey(), toSaveText({ ...state, playerCreated: true }, 1_000_000));
  return storage;
}

async function openTavern(seed = 7, storage = memoryStorage(), start = 1_000_000) {
  let now = start;
  const { api } = LocalGameAPI.open(storage, () => now, seeded(seed));
  const p = await api.getPlayer();
  await api.enterRoom(p.shopRoomId);
  const events: { e: TavernClientEvent; at: number }[] = [];
  api.onTavern((e) => events.push({ e, at: now }));
  const until = async (done: () => Promise<boolean> | boolean, maxMs = 400_000): Promise<boolean> => {
    for (let ms = 0; ms < maxMs; ms += 100) {
      if (await done()) return true;
      now += 100;
      api.update();
    }
    return false;
  };
  const tavern = () => api.getTavern();
  const stand = () => api.snapshot().items.find((i) => i.typeId === 'tap_stand')!;
  const mugs = async (drink = 'root_ale') => (await tavern()).taps.filter((t) => t.drink === drink).reduce((n, t) => n + t.mugs, 0);
  const firstOrder = async () => {
    expect(await until(async () => (await tavern()).guests.some((g) => g.phase === 'order'))).toBe(true);
    return (await tavern()).guests.find((g) => g.phase === 'order')!;
  };
  return { api, events, until, tavern, stand, mugs, firstOrder, now: () => now, storage };
}

describe('taps through the GameAPI (step T1)', () => {
  it('the serving chain with the pour step: walk to the taps, pour POUR_MS, the tap drops by one, then the mug is carried to the guest', async () => {
    const { api, events, until, mugs, firstOrder, stand } = await openTavern();
    expect(await mugs()).toBe(7);
    const guest = await firstOrder();
    expect(await mugs()).toBe(7); // an order alone takes nothing
    expect(await api.serveGuest(guest.id)).toBe(true);
    expect(await until(() => events.some((x) => x.e.t === 'pour'))).toBe(true);
    const pour = events.find((x) => x.e.t === 'pour')!;
    expect(pour.e).toMatchObject({ t: 'pour', guestId: guest.id, item: 'root_ale', standUid: stand().uid, ms: POUR_MS });
    // While pouring the mug is still on the tap and the hands are empty.
    expect(await mugs()).toBe(7);
    expect(events.some((x) => x.e.t === 'holding')).toBe(false);
    expect(await until(() => events.some((x) => x.e.t === 'holding' && x.e.item === 'root_ale'))).toBe(true);
    const held = events.find((x) => x.e.t === 'holding' && x.e.item === 'root_ale')!;
    expect(held.at - pour.at).toBeGreaterThanOrEqual(POUR_MS);
    expect(held.at - pour.at).toBeLessThanOrEqual(POUR_MS + 300);
    expect(await mugs()).toBe(6); // the pour took one mug
    // The walk to the table, the order is put down.
    expect(await until(() => events.some((x) => x.e.t === 'served' && x.e.guestId === guest.id))).toBe(true);
    expect((await api.getTavern()).guests.find((g) => g.id === guest.id)?.phase).toBe('eat');
    expect(await mugs()).toBe(6);
    // The order of the events: walk (to the taps), pour, holding, walk, served.
    const kinds = events.map((x) => x.e.t).filter((t) => ['walk', 'pour', 'holding', 'served'].includes(t));
    expect(kinds.slice(0, 5)).toEqual(['walk', 'pour', 'holding', 'walk', 'served']);
    const end = api.snapshot();
    expect(end.player.materials).toEqual(ledgerMaterials(end));
  });

  it('an empty tap: "the order stays open": serving is refused with a tap_empty event and nothing is queued', async () => {
    const { api, events, tavern, stand, firstOrder } = await openTavern();
    const guest = await firstOrder();
    expect(await api.unloadTap(stand().uid, 0, 'all')).toBe(true);
    expect((await api.getPlayer()).materials.root_ale).toBe(7);
    expect(await api.serveGuest(guest.id)).toBe(false);
    expect(events.find((x) => x.e.t === 'tap_empty')?.e).toMatchObject({ guestId: guest.id, item: 'root_ale' });
    expect((await tavern()).serveQueue).toEqual([]);
    expect((await tavern()).guests.find((g) => g.id === guest.id)?.phase).toBe('order'); // still open
    // Load a mug again and the same order is served.
    expect(await api.loadTap(stand().uid, 0, 'root_ale', 1)).toBe(true);
    expect(await api.serveGuest(guest.id)).toBe(true);
  });

  it('the tap runs empty while the avatar is on the way: it arrives, finds no mug, the order stays open', async () => {
    const { api, events, until, tavern, stand, firstOrder, mugs } = await openTavern();
    const guest = await firstOrder();
    expect(await api.serveGuest(guest.id)).toBe(true);
    expect(await api.unloadTap(stand().uid, 0, 'all')).toBe(true); // right after the tap on the guest
    expect(await until(() => events.some((x) => x.e.t === 'tap_empty'))).toBe(true);
    await until(() => false, 600);
    expect(events.some((x) => x.e.t === 'holding' && x.e.item === 'root_ale')).toBe(false);
    expect(await mugs()).toBe(0);
    expect((await tavern()).guests.find((g) => g.id === guest.id)?.phase).toBe('order');
    expect((await tavern()).holding).toBeNull();
    expect((await tavern()).serveQueue).toEqual([]);
  });

  it('a tap on the floor while pouring ends the errand: no mug is taken, the order stays open', async () => {
    const { api, events, until, tavern, firstOrder, mugs } = await openTavern();
    const guest = await firstOrder();
    await api.serveGuest(guest.id);
    expect(await until(() => events.some((x) => x.e.t === 'pour'))).toBe(true);
    await api.walk({ x: 300, y: 300 });
    await until(() => false, 1500);
    expect(await mugs()).toBe(7);
    expect((await tavern()).holding).toBeNull();
    expect((await tavern()).guests.find((g) => g.id === guest.id)?.phase).toBe('order');
  });

  it('load and unload: the bag and the tap move together, one drink per tap, 12 mugs at most; only in the tavern', async () => {
    const { api, stand, tavern } = await openTavern(7, storageWith({ carrot_cider: 20, root_ale: 10 }));
    const uid = stand().uid;
    expect(await api.loadTap(uid, 1, 'carrot_cider', TAP_CAP)).toBe(true);
    expect(await api.loadTap(uid, 1, 'carrot_cider', 1)).toBe(false); // full
    expect(await api.loadTap(uid, 1, 'root_ale', 1)).toBe(false); // another drink on that tap
    expect(await api.loadTap(uid, 0, 'root_ale', 6)).toBe(false); // 7 + 6 > 12
    expect(await api.loadTap(uid, 0, 'root_ale', 5)).toBe(true);
    expect((await api.getPlayer()).materials.carrot_cider).toBe(8);
    expect((await api.getPlayer()).materials.root_ale).toBe(5);
    expect((await tavern()).taps).toEqual([
      { standUid: uid, slot: 0, drink: 'root_ale', mugs: 12 },
      { standUid: uid, slot: 1, drink: 'carrot_cider', mugs: 12 },
    ]);
    expect(await api.unloadTap(uid, 1, 5)).toBe(true);
    expect((await api.getPlayer()).materials.carrot_cider).toBe(13);
    expect(await api.unloadTap(uid, 1, 99)).toBe(false);
    const end = api.snapshot();
    expect(ledgerMaterials(end)).toEqual(end.player.materials);
    // In another room nothing moves.
    await api.enterRoom((await api.getPlayer()).hotelRoomId);
    expect(await api.unloadTap(uid, 0, 'all')).toBe(false);
    expect(await api.loadTap(uid, 1, 'carrot_cider', 1)).toBe(false);
  });

  it('the Menu panel lists a drink only while it is on a tap; its stock is the mugs on the taps', async () => {
    const { api, stand } = await openTavern(7, storageWith({ carrot_cider: 4 }));
    expect((await api.getMenu()).map((r) => r.id)).not.toContain('carrot_cider');
    expect((await api.getMenu()).find((r) => r.id === 'root_ale')).toMatchObject({ stock: 7, on: true });
    expect(await api.loadTap(stand().uid, 1, 'carrot_cider', 4)).toBe(true);
    expect((await api.getMenu()).find((r) => r.id === 'carrot_cider')).toMatchObject({ stock: 4, on: true });
    expect(await api.unloadTap(stand().uid, 1, 'all')).toBe(true);
    expect((await api.getMenu()).map((r) => r.id)).not.toContain('carrot_cider');
  });

  it('taps and their mugs survive a save and a reload', async () => {
    const storage = storageWith({ carrot_cider: 3 });
    const a = await openTavern(7, storage);
    await a.api.loadTap(a.stand().uid, 1, 'carrot_cider', 3);
    await a.api.unloadTap(a.stand().uid, 0, 2);
    const b = await openTavern(7, storage, a.now());
    expect((await b.tavern()).taps).toEqual([
      { standUid: b.stand().uid, slot: 0, drink: 'root_ale', mugs: 5 },
      { standUid: b.stand().uid, slot: 1, drink: 'carrot_cider', mugs: 3 },
    ]);
  });
});
