// Build mode (step 4): pick an item from the temporary list or tap a placed item to hold it.
// A ghost follows the pointer (mouse hover, or a one-finger / left drag that moves it), green if
// it fits and red if not. Tap or click places it. Rotate cycles the facings. The rules (where
// it may go, snapping to surfaces, riders moving along) are the shared furniture rules; this
// file only keeps the held item and draws the ghost.

import { Container, Graphics } from 'pixi.js';
import {
  GHOST_ALPHA,
  PALETTE,
  footprintRect,
  footprintSize,
  getFurnitureType,
  moveItem,
  nextFacing,
  pickUpItem,
  planPlacement,
  ridersOf,
  snapCoord,
  type Facing,
  type FurnitureItem,
  type FurnitureType,
  type Placement,
  type Point,
  type Room,
} from '@pixel-hotel/shared';
import { FurnitureSprite } from '../render/furnitureSprite.ts';
import { surfaceHeight } from '../render/furnitureArt.ts';

const OK_COLOR = PALETTE[12];
const BAD_COLOR = PALETTE[8];

export interface BuildHooks {
  room: Room;
  ownerId: number;
  getItems(): readonly FurnitureItem[];
  /** The items changed (placed, moved, picked up). */
  setItems(items: FurnitureItem[]): void;
  newUid(): number;
  /** World point in the middle of the screen: where a ghost first shows on touch screens. */
  viewCenter(): Point;
  /** Something about the build state changed (held item, hidden items): refresh UI and views. */
  onChange(): void;
}

interface Held {
  type: FurnitureType;
  facing: Facing;
  /** The item being held, or null for a brand new one. */
  uid: number | null;
  /** True when it was lifted from the room (it goes back there on cancel). */
  moving: boolean;
}

export class BuildMode {
  on = false;
  /** Shift held: snapping off. */
  private shift = false;
  private held: Held | null = null;
  /** Footprint center the ghost aims at, world px (unsnapped). */
  private center: Point | null = null;
  private dragFrom: { pointer: Point; center: Point } | null = null;
  private plan: Placement | null = null;
  private readonly ghost = new Container();
  private readonly outline = new Graphics();
  private readonly riders = new Container();
  private sprite: FurnitureSprite | null = null;

  constructor(
    private readonly hooks: BuildHooks,
    layer: Container,
  ) {
    this.ghost.alpha = GHOST_ALPHA;
    this.ghost.visible = false;
    this.ghost.addChild(this.outline, this.riders);
    layer.addChild(this.ghost);
  }

  /** Type id of the held item, or null. */
  get heldTypeId(): string | null {
    return this.held?.type.id ?? null;
  }

  /** True when a placed item is held (it can be picked up into the inventory). */
  get canPickUp(): boolean {
    return this.held?.moving === true;
  }

  get holding(): boolean {
    return this.held !== null;
  }

  /** Items not drawn in the room right now: the held item and what stands on it. */
  hiddenUids(): Set<number> {
    const uid = this.held?.moving ? this.held.uid : null;
    if (uid === null || uid === undefined) return new Set();
    return new Set([uid, ...ridersOf(this.hooks.getItems(), uid).map((r) => r.uid)]);
  }

  /** True if the screen point is on the ghost (tapping it places it where it is). */
  ghostContains(screen: Point): boolean {
    return this.ghost.visible && this.ghost.getBounds().containsPoint(screen.x, screen.y);
  }

  setOn(on: boolean): void {
    this.on = on;
    if (!on) this.cancel();
  }

  setShift(shift: boolean): void {
    if (shift === this.shift) return;
    this.shift = shift;
    this.replan();
  }

  /** Holds a type from the list: an inventory item of that type if there is one, else a new one. */
  select(typeId: string): void {
    this.cancel();
    const type = getFurnitureType(typeId);
    this.held = { type, facing: type.facings[0] ?? 'down', uid: this.inventoryUid(typeId), moving: false };
    this.center ??= this.hooks.viewCenter();
    this.changed();
  }

  rotate(): void {
    if (!this.held) return;
    this.held.facing = nextFacing(this.held.type, this.held.facing);
    this.changed();
  }

  /** The held placed item (and what stands on it) goes to the inventory. */
  pickUp(): void {
    const held = this.held;
    if (!held) return;
    this.held = null;
    if (held.moving && held.uid !== null) this.hooks.setItems(pickUpItem(this.hooks.getItems(), held.uid));
    this.changed();
  }

  /** Lets go of the held item; a lifted item stays where it was. */
  cancel(): void {
    if (!this.held) return;
    this.held = null;
    this.dragFrom = null;
    this.changed();
  }

  /** Mouse moved: the ghost follows (the footprint center is under the pointer). */
  hover(world: Point): void {
    if (this.dragFrom) return;
    this.center = world;
    if (this.held) this.replan();
  }

