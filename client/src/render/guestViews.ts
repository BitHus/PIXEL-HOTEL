// The tavern's guests on screen (step 7, shop life in step 9d, kept by 9t and S1): placeholder avatars in
// their own looks. The GameAPI sends the guest list (with each one's path) whenever it changes; this
// animates the paths locally with walkAvatar, like the own avatar, and keeps them in the
// depth-sorted list. A guest at a table sits (drawn right after the seat, like the own avatar), and
// short gestures (a nod at a sip) play.

import { CUSTOMER_WALK_SPEED, GUEST_RESYNC_PX, getFurnitureType, skipPassed, walkAvatar, type Avatar, type AvatarLook, type Facing, type FurnitureItem, type Point } from '@pixel-hotel/shared';
import { AvatarSprite, type Gesture } from './avatarSprite.ts';
import { avatarDepthKey } from './depthOrder.ts';
import { idleShift } from './atmosphere.ts';
import { seatLiftFor } from './furnitureArt.ts';
import type { RoomView } from './roomView.ts';

interface Shown {
  avatar: Avatar;
  path: Point[];
  /** The customer's own walk speed, px per second. */
  speed: number;
  sprite: AvatarSprite;
  /** The seat they sit on once the walk ends (null = standing). */
  seat: FurnitureItem | null;
  /** The way they look while seated (guests), or null: the seat's way. */
  sitFacing: Facing | null;
  eating: boolean;
}

/**
 * What a shown walker needs: a tavern guest. `seat` is only set while
 * they sit (a guest who still walks to a reserved seat has none yet). `sitFacing`: the way they
 * look once seated (a guest looks at the table); without it they face the way the seat faces.
 */
export interface Walker {
  id: number;
  look: AvatarLook;
  x: number;
  y: number;
  facing: Facing;
  path: readonly Point[];
  speed?: number;
  seat: { uid: number } | null;
  sitFacing?: Facing;
  /** True while the guest eats or drinks (CH1: the eat strips play). */
  eating?: boolean;
}

function walkerAvatar(c: Walker, roomId: number): Avatar {
  const state = c.path.length > 0 ? 'walk' : c.seat ? 'sit' : 'idle';
  return { id: c.id, name: 'Guest', look: c.look, roomId, x: c.x, y: c.y, facing: c.facing, state };
}

export class GuestViews {
  private readonly shown = new Map<number, Shown>();
  private timeMs = 0;
  /** Guests who wait for what is on the tray (COD-1): they glow while a matching mug is held. */
  private pulse: ReadonlySet<number> = new Set();

  constructor(private readonly view: RoomView) {}

  /** Shows these guests (an empty list or another room: none). `items`: the room's items (seats). */
  sync(walkers: readonly Walker[], roomId: number, items: readonly FurnitureItem[] = []): void {
    const ids = new Set(walkers.map((c) => c.id));
    for (const [id, s] of this.shown) if (!ids.has(id)) this.drop(id, s);
    for (const c of walkers) {
      const a = walkerAvatar(c, roomId);
      const seat = c.seat ? (items.find((i) => i.uid === c.seat!.uid) ?? null) : null;
      let s = this.shown.get(c.id);
      if (!s) {
        const sprite = new AvatarSprite(c.look, false);
        sprite.container.eventMode = 'none';
        this.view.objects.add(sprite.container, avatarDepthKey(a));
        s = { avatar: a, path: [...c.path], speed: c.speed ?? CUSTOMER_WALK_SPEED, sprite, seat, sitFacing: c.sitFacing ?? null, eating: c.eating ?? false };
        this.shown.set(c.id, s);
      } else {
        // Keep the shown position unless it is clearly off (tiny timing differences are walked off).
        const off = Math.hypot(s.avatar.x - a.x, s.avatar.y - a.y) > GUEST_RESYNC_PX;
        s.avatar = off ? a : { ...s.avatar, facing: c.path.length > 0 ? s.avatar.facing : a.facing };
        s.path = off ? [...c.path] : skipPassed(s.avatar, c.path);
        s.seat = seat;
        s.sitFacing = c.sitFacing ?? null;
        s.eating = c.eating ?? false;
      }
    }
  }

  /** COD-1: these guests pulse (a warm tint that breathes) until the next call; an empty set stops it. */
  setPulse(ids: ReadonlySet<number>): void {
    this.pulse = ids;
  }

  clear(): void {
    for (const [id, s] of this.shown) this.drop(id, s);
  }

  update(dtMs: number, timeMs: number): void {
    this.timeMs = timeMs;
    for (const [id, s] of this.shown) {
      const r = walkAvatar(s.avatar, s.path, dtMs, s.speed);
      s.avatar = r.avatar;
      s.path = r.path;
      const sitting = s.seat !== null && s.path.length === 0;
      if (sitting) s.avatar = { ...s.avatar, state: 'sit', facing: s.sitFacing ?? s.seat!.facing };
      s.sprite.setEating(sitting && s.eating);
      s.sprite.update(s.avatar, timeMs);
      s.sprite.container.tint = this.pulse.has(id) ? (Math.floor(timeMs / 450) % 2 === 0 ? 0xffffff : 0xffe9a8) : 0xffffff;
      s.sprite.container.tint = this.pulse.has(id) ? (Math.floor(timeMs / 450) % 2 === 0 ? 0xffffff : 0xffe9a8) : 0xffffff;
      s.sprite.setSeatLift(sitting ? seatLiftFor(getFurnitureType(s.seat!.typeId)) : 0);
      // Standing guests shift a little now and then (atmosphere step).
      s.sprite.setShift(s.path.length === 0 && !sitting ? idleShift(id, timeMs) : 0);
      this.view.objects.setKey(s.sprite.container, avatarDepthKey(s.avatar, sitting ? s.seat! : undefined));
    }
  }

  /** Where the shown walkers stand (feet, world px). */
  feetWithIds(): { id: number; x: number; y: number }[] {
    return [...this.shown].map(([id, s]) => ({ id, x: s.avatar.x, y: s.avatar.y }));
  }

  /** The walker standing at a world point (the body box: a bit wider than the feet, as tall as the avatar), the nearest one, or null. */
  at(p: Point): number | null {
    let best: number | null = null;
    let bestD = Infinity;
    for (const [id, s] of this.shown) {
      const a = s.avatar;
      if (Math.abs(p.x - a.x) > 14 || p.y < a.y - 60 || p.y > a.y + 6) continue;
      const d = Math.hypot(p.x - a.x, p.y - (a.y - 24));
      if (d < bestD) {
        bestD = d;
        best = id;
      }
    }
    return best;
  }

  gesture(id: number, kind: Gesture): void {
    this.shown.get(id)?.sprite.gesture(kind, this.timeMs);
  }

  /** Adds every guest's feet (for the shadows). */
  feet(out: Point[]): void {
    for (const s of this.shown.values()) out.push(s.avatar);
  }

  /** World points above each guest's head (speech bubbles). */
  heads(out: Map<number, Point>, headPx: number): void {
    for (const [id, s] of this.shown) out.set(id, { x: s.avatar.x, y: s.avatar.y - headPx });
  }

  private drop(id: number, s: Shown): void {
    this.view.objects.remove(s.sprite.container);
    s.sprite.container.destroy({ children: true });
    this.shown.delete(id);
  }
}
