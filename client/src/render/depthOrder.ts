// Draw order inside the object layer (brief section 7): sorted by y (the bottom of the
// footprint, or the avatar's feet), then x, then uid. An item on a surface is drawn right after
// the item under it, and so is an avatar sitting on an item (right before it when the seat
// faces up, so the back of the seat hides the avatar).

import type { Avatar, FurnitureItem } from '@pixel-hotel/shared';

export interface DepthKey {
  y: number;
  x: number;
  uid: number;
  /** Order among things tied to the same item (riders, a sitting avatar). Missing = 0, 0, 0. */
  sub?: DepthKey;
}

const ZERO: DepthKey = { y: 0, x: 0, uid: 0 };

export function compareDepth(a: DepthKey, b: DepthKey): number {
  const d = a.y - b.y || a.x - b.x || a.uid - b.uid;
  if (d !== 0 || (!a.sub && !b.sub)) return d;
  return compareDepth(a.sub ?? ZERO, b.sub ?? ZERO);
}

function baseKey(item: FurnitureItem): DepthKey {
  return { y: item.y, x: item.x, uid: item.uid };
}

/** An item's key. `under` is the surface item it stands on, if any. */
export function itemDepthKey(item: FurnitureItem, under?: FurnitureItem): DepthKey {
  if (!under) return baseKey(item);
  return { ...baseKey(under), sub: { y: 1, x: 0, uid: 0, sub: baseKey(item) } };
}

/**
 * An avatar's key. Avatars use negative uids so they never tie with an item. `seat` is the item
 * the avatar sits on, if any.
 */
export function avatarDepthKey(avatar: Avatar, seat?: FurnitureItem): DepthKey {
  if (!seat) return { y: avatar.y, x: avatar.x, uid: -avatar.id };
  return { ...baseKey(seat), sub: { y: seat.facing === 'up' ? -1 : 2, x: 0, uid: -avatar.id } };
}
