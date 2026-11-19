// TF-5: bar guests through the GameAPI: serve = pour (hold) then a hand-over on the staff side of the bar; grabAll; serveAll.

import { describe, expect, it } from 'vitest';
import {
  POUR_FULL_MS,
  barSpots,
  buildNavGrid,
  createNewPlayer,
  guestLook,
  guestZones,
  itemBlockers,
  npcGrid,
  saveKey,
  toSaveText,
  type Guest,
  type GameState,
  type Rng,
  type TavernClientEvent,
} from '@pixel-hotel/shared';
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

/** A new game whose tavern has two bar guests with open orders for root ale (their spots are real). */
function withBarGuests(): GameState {
  const s = createNewPlayer(undefined, 1_000_000);
  const room = s.rooms.find((r) => r.id === s.tavern.roomId)!;
  const grid = npcGrid(buildNavGrid(room, itemBlockers(s.items, room.id)), guestZones(s.items, room));
  const spots = barSpots(s.items, room, grid);
  const mk = (id: number, k: number): Guest => ({
    id, kind: 'chatty', look: guestLook(-id), x: spots[k]!.x, y: spots[k]!.y, facing: spots[k]!.facing, path: [], speed: 72, phase: 'order', groupId: id, seat: null, seated: false,
    tolerance: 1, waitMs: 0, order: { item: 'root_ale', price: 9, coins: 9 }, patienceMs: 50_000, warned: false, talkInMs: 99_000, sipInMs: 0, reaction: null,
    kind2: 'bar', barSpot: { barUid: spots[k]!.barUid, c: spots[k]!.cell.c, r: spots[k]!.cell.r },
  });
  return { ...s, playerCreated: true, tavern: { ...s.tavern, guests: [mk(-1, 0), mk(-2, 1)], nextGuestInMs: 10_000_000 } };
}

async function open() {
  const storage = memoryStorage();
  storage.set(saveKey(), toSaveText(withBarGuests(), 1_000_000));
  let now = 1_000_000;
  const { api } = LocalGameAPI.open(storage, () => now, seeded(3));
  const p = await api.getPlayer();
  await api.enterRoom(p.shopRoomId);
  const events: TavernClientEvent[] = [];
  api.onTavern((e) => events.push(e));
  const until = async (done: () => boolean, maxMs = 120_000): Promise<boolean> => {
    for (let ms = 0; ms < maxMs; ms += 100) {
      if (done()) return true;
      now += 100;
      api.update();
    }
    return false;
  };
  return { api, events, until };
}

describe('bar guests through the GameAPI (TF-5)', () => {
  it('a bar guest stays after loading; serve = walk to the taps, hold the pour, then the hand-over on the bar', async () => {
    const { api, events, until } = await open();
    const t0 = await api.getTavern();
    expect(t0.guests.filter((g) => g.kind2 === 'bar')).toHaveLength(2);
    expect(await api.serveGuest(-1)).toBe(true);
    expect(await until(() => events.some((e) => e.t === 'pour_ready'))).toBe(true);
    expect(await api.pourHeld(POUR_FULL_MS)).toBe(true);
    expect((await api.getTavern()).tray).toHaveLength(1);
    // Hand over to the bar guest: the avatar walks to the staff side of the bar first.
    expect(await api.handOver(-1)).toBe(true);
    expect(await until(() => events.some((e) => e.t === 'served' && e.guestId === -1))).toBe(true);
    const t = await api.getTavern();
    expect(t.tray).toHaveLength(0);
    expect(t.guests.find((g) => g.id === -1)!.phase).toBe('bar_drink');
    // A table-style carry is refused for a guest without a matching mug.
    expect(await api.handOver(-2)).toBe(false);
  });

  it('grabAll queues the pours of the most urgent item, serveAll hands over to every guest the tray can serve', async () => {
    const { api, events, until } = await open();
    expect(await api.grabAll()).toBe(true);
    const queued = (await api.getTavern()).serveQueue;
    expect(queued.length).toBeGreaterThanOrEqual(1);
    // Pour twice (the avatar waits at the taps for each hold).
    for (let k = 0; k < 2; k++) {
      expect(await until(() => events.filter((e) => e.t === 'pour_ready').length > k)).toBe(true);
      expect(await api.pourHeld(POUR_FULL_MS)).toBe(true);
    }
    expect((await api.getTavern()).tray).toHaveLength(2);
    expect(await api.serveAll()).toBe(true);
    expect(await until(() => events.filter((e) => e.t === 'served').length >= 2)).toBe(true);
    const guests = (await api.getTavern()).guests;
    expect(guests.filter((g) => g.phase === 'bar_drink')).toHaveLength(2);
    expect(await api.serveAll()).toBe(false); // empty tray
  });
});
