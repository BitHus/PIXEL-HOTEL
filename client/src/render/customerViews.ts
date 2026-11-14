// The shop's NPC customers on screen (step 7): placeholder avatars in their own colours. The
// GameAPI sends the customer list (with each one's path) whenever it changes; this animates the
// paths locally with walkAvatar, like the own avatar, and keeps them in the depth-sorted list.

import { CUSTOMER_WALK_SPEED, customerAvatar, walkAvatar, type Avatar, type Customer, type Point } from '@pixel-hotel/shared';
import { AvatarSprite } from './avatarSprite.ts';
import { avatarDepthKey } from './depthOrder.ts';
import { idleShift } from './atmosphere.ts';
import type { RoomView } from './roomView.ts';

interface Shown {
  avatar: Avatar;
  path: Point[];
  /** The customer's own walk speed, px per second. */
  speed: number;
  sprite: AvatarSprite;
}

export class CustomerViews {
  private readonly shown = new Map<number, Shown>();

  constructor(private readonly view: RoomView) {}

  /** Shows these customers (an empty list or another room: none). */
  sync(customers: readonly Customer[], roomId: number): void {
    const ids = new Set(customers.map((c) => c.id));
    for (const [id, s] of this.shown) if (!ids.has(id)) this.drop(id, s);
    for (const c of customers) {
      const a = customerAvatar(c, roomId);
      const s = this.shown.get(c.id);
      if (!s) {
        const sprite = new AvatarSprite(c.look, false);
        sprite.container.eventMode = 'none';
        this.view.objects.add(sprite.container, avatarDepthKey(a));
        this.shown.set(c.id, { avatar: a, path: [...c.path], speed: c.speed ?? CUSTOMER_WALK_SPEED, sprite });
        continue;
      }
      // Keep the shown position unless it is clearly off (tiny timing differences are walked off).
      const off = Math.hypot(s.avatar.x - a.x, s.avatar.y - a.y) > 8;
      s.avatar = off ? a : { ...s.avatar, facing: c.path.length > 0 ? s.avatar.facing : a.facing };
      s.path = [...c.path];
    }
  }

  clear(): void {
    for (const [id, s] of this.shown) this.drop(id, s);
  }

  update(dtMs: number, timeMs: number): void {
    for (const [id, s] of this.shown) {
      const r = walkAvatar(s.avatar, s.path, dtMs, s.speed);
      s.avatar = r.avatar;
      s.path = r.path;
      s.sprite.update(s.avatar, timeMs);
      // Standing customers shift a little now and then (atmosphere step).
      s.sprite.setShift(s.path.length === 0 ? idleShift(id, timeMs) : 0);
      this.view.objects.setKey(s.sprite.container, avatarDepthKey(s.avatar));
    }
  }

  /** Adds every customer's feet (for the shadows). */
  feet(out: Point[]): void {
    for (const s of this.shown.values()) out.push(s.avatar);
  }

  /** World points above each customer's head (speech bubbles). */
  heads(out: Map<number, Point>, headPx: number): void {
    for (const [id, s] of this.shown) out.set(id, { x: s.avatar.x, y: s.avatar.y - headPx });
  }

  private drop(id: number, s: Shown): void {
    this.view.objects.remove(s.sprite.container);
    s.sprite.container.destroy({ children: true });
    this.shown.delete(id);
  }
}
