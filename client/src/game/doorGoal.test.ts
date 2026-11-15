import { describe, expect, it } from 'vitest';
import { createNewPlayer, innDoorSpots } from '@pixel-hotel/shared';
import { doorGoalAt } from './doorGoal.ts';

describe('doorGoalAt', () => {
  const player = createNewPlayer(undefined, 1_000_000);
  const hotel = player.rooms.find((r) => r.kind === 'hotel')!;
  const door = innDoorSpots(hotel)[0]!;
  it('a goal on the spot gives the door id, a goal beside it or null gives null', () => {
    expect(doorGoalAt(hotel, { x: door.spot.x + 8, y: door.spot.y + 8 })).toBe(door.id);
    expect(doorGoalAt(hotel, { x: door.spot.x + door.spot.w + 8, y: door.spot.y + 8 })).toBeNull();
    expect(doorGoalAt(hotel, { x: door.spot.x + 8, y: door.spot.y + 40 })).toBeNull();
    expect(doorGoalAt(hotel, null)).toBeNull();
  });
});
