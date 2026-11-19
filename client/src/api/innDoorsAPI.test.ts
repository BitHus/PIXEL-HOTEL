// Inn doors through the GameAPI (step MB-2): useDoor moves the avatar and the room, refuses during a run and at a wrong door.

import { describe, expect, it } from 'vitest';
import { createNewPlayer, innDoorSpots, saveKey, toSaveText } from '@pixel-hotel/shared';
import { testRun } from '../../../shared/src/dungeon/testRun.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const T0 = 1_000_000;

function open(withRun = false) {
  const storage = memoryStorage();
  const base = { ...createNewPlayer(undefined, T0), playerCreated: true };
  storage.set(saveKey(), toSaveText(withRun ? { ...base, run: testRun() } : base, T0));
  return LocalGameAPI.open(storage, () => T0, () => 0.5).api;
}

describe('useDoor', () => {
  it('walks suite -> tavern -> garden and back: the room changes and the avatar arrives on the matching spot', async () => {
    const api = open();
    const p = await api.getPlayer();
    await api.enterRoom(p.hotelRoomId);
    const inTavern = await api.useDoor('suite_to_tavern');
    expect(inTavern?.room.id).toBe(p.shopRoomId);
    expect(await api.currentRoomId()).toBe(p.shopRoomId);
    const spot = innDoorSpots(inTavern!.room).find((d) => d.id === 'tavern_to_suite')!;
    const me = inTavern!.avatars[0]!;
    expect(me.roomId).toBe(p.shopRoomId);
    expect(me.x).toBe(spot.spot.x + 16);
    expect(me.y).toBe(spot.spot.y + 48); // one cell in front of the spot (owner 19 Nov: never inside the arch)
    expect(me.facing).toBe('down');
    const inGarden = await api.useDoor('tavern_to_garden');
    expect(inGarden?.room.id).toBe(p.farmRoomId);
    expect((await api.useDoor('garden_to_tavern'))?.room.id).toBe(p.shopRoomId);
    expect((await api.useDoor('tavern_to_suite'))?.room.id).toBe(p.hotelRoomId);
  });

  it('refuses a door that is not in this room', async () => {
    const api = open();
    const p = await api.getPlayer();
    await api.enterRoom(p.hotelRoomId);
    expect(await api.useDoor('tavern_to_garden')).toBeNull();
    expect(await api.currentRoomId()).toBe(p.hotelRoomId);
  });

  it('refuses during a dungeon run and keeps the room', async () => {
    const api = open(true);
    const p = await api.getPlayer();
    await api.enterRoom(p.hotelRoomId);
    expect(await api.useDoor('suite_to_tavern')).toBeNull();
    expect(await api.currentRoomId()).toBe(p.hotelRoomId);
  });
});

describe('the tavern clock across a door trip', () => {
  it('guests arrive while the player is in the suite and keep going after a door trip; the avatar stands on the arrival cell', async () => {
    let now = T0;
    const storage = memoryStorage();
    storage.set(saveKey(), toSaveText({ ...createNewPlayer(undefined, T0), playerCreated: true }, T0));
    const { api } = LocalGameAPI.open(storage, () => now, () => 0.5);
    const p = await api.getPlayer();
    await api.enterRoom(p.hotelRoomId);
    const run = (ms: number) => { for (let t = 0; t < ms; t += 100) { now += 100; api.update(); } };
    run(60_000); // still in the suite: the clock runs, a guest has come
    expect((await api.getTavern()).guests.length).toBeGreaterThan(0);
    const inTavern = await api.useDoor('suite_to_tavern');
    expect(inTavern?.room.id).toBe(p.shopRoomId);
    const spot = innDoorSpots(inTavern!.room).find((d) => d.id === 'tavern_to_suite')!;
    expect(inTavern!.avatars[0]!.x).toBe(spot.spot.x + 16);
    expect(inTavern!.avatars[0]!.y).toBe(spot.spot.y + 48);
    // The door trip does not reset the shop: guests walk on and place an order within the next minute.
    run(60_000);
    expect((await api.getTavern()).guests.some((g) => g.phase === 'order' || g.phase === 'eat')).toBe(true);
    expect((await api.getTavern()).at).toBe(now);
  });
});
