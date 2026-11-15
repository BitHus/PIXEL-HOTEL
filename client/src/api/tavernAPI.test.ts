// The tavern through the GameAPI (step 9t part B): a guest comes, orders, the avatar fetches the
// order at the bar and puts it on the table, the guest pays, the player takes the coins.

import { describe, expect, it } from 'vitest';
import { SERVE_QUEUE_MAX, type Rng, type TavernClientEvent } from '@pixel-hotel/shared';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

/** A small seeded generator (mulberry32), so a run is the same every time. */
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
  /** Runs the clock in 100 ms steps until `done` (at most `maxMs`). */
  const until = async (done: () => Promise<boolean>, maxMs = 400_000): Promise<boolean> => {
    for (let ms = 0; ms < maxMs; ms += 100) {
      if (await done()) return true;
      now += 100;
      api.update();
    }
    return false;
  };
  return { api, events, until, now: () => now, player: p };
}

describe('the tavern through the GameAPI', () => {
  it('a new game (step T1): 7 root ale stand loaded on the first tap, the barrel is idle, then guests order', async () => {
    const { api, until } = await openTavern();
    const barrel = (await api.snapshot().items).find((i) => i.typeId === 'brewing_barrel')!;
    expect(await api.collectBrew(barrel.uid)).toBeNull(); // nothing is brewing: the first drink is on the tap
    expect(await until(async () => (await api.getTavern()).guests.some((g) => g.phase === 'order'))).toBe(true);
  });

  it('serves an order from one tap, the guest pays, the player takes the coins by tapping', async () => {
    const { api, events, until } = await openTavern();
    const gold0 = (await api.getPlayer()).wallet.gold;
    await until(async () => (await api.getTavern()).guests.some((g) => g.phase === 'order'));
    const guest = (await api.getTavern()).guests.find((g) => g.phase === 'order')!;
    expect(await api.serveGuest(guest.id)).toBe(true);
    expect(events.some((e) => e.t === 'walk')).toBe(true);
    // The avatar goes to the bar, holds the mug, walks to the table and puts it down.
    expect(await until(async () => events.some((e) => e.t === 'served' && e.guestId === guest.id))).toBe(true);
    expect(events.filter((e) => e.t === 'holding').map((e) => (e.t === 'holding' ? e.item : 'x'))).toEqual(['root_ale', null]);
    expect((await api.getTavern()).guests.find((g) => g.id === guest.id)?.phase).toBe('eat');
    // Nothing is collected by itself: the coins wait on the table until the player taps them.
    expect(await until(async () => (await api.getTavern()).mess.length > 0)).toBe(true);
    expect((await api.getPlayer()).wallet.gold).toBe(gold0);
    const mess = (await api.getTavern()).mess[0]!;
    expect(await api.tidyTable(mess.id, 'coins')).toBe(true);
    expect(await until(async () => events.some((e) => e.t === 'collected'))).toBe(true);
    const c = events.find((e) => e.t === 'collected');
    expect(c).toMatchObject({ messId: mess.id, coins: mess.coins, gains: [{ itemId: 'gold', count: mess.coins }] });
    expect((await api.getPlayer()).wallet.gold).toBe(gold0 + mess.coins);
    // The empty mug is still there: its own tap clears it.
    expect(await api.tidyTable(mess.id, 'dish')).toBe(true);
    expect(await until(async () => events.some((e) => e.t === 'cleared'))).toBe(true);
    expect((await api.getTavern()).mess).toEqual([]);
  });

  it('refuses a serve tap for a guest without an order, or from another room', async () => {
    const { api, until, player } = await openTavern();
    expect(await api.serveGuest(-999)).toBe(false);
    await until(async () => (await api.getTavern()).guests.length > 0, 60_000);
    const guest = (await api.getTavern()).guests[0]!;
    await api.enterRoom(player.hotelRoomId);
    expect(await api.serveGuest(guest.id)).toBe(false);
  });

  it('a tap on the floor ends the errand: the queue and the hands are empty again', async () => {
    const { api, events, until } = await openTavern();
    await until(async () => (await api.getTavern()).guests.some((g) => g.phase === 'order'));
    const guest = (await api.getTavern()).guests.find((g) => g.phase === 'order')!;
    await api.serveGuest(guest.id);
    await api.walk({ x: 300, y: 300 });
    await until(async () => false, 300);
    expect((await api.getTavern()).serveQueue).toEqual([]);
    expect(events.some((e) => e.t === 'served')).toBe(false);
    // The order is still open: the guest can be served again.
    expect((await api.getTavern()).guests.find((g) => g.id === guest.id)?.phase).toBe('order');
    expect(await api.serveGuest(guest.id)).toBe(true);
    expect(SERVE_QUEUE_MAX).toBe(3);
  });
});
