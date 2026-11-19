// Owner bug 19 Nov 'all doors do nothing': walk onto EVERY Inn door of every room kind (hotel, tavern, garden, cellar), the way the client does it:
// api.walk(goal on the spot) must reach the spot itself, doorGoalAt must name the door, and api.useDoor must travel. New games of every hotel shape and
// old saves (version 41, every tavern shape) migrated to the current version.

import { describe, expect, it } from 'vitest';
import { DEFAULT_NEW_PLAYER, cellOf, createNewPlayer, doorAt, doorTapAt, innDoorSpots, saveKey, shapesFor, toSaveText, type GameState, type RoomKind } from '@pixel-hotel/shared';
import { save41Start, withItem } from '../../../shared/src/tavernTest.ts';
import { doorGoalAt, doorWalkGoal, walkDoorGoal } from '../game/doorGoal.ts';
import { LocalGameAPI } from './localGameAPI.ts';
import { memoryStorage } from './saveStorage.ts';

const T0 = 1_000_000;

function rich(s: GameState): GameState {
  return { ...s, playerCreated: true, player: { ...s.player, level: 2, wallet: { ...s.player.wallet, gold: 5000 } } };
}

function openText(text: string) {
  const storage = memoryStorage();
  storage.set(saveKey(), text);
  return LocalGameAPI.open(storage, () => T0, () => 0.5).api;
}

type Api = ReturnType<typeof openText>;

/** Walks onto every door of every room and through it; returns the trips that failed. */
async function walkAllDoors(api: Api): Promise<string[]> {
  const p = await api.getPlayer();
  await api.enterRoom(p.shopRoomId);
  expect(await api.buildCellar()).not.toBeNull();
  const p2 = await api.getPlayer();
  const ids: Partial<Record<RoomKind, number>> = { hotel: p2.hotelRoomId, shop: p2.shopRoomId, farm: p2.farmRoomId, cellar: p2.cellarRoomId };
  const bad: string[] = [];
  for (const [kind, id] of Object.entries(ids)) {
    if (id === undefined) continue;
    const doors = innDoorSpots((await api.enterRoom(id)).room);
    expect(doors.length, `${kind} has doors`).toBeGreaterThan(0);
    for (const d of doors) {
      // Three ways a player aims at a door: the spot, the door picture in the wall band, the wall one cell beside it (owner: 'almost walk against the wall').
      const aims = [
        { x: d.spot.x + 16, y: d.spot.y + 16 },
        { x: d.doorway.x + d.doorway.w / 2, y: d.doorway.y + 20 },
      ];
      // The wall one cell beside it, on the side with no other door close by (two doors one cell apart share that cell: the nearer one wins).
      const left = { x: d.doorway.x - 20, y: d.spot.y - 8 };
      const right = { x: d.doorway.x + d.doorway.w + 20, y: d.spot.y - 8 };
      const lonely = (p: { x: number }) => doors.every((o) => o.id === d.id || Math.abs(o.spot.x + o.spot.w / 2 - p.x) > 96);
      if (lonely(left)) aims.push(left);
      else if (lonely(right)) aims.push(right);
      for (const aim of aims) {
        const rs = await api.enterRoom(id);
        const tag = `${kind} ${d.id} aim ${aim.x},${aim.y}`;
        if (doorGoalAt(rs.room, aim) !== d.id) bad.push(`${tag}: doorGoalAt`);
        const goal = doorWalkGoal(rs.room, aim);
        if (walkDoorGoal(rs.room, goal, true, true) !== d.id) bad.push(`${tag}: the walk goal is no door`);
        const path = await api.walk(goal);
        const end = path?.[path.length - 1];
        if (!end) bad.push(`${tag}: no path from ${rs.avatars[0]?.x},${rs.avatars[0]?.y}`);
        else if (doorAt(rs.room, cellOf(end))?.id !== d.id) bad.push(`${tag}: the walk ends at ${end.x},${end.y}, not on the spot`);
      }
      const trip = await api.useDoor(d.id);
      if (!trip) {
        bad.push(`${kind} ${d.id}: useDoor refused`);
        continue;
      }
      // Arrival (owner 'I glitched in the door'): in front of the matching door, never on its spot under the arch, and free to walk on.
      const me = trip.avatars[0]!;
      const at = `${kind} ${d.id} -> ${trip.room.kind} at ${me.x},${me.y}`;
      if (doorAt(trip.room, cellOf(me)) !== null) bad.push(`${at}: arrived on a door spot`);
      if (doorTapAt(trip.room, me) === null) bad.push(`${at}: arrived away from the door`);
      if (me.state !== 'idle') bad.push(`${at}: arrived walking`);
      if (!(await api.walk({ x: me.x, y: me.y + 64 }))) bad.push(`${at}: cannot step away from the arrival`);
    }
  }
  return bad;
}

describe('every door of every room can be walked onto and used', () => {
  for (const shape of shapesFor('hotel').map((s) => s.id)) {
    it(`new game, hotel ${shape}`, async () => {
      const s = rich(createNewPlayer({ ...DEFAULT_NEW_PLAYER, hotelShape: shape }, T0));
      expect(await walkAllDoors(openText(toSaveText(s, T0)))).toEqual([]);
    });
  }
  for (const shape of shapesFor('shop').map((s) => s.id)) {
    it(`old save 41 migrated, tavern ${shape}`, async () => {
      const s = rich(save41Start(shape, T0));
      expect(await walkAllDoors(openText(JSON.stringify({ version: 41, savedAt: T0, state: s })))).toEqual([]);
    });
  }
});

describe('door arrival never glitches into the door (owner 19 Nov)', () => {
  it('a crate on the cell in front of the arrival spot: the avatar stands on the nearest free cell, not on the spot or in the crate', async () => {
    const base = rich(createNewPlayer(undefined, T0));
    const shop = base.rooms.find((r) => r.kind === 'shop')!;
    const d = innDoorSpots(shop).find((x) => x.id === 'tavern_to_suite')!;
    const s = withItem(base, 900, 'crate', d.col * 32 + 16, (d.row + 2) * 32); // a crate on the cell in front of the spot
    const api = openText(toSaveText(s, T0));
    const p = await api.getPlayer();
    await api.enterRoom(p.hotelRoomId);
    const trip = await api.useDoor('suite_to_tavern');
    const me = trip!.avatars[0]!;
    expect(cellOf(me)).not.toEqual({ c: d.col, r: d.row + 1 });
    expect(doorAt(trip!.room, cellOf(me))).toBeNull();
    expect(await api.walk({ x: me.x + 32, y: me.y + 64 })).not.toBeNull();
  });
});
