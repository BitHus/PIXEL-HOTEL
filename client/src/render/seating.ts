// The own avatar sitting or lying in the client (step 5b): the seat it walks to, the 150 ms
// slide from the approach point onto the seat (no pathfinding, it may cross the footprint),
// the pose, and the blanket drawn over a lying avatar. The rules (which seat, which side) are
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
import { drawFurniture } from './furnitureArt.ts';

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
    this.slide = { from: { x: avatar.x, y: avatar.y }, ms: 0 };
    if (seat.pose === 'lie') {
      const cover = drawFurniture(getFurnitureType(item.typeId), item.facing, 'cover');
      cover.scale.x = item.facing === 'left' ? -1 : 1;
      this.sprite.setCover(cover, item.x - seat.x, item.y - seat.y);
    }
    return { ...avatar, facing: seat.facing, state: seat.pose };
  }

  /** Moves the slide on by dtMs. */
  update(avatar: Avatar, dtMs: number): Avatar {
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
    if (this.sprite.hasCover) this.sprite.setCover(null);
  }
}
