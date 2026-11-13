// The own avatar sitting or lying in the client (step 5b): the seat it walks to, the 150 ms
// slide from the approach point onto the seat (no pathfinding, it may cross the footprint; lying
// has no slide), the pose, and the lying drawing inside the bed (lieArt.ts). The rules (which seat, which side) are
// in shared/src/seats.ts; this only animates what the GameAPI planned.

import {
  SEAT_SLIDE_MS,
  getFurnitureType,
  onSeat,
  slidePoint,
  type Avatar,
  type FurnitureItem,
  type Point,
  type SeatSpot,
} from '@pixel-hotel/shared';
import type { AvatarSprite } from './avatarSprite.ts';

export interface SeatGoal {
  uid: number;
  seat: SeatSpot;
  /** Where the item was tapped (picks the seat again if the room changes on the way). */
  tap: Point | null;
}

export class Seating {
  /** The seat the avatar is walking to (slides onto it on arrival). */
  goal: SeatGoal | null = null;
  /** The item and seat the avatar sits or lies on (also while sliding onto it). */
  seated: { uid: number; seat: SeatSpot } | null = null;
  private slide: { from: Point; ms: number } | null = null;

  constructor(private readonly sprite: AvatarSprite) {}

  /** True while sitting, lying or sliding onto a seat (the avatar does not walk then). */
  get busy(): boolean {
    return this.seated !== null;
  }

  /** The path to the seat ended: take the pose and start the slide. */
  arrive(avatar: Avatar, item: FurnitureItem | undefined): Avatar {
    const goal = this.goal;
    this.goal = null;
    if (!goal || !item) return avatar;
    const { seat } = goal;
    this.seated = { uid: goal.uid, seat };
    if (seat.pose === 'lie') {
      // Lying is drawn inside the bed only (lieArt.ts): no slide, the avatar is on the seat at once.
      this.slide = null;
      this.sprite.setLying(getFurnitureType(item.typeId), item.facing, item.x - seat.x, item.y - seat.y);
      return { ...avatar, x: seat.x, y: seat.y, facing: seat.facing, state: seat.pose };
    }
    this.slide = { from: { x: avatar.x, y: avatar.y }, ms: 0 };
    return { ...avatar, facing: seat.facing, state: seat.pose };
  }

  /** Moves the slide on by dtMs. A lying avatar always stays on its seat (the drawing is tied to the bed). */
  update(avatar: Avatar, dtMs: number): Avatar {
    if (this.seated?.seat.pose === 'lie') {
      const { x, y } = this.seated.seat;
      return avatar.x === x && avatar.y === y ? avatar : { ...avatar, x, y };
    }
    if (!this.slide || !this.seated) return avatar;
    this.slide.ms += dtMs;
    const p = slidePoint(this.slide.from, this.seated.seat, this.slide.ms, SEAT_SLIDE_MS);
    if (this.slide.ms >= SEAT_SLIDE_MS) this.slide = null;
    return { ...avatar, x: p.x, y: p.y };
  }

  /** True if the seat is still where the avatar sat down (the item was not moved or picked up). */
  stillThere(item: FurnitureItem | undefined): boolean {
    const s = this.seated;
    return s !== null && onSeat(s.seat, item, item && getFurnitureType(item.typeId), s.seat.index);
  }

  /** Stands up (at `at`, or where the avatar is): no seat, no pose, no blanket. */
  standUp(avatar: Avatar, at?: Point): Avatar {
    this.clear();
    return { ...avatar, ...(at ?? {}), state: 'idle' };
  }

  /** Forgets the goal and the seat (a new walk, another room). */
  clear(): void {
    this.goal = null;
    this.seated = null;
    this.slide = null;
    if (this.sprite.isLying) this.sprite.setLying(null);
  }
}
