// The shop's NPC customers on screen (step 7; shop life in step 9d): placeholder avatars in their
// own looks. The GameAPI sends the customer list (with each one's path) whenever it changes; this
// animates the paths locally with walkAvatar, like the own avatar, and keeps them in the
// depth-sorted list. Step 9d: a waiting customer may sit (drawn right after the seat, like the own
// avatar), customers carry what they bought in their hands (the held-item layer), and short
// gestures (reach, nod) play when they take an item or pay.

import { CUSTOMER_WALK_SPEED, customerAvatar, walkAvatar, type Avatar, type Customer, type FurnitureItem, type LootRef, type Point } from '@pixel-hotel/shared';
import { AvatarSprite, type Gesture } from './avatarSprite.ts';
import { avatarDepthKey } from './depthOrder.ts';
import { idleShift } from './atmosphere.ts';
import { drawGood } from './slotGoods.ts';
import type { RoomView } from './roomView.ts';

interface Shown {
  avatar: Avatar;
  path: Point[];
  /** The customer's own walk speed, px per second. */
  speed: number;
  sprite: AvatarSprite;
  /** The seat they sit on once the walk ends (null = standing). */
  seat: FurnitureItem | null;
  /** What is drawn in their hands, and whether an animation decides that for now. */
  held: LootRef | null;
  heldByAnim: boolean;
  /** Paid: they keep the item in their hands until they are gone. */
  keepsHeld: boolean;
}

const sameLoot = (a: LootRef | null, b: LootRef | null): boolean => JSON.stringify(a) === JSON.stringify(b);

export class CustomerViews {
  private readonly shown = new Map<number, Shown>();
  private timeMs = 0;

  constructor(private readonly view: RoomView) {}

  /** Shows these customers (an empty list or another room: none). `items`: the room's items (seats). */
  sync(customers: readonly Customer[], roomId: number, items: readonly FurnitureItem[] = []): void {
    const ids = new Set(customers.map((c) => c.id));
    for (const [id, s] of this.shown) if (!ids.has(id)) this.drop(id, s);
    for (const c of customers) {
      const a = customerAvatar(c, roomId);
      const seat = c.seat ? (items.find((i) => i.uid === c.seat!.uid) ?? null) : null;
      let s = this.shown.get(c.id);
      if (!s) {
        const sprite = new AvatarSprite(c.look, false);
        sprite.container.eventMode = 'none';
        this.view.objects.add(sprite.container, avatarDepthKey(a));
        s = { avatar: a, path: [...c.path], speed: c.speed ?? CUSTOMER_WALK_SPEED, sprite, seat, held: null, heldByAnim: false, keepsHeld: false };
        this.shown.set(c.id, s);
      } else {
        // Keep the shown position unless it is clearly off (tiny timing differences are walked off).
        const off = Math.hypot(s.avatar.x - a.x, s.avatar.y - a.y) > 8;
        s.avatar = off ? a : { ...s.avatar, facing: c.path.length > 0 ? s.avatar.facing : a.facing };
        s.path = [...c.path];
        s.seat = seat;
      }
      if (!s.heldByAnim && !s.keepsHeld) this.setHeldLoot(s, c.carrying?.loot ?? null);
    }
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
      if (sitting) s.avatar = { ...s.avatar, state: 'sit', facing: s.seat!.facing };
      s.sprite.update(s.avatar, timeMs);
      // Standing customers shift a little now and then (atmosphere step).
      s.sprite.setShift(s.path.length === 0 && !sitting ? idleShift(id, timeMs) : 0);
      this.view.objects.setKey(s.sprite.container, avatarDepthKey(s.avatar, sitting ? s.seat! : undefined));
    }
  }

  /** The customer's hands in world px (where a carried item sits), or null when not shown. */
  handPoint(id: number): Point | null {
    const s = this.shown.get(id);
    if (!s) return null;
    const h = s.sprite.handOffset();
    return { x: Math.round(s.avatar.x) + h.x, y: Math.round(s.avatar.y) + h.y };
  }

  /** What the customer holds right now (drawn), or null. */
  heldOf(id: number): LootRef | null {
    return this.shown.get(id)?.held ?? null;
  }

  /**
   * An animation decides the held item: null = hands empty (the item is hopping), a loot = in the
   * hands again. `keep`: they keep it until they are gone (after paying).
   */
  hold(id: number, loot: LootRef | null, keep = false): void {
    const s = this.shown.get(id);
    if (!s) return;
    s.heldByAnim = loot === null;
    s.keepsHeld = keep;
    this.setHeldLoot(s, loot);
  }

  gesture(id: number, kind: Gesture): void {
    this.shown.get(id)?.sprite.gesture(kind, this.timeMs);
  }

  /** Adds every customer's feet (for the shadows). */
  feet(out: Point[]): void {
    for (const s of this.shown.values()) out.push(s.avatar);
  }

  /** World points above each customer's head (speech bubbles). */
  heads(out: Map<number, Point>, headPx: number): void {
    for (const [id, s] of this.shown) out.set(id, { x: s.avatar.x, y: s.avatar.y - headPx });
  }

  private setHeldLoot(s: Shown, loot: LootRef | null): void {
    if (sameLoot(s.held, loot)) return;
    s.held = loot;
    s.sprite.setHeld(loot ? drawGood(loot) : null);
  }

  private drop(id: number, s: Shown): void {
    this.view.objects.remove(s.sprite.container);
    s.sprite.container.destroy({ children: true });
    this.shown.delete(id);
  }
}
