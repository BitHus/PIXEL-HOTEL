// Inn doors (step MB-3): is a walk GOAL on a door? Pure; a path that only crosses a spot never counts.
// Owner bug 19 Nov ('all doors do nothing', 'too small'): the door's area is its arch in the wall band (where the picture is), the wall and floor one cell
// beside it, its spot and one cell in front (shared doorTapAt); a goal there walks onto the spot (doorWalkPoint) and enters.

import { doorTapAt, doorWalkPoint, type Point, type Room } from '@pixel-hotel/shared';

type DoorRoom = Pick<Room, 'kind' | 'shape' | 'level'>;

/** The id of the Inn door whose area contains the goal point (margin = tap tolerance in world px), or null. */
export function doorGoalAt(room: DoorRoom, goal: Point | null, margin = 0): string | null {
  return goal ? (doorTapAt(room, goal, margin)?.id ?? null) : null;
}

/** The point to walk to for a goal: the door's spot cell when the goal is on a door, else the goal itself. */
export function doorWalkGoal(room: DoorRoom, goal: Point, margin = 0): Point {
  return doorWalkPoint(room, goal, margin);
}

/**
 * The door a finished walk request leads to: only when the walk was accepted and is still the current one
 * (hold-to-walk re-paths when the pointer changes cell, so an older answer must not trigger a door).
 */
export function walkDoorGoal(room: DoorRoom, goal: Point, accepted: boolean, stillCurrent: boolean): string | null {
  return accepted && stillCurrent ? doorGoalAt(room, goal) : null;
}
