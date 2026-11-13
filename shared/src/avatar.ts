// Avatars (brief section 8) and walking along a path (section 6). Pure functions, no clock:
// the elapsed time is passed in.

import { HOTEL_WALK_SPEED } from './config.ts';
import type { Facing, Point } from './types.ts';

export interface AvatarLook {
  /** Palette indices (shared/palette.ts). */
  skin: number;
  hair: number;
  hairStyle: number;
  shirt: number;
  legs: number;
  shoes: number;
}

export type AvatarState = 'idle' | 'walk' | 'sit';

export interface Avatar {
  id: number;
  name: string;
  look: AvatarLook;
  roomId: number | null;
  /** The feet, in px. */
  x: number;
  y: number;
  facing: Facing;
  state: AvatarState;
}

/** An avatar and the points it still has to walk to (empty = arrived). */
export interface AvatarWalk {
  avatar: Avatar;
  path: Point[];
}

/** Rounding slack for "reached the point", in px. */
const REACH_EPS = 1e-9;

/** Facing from the dominant axis of a movement. Equal axes count as horizontal. */
export function facingFor(dx: number, dy: number, current: Facing): Facing {
  if (dx === 0 && dy === 0) return current;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

export function pathLength(points: readonly Point[]): number {
  let len = 0;
  for (let i = 1; i < points.length; i++) {
    len += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y);
  }
  return len;
}

/**
 * Moves the avatar along `path` (the points still to reach) for dtMs at `speed` px per second.
 * State is 'walk' while points remain and 'idle' once the last one is reached.
 */
export function walkAvatar(avatar: Avatar, path: readonly Point[], dtMs: number, speed = HOTEL_WALK_SPEED): AvatarWalk {
  let budget = (speed * dtMs) / 1000;
  let { x, y, facing } = avatar;
  let i = 0;
  while (i < path.length) {
    const p = path[i]!;
    const dx = p.x - x;
    const dy = p.y - y;
    const d = Math.hypot(dx, dy);
    facing = facingFor(dx, dy, facing);
    if (d <= budget + REACH_EPS) {
      budget = Math.max(0, budget - d);
      x = p.x;
      y = p.y;
      i++;
      continue;
    }
    x += (dx / d) * budget;
    y += (dy / d) * budget;
    break;
  }
  const rest = path.slice(i);
  return { avatar: { ...avatar, x, y, facing, state: rest.length > 0 ? 'walk' : 'idle' }, path: rest };
}