  /** A one-finger / left drag moves the ghost by the drag distance. */
  drag(phase: 'start' | 'move' | 'end', world: Point): void {
    if (!this.held) return;
    if (phase === 'start') this.dragFrom = { pointer: world, center: this.center ?? world };
    if (!this.dragFrom) return;
    const f = this.dragFrom;
    this.center = { x: f.center.x + world.x - f.pointer.x, y: f.center.y + world.y - f.pointer.y };
    if (phase === 'end') this.dragFrom = null;
    this.replan();
  }

  /**
   * A tap: places the held item (where the ghost is if the tap is on it, else at the tap), or
   * lifts the tapped item.
   */
  tap(world: Point, onGhost: boolean, hitUid: number | null): void {
    if (!this.held) {
      if (hitUid !== null) this.lift(hitUid);
      return;
    }
    if (!onGhost) {
      this.center = world;
      this.replan();
    }
    this.place();
  }

  private lift(uid: number): void {
    const item = this.hooks.getItems().find((i) => i.uid === uid);
    if (!item || item.roomId !== this.hooks.room.id) return;
    const type = getFurnitureType(item.typeId);
    const fp = footprintRect(item, type);
    this.held = { type, facing: item.facing, uid, moving: true };
    this.center = { x: item.x, y: fp.y + fp.h / 2 };
    this.changed();
  }

  private place(): void {
    const held = this.held;
    const plan = this.plan;
    if (!held || !plan?.ok) return;
    const room = this.hooks.room;
    const to = { x: plan.x, y: plan.y, facing: plan.facing, onItemUid: plan.onItemUid, roomId: room.id };
    const items = this.hooks.getItems();
    if (held.uid !== null) {
      this.hooks.setItems(moveItem(items, held.uid, to));
    } else {
      this.hooks.setItems([...items, { uid: this.hooks.newUid(), typeId: held.type.id, ownerId: this.hooks.ownerId, ...to }]);
    }
    // A moved item is let go; from the list you keep placing the same type.
    this.held = held.moving ? null : { ...held, uid: this.inventoryUid(held.type.id) };
    this.changed();
  }

  private inventoryUid(typeId: string): number | null {
    return this.hooks.getItems().find((i) => i.roomId === null && i.typeId === typeId)?.uid ?? null;
  }

  private changed(): void {
    this.replan();
    this.hooks.onChange();
  }

  /** Works out where the held item would go and redraws the ghost. */
  private replan(): void {
    const held = this.held;
    if (!held || !this.center) {
      this.plan = null;
      this.ghost.visible = false;
      return;
    }
    const items = this.hooks.getItems();
    const fd = footprintSize(held.type, held.facing).d;
    const snap = !this.shift;
    const x = snapCoord(this.center.x, snap);
    const y = snapCoord(this.center.y + fd / 2, snap);
    const others = items.filter((i) => i.uid !== held.uid);
    const carrying = held.uid !== null && ridersOf(items, held.uid).length > 0;
    this.plan = planPlacement(this.hooks.room, others, held.type, x, y, held.facing, carrying);
    this.drawGhost(held, this.plan, items);
  }

  private drawGhost(held: Held, plan: Placement, items: readonly FurnitureItem[]): void {
    const color = plan.ok ? OK_COLOR : BAD_COLOR;
    const fp = footprintRect(plan, held.type);
    this.outline.clear().rect(fp.x, fp.y, fp.w, fp.h).fill({ color, alpha: 0.35 }).stroke({ color, width: 1, alignment: 1 });

    if (this.sprite?.type !== held.type) {
      this.sprite?.destroy();
      this.sprite = new FurnitureSprite(held.type);
      this.ghost.addChildAt(this.sprite.container, 1);
    }
    const under = plan.onItemUid !== null ? items.find((i) => i.uid === plan.onItemUid) : undefined;
    const lift = under ? surfaceHeight(getFurnitureType(under.typeId)) : 0;
    this.sprite.set(plan.x, plan.y, plan.facing, lift);
    this.sprite.container.tint = color;

    // What stands on a lifted item moves with it.
    this.riders.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (held.moving && held.uid !== null && ridersOf(items, held.uid).length > 0) {
      const to = { x: plan.x, y: plan.y, facing: plan.facing, onItemUid: plan.onItemUid, roomId: this.hooks.room.id };
      const top = surfaceHeight(held.type) + lift;
      for (const r of ridersOf(moveItem(items, held.uid, to), held.uid)) {
        const s = new FurnitureSprite(getFurnitureType(r.typeId));
        s.set(r.x, r.y, r.facing, top);
        s.container.tint = color;
        this.riders.addChild(s.container);
      }
    }
    this.ghost.visible = true;
  }
}
