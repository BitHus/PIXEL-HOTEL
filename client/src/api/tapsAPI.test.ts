// Step T1: the taps through the GameAPI: load, unload, the menu, the pour step of the serve chain, an empty tap.

import { describe, expect, it } from 'vitest';
import { POUR_MS, TAP_CAP, type Rng, type TavernClientEvent } from '@pixel-hotel/shared';
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

async function openTavern(seed = 7) {
  let now = 1_000_000;
  const { api } = LocalGameAPI.open(memoryStorage(), () => now, seeded(seed));
  const p = await api.getPlayer();
  await api.enterRoom(p.shopRoomId);
  const events: TavernClientEvent[] = [];
  api.onTavern((e) => events.push(e));
  const until = async (done: () => Promise<boolean>, maxMs = 400_000): Promise<boolean> => {
    for (let ms = 0; ms < maxMs; ms += 100) {
      if (await done()) return true;
      now += 100;
      api.update();
    }
    return false;
  };
  const stand = api.snapshot().items.find((i) => i.typeId === 'tap_stand')!;
  return { api, events, until, now: () => now, stand };
}

describe('taps through the GameAPI (step T1)', () => {
  it('a new game: 7 root ale on tap 0; unload gives them to the bag, load puts them back; the menu follows the tap', async () => {
    const { api, stand } = await openTavern();
    expect((await api.getTaps())[0]).toMatchObject({ standUid: stand.uid, slot: 0, drink: 'root_ale', mugs: 7, cap: TAP_CAP });
    expect((await api.getMenu()).find((r) => r.id === 'root_ale')).toMatchObject({ stock: 7, onTap: 7, inBag: 0 });
    const t1 = await api.unloadTap(stand.uid, 0);
    expect(t1?.[0]).toMatchObject({ drink: null, mugs: 0 });
    expect((await api.getPlayer()).materials.root_ale).toBe(7);
    expect((await api.getMenu()).find((r) => r.id === 'root_ale')).toMatchObject({ stock: 0, onTap: 0, inBag: 7 });
    expect(await api.loadTap(stand.uid, 1, 'root_ale', 99)).toBeNull(); // more than the bag has
    const t2 = await api.loadTap(stand.uid, 1, 'root_ale', 5);
    expect(t2?.[1]).toMatchObject({ drink: 'root_ale', mugs: 5 });
    expect((await api.getPlayer()).materials.root_ale).toBe(2);
    expect((await api.getTavern()).taps).toHaveLength(2);
  });

  it('the serve chain pours first: a pour event, the avatar waits POUR_MS at the bar, the tap goes down by one', async () => {
    const { api, events, until, now } = await openTavern();
    await until(async () => (await api.getTavern()).guests.some((g) => g.phase === 'order'));
    const guest = (await api.getTavern()).guests.find((g) => g.phase === 'order')!;
    const before = (await api.getTaps())[0]!.mugs;
    expect(await api.serveGuest(guest.id)).toBe(true);
    await until(async () => events.some((e) => e.t === 'pour'));
    const pourAt = now();
    const pour = events.find((e) => e.t === 'pour');
    expect(pour).toMatchObject({ item: 'root_ale', slot: 0, ms: POUR_MS });
    // While pouring nothing is held yet and the tap still has its mug.
    expect(events.some((e) => e.t === 'holding' && e.item === 'root_ale')).toBe(false);
    expect((await api.getTaps())[0]!.mugs).toBe(before);
    await until(async () => events.some((e) => e.t === 'holding' && e.item === 'root_ale'));
    expect(now() - pourAt).toBeGreaterThanOrEqual(POUR_MS - 100);
    expect((await api.getTaps())[0]!.mugs).toBe(before - 1);
    expect(await until(async () => events.some((e) => e.t === 'served' && e.guestId === guest.id))).toBe(true);
  });

  it('an empty tap: the order stays open, the player is told, nothing is held', async () => {
    const { api, events, until, stand } = await openTavern();
    await until(async () => (await api.getTavern()).guests.some((g) => g.phase === 'order'));
    const guest = (await api.getTavern()).guests.find((g) => g.phase === 'order')!;
    await api.unloadTap(stand.uid, 0); // the tap runs dry after the order was taken
    expect(await api.serveGuest(guest.id)).toBe(true);
    expect(await until(async () => events.some((e) => e.t === 'tap_empty' && e.guestId === guest.id), 30_000)).toBe(true);
    expect(events.some((e) => e.t === 'pour')).toBe(false);
    const t = await api.getTavern();
    expect(t.holding).toBeNull();
    expect(t.serveQueue).toEqual([]);
    expect(t.guests.find((g) => g.id === guest.id)?.phase).toBe('order'); // still waiting for the drink
    // Loading the tap and tapping the guest again serves it.
    await api.loadTap(stand.uid, 0, 'root_ale', 7);
    expect(await api.serveGuest(guest.id)).toBe(true);
    expect(await until(async () => events.some((e) => e.t === 'served' && e.guestId === guest.id))).toBe(true);
  });
});
