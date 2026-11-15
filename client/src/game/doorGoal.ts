// Inn doors (step MB-3): is a walk GOAL on a door spot? Pure; a path that only crosses a spot never counts.

import { cellOf, doorAt, type Point, type Room } from '@pixel-hotel/shared';

/** The id of the Inn door whose spot contains the goal point, or null. */
export function doorGoalAt(room: Pick<Room, 'kind' | 'shape' | 'level'>, goal: Point | null): string | null {
  return goal ? (doorAt(room, cellOf(goal))?.id ?? null) : null;
}

/**
 * The door a finished walk request leads to: only when the walk was accepted and is still the current one
 * (hold-to-walk re-paths when the pointer changes cell, so an older answer must not trigger a door).
 */
export function walkDoorGoal(room: Pick<Room, 'kind' | 'shape' | 'level'>, goal: Point, accepted: boolean, stillCurrent: boolean): string | null {
  return accepted && stillCurrent ? doorGoalAt(room, goal) : null;
}
