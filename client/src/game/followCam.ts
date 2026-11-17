// CAM-LOCK (hybrid): the camera is LOCKED on the avatar only while it moves (tap-walk, hold-walk, steer); standing still the player may pan to look around.
import type { Avatar } from '@pixel-hotel/shared';

/** True while the avatar walks (a path to follow, or the walk pose). */
export function avatarMoving(avatar: Pick<Avatar, 'state'>, pathLength: number): boolean {
  return pathLength > 0 || avatar.state === 'walk';
}
