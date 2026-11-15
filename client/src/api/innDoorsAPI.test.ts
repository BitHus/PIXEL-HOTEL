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
    expect(me.y).toBe(spot.spot.y + 16);
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
