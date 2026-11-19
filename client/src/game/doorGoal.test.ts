import { describe, expect, it } from 'vitest';
import { createNewPlayer, innDoorSpots } from '@pixel-hotel/shared';
import { doorGoalAt, doorWalkGoal, walkDoorGoal } from './doorGoal.ts';

describe('doorGoalAt', () => {
  const player = createNewPlayer(undefined, 1_000_000);
  const hotel = player.rooms.find((r) => r.kind === 'hotel')!;
  const door = innDoorSpots(hotel)[0]!;
  it('a goal on the spot gives the door id, a goal beside it or null gives null', () => {
    expect(doorGoalAt(hotel, { x: door.spot.x + 8, y: door.spot.y + 8 })).toBe(door.id);
    expect(doorGoalAt(hotel, { x: door.spot.x + door.spot.w + 40, y: door.spot.y + 8 })).toBeNull();
    expect(doorGoalAt(hotel, { x: door.spot.x + 8, y: door.spot.y + 72 })).toBeNull();
    expect(doorGoalAt(hotel, { x: door.spot.x + 8, y: door.spot.y + 40 })).toBe(door.id); // one cell in front (owner: too small)
    expect(doorGoalAt(hotel, { x: door.spot.x + 8, y: door.spot.y - 30 })).toBe(door.id); // the door picture in the wall band (the owner bug)
    expect(doorGoalAt(hotel, null)).toBeNull();
  });
});

describe('walkDoorGoal (hold to walk)', () => {
  const hotel = createNewPlayer(undefined, 1_000_000).rooms.find((r) => r.kind === 'hotel')!;
  const door = innDoorSpots(hotel)[0]!;
  const on = { x: door.spot.x + 8, y: door.spot.y + 8 };
  const beside = { x: door.spot.x + door.spot.w + 40, y: door.spot.y + 8 };
  it('only an accepted, still-current walk that ends on the spot opens the door', () => {
    expect(walkDoorGoal(hotel, on, true, true)).toBe(door.id);
    expect(walkDoorGoal(hotel, on, false, true)).toBeNull(); // refused (nothing reachable)
    expect(walkDoorGoal(hotel, on, true, false)).toBeNull(); // the pointer moved on to another cell
    expect(walkDoorGoal(hotel, beside, true, true)).toBeNull(); // sliding past the doorway: no trip
  });
});

describe('doorWalkGoal (owner bug 19 Nov: a tap on the door picture did nothing)', () => {
  const hotel = createNewPlayer(undefined, 1_000_000).rooms.find((r) => r.kind === 'hotel')!;
  const door = innDoorSpots(hotel)[0]!;
  it('a tap on the arch walks to the spot and the walk counts as the door; a tap elsewhere is kept', () => {
    const art = { x: door.spot.x + 40, y: door.spot.y - 30 };
    const to = doorWalkGoal(hotel, art);
    expect(to).toEqual({ x: door.spot.x + 48, y: door.spot.y + 16 });
    expect(walkDoorGoal(hotel, to, true, true)).toBe(door.id);
    const floor = { x: door.spot.x + 8, y: door.spot.y + 100 };
    expect(doorWalkGoal(hotel, floor)).toBe(floor);
  });
});
