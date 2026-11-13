// Placing (step 4b): the ghost of one item that the player drags around (a one-finger / left
// drag moves it by the drag distance), green if it fits and red if not. Nothing changes in the
// room until place(); cancel() puts a moved item back exactly where it was. The rules live in
// shared/placing.ts; this file keeps the session and draws the ghost.

import { Container, Graphics } from 'pixi.js';
import {
  GHOST_ALPHA,
  PALETTE,
  cancelPlacing,
  confirmPlacing,
  footprintRect,
  getFurnitureType,
  moveGhost,
  moveItem,
  planGhost,
  ridersOf,
  rotateGhost,
  startMovePlacing,
  startNewPlacing,
  type FurnitureItem,
  type Placement,
  type PlacingSession,
  type Point,
  type Rect,
  type Room,
} from '@pixel-hotel/shared';
import { FurnitureSprite } from '../render/furnitureSprite.ts';
import { surfaceHeight } from '../render/furnitureArt.ts';

const OK_COLOR = PALETTE[12];
const BAD_COLOR = PALETTE[8];

export interface PlacerHooks {
  room: Room;
  ownerId: number;
  getItems(): readonly FurnitureItem[];
  /** The items changed (placed, or a moved item put back). */
  setItems(items: FurnitureItem[]): void;
  newUid(): number;
  /** The session started, ended or changed (ghost moved, turned, became valid or invalid). */
  onChange(): void;
}

export class Placer {
  private session: PlacingSession | null = null;
  private plan: Placement | null = null;
  /** Shift held: snapping off. */
  private shift = false;
  private dragFrom: { pointer: Point; center: Point } | null = null;
  private readonly ghost = new Container();
  private readonly outline = new Graphics();
  private readonly riders = new Container();
  private sprite: FurnitureSprite | null = null;

  constructor(
    private readonly hooks: PlacerHooks,
    layer: Container,
  ) {
    this.ghost.alpha = GHOST_ALPHA;
    this.ghost.visible = false;
    this.ghost.eventMode = 'none';
    this.ghost.addChild(this.outline, this.riders);
    layer.addChild(this.ghost);
  }

  get active(): boolean {
    return this.session !== null;
  }

  /** True when the ghost fits where it is (Place is enabled). */
  get valid(): boolean {
    return this.plan?.ok === true;
  }

  /** Items not drawn in the room right now: a moved item and what stands on it. */
  hiddenUids(): Set<number> {
    const s = this.session;
    if (!s?.origin || s.uid === null) return new Set();
    return new Set([s.uid, ...ridersOf(this.hooks.getItems(), s.uid).map((r) => r.uid)]);
  }

  /** The ghost's bounds on screen (CSS px), or null when nothing is being placed. */
  screenBounds(): Rect | null {
    if (!this.ghost.visible) return null;
    const b = this.ghost.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  /** Starts placing an item from the list: an inventory item of that type, else a new one. */
  startNew(typeId: string, center: Point): void {
    this.end();
    const inv = this.hooks.getItems().find((i) => i.roomId === null && i.typeId === typeId);
    this.session = startNewPlacing(typeId, center, inv?.uid ?? null);
    this.changed();
  }

  /** Starts moving a placed item: the ghost starts where it stands. */
  startMove(uid: number): void {
    const item = this.hooks.getItems().find((i) => i.uid === uid && i.roomId === this.hooks.room.id);
    if (!item) return;
    this.end();
    this.session = startMovePlacing(item);
    this.changed();
  }

  setShift(shift: boolean): void {
    if (shift === this.shift) return;
    this.shift = shift;
    if (this.session) this.changed();
  }

  rotate(): void {
    if (!this.session) return;
    this.session = rotateGhost(this.session);
    this.changed();
  }

  /** Places the ghost. Does nothing while it is red. */
  place(): void {
    const s = this.session;
    if (!s) return;
    const h = this.hooks;
    const next = confirmPlacing(h.room, h.getItems(), s, { ownerId: h.ownerId, newUid: () => h.newUid() }, !this.shift);
    if (!next) return;
    this.session = null;
    this.update();
    h.setItems(next);
  }

  /** Stops placing: a moved item goes back exactly where it was, a new one back to the list. */
  cancel(): void {
    const s = this.session;
    if (!s) return;
    this.session = null;
    this.update();
    this.hooks.setItems(cancelPlacing(this.hooks.getItems(), s));
  }

  /** A one-finger / left drag moves the ghost by the drag distance. */
  drag(phase: 'start' | 'move' | 'end', world: Point): void {
    const s = this.session;
    if (!s) return;
    if (phase === 'start') this.dragFrom = { pointer: world, center: s.center };
    const f = this.dragFrom;
    if (!f) return;
    this.session = moveGhost(s, { x: f.center.x + world.x - f.pointer.x, y: f.center.y + world.y - f.pointer.y });
    if (phase === 'end') this.dragFrom = null;
    this.changed();
  }

  private end(): void {
    if (this.session) this.cancel();
  }

  private changed(): void {
    this.update();
    this.hooks.onChange();
  }

  /** Re-plans and redraws the ghost (hides it when nothing is being placed). */
  private update(): void {
    const s = this.session;
    if (!s) {
      this.plan = null;
      this.dragFrom = null;
      this.ghost.visible = false;
      return;
    }
    const items = this.hooks.getItems();
    this.plan = planGhost(this.hooks.room, items, s, !this.shift);
    this.drawGhost(s, this.plan, items);
  }

  private drawGhost(s: PlacingSession, plan: Placement, items: readonly FurnitureItem[]): void {
    const type = getFurnitureType(s.typeId);
    const color = plan.ok ? OK_COLOR : BAD_COLOR;
    const fp = footprintRect(plan, type);
    this.outline.clear().rect(fp.x, fp.y, fp.w, fp.h).fill({ color, alpha: 0.35 }).stroke({ color, width: 1, alignment: 1 });

    if (this.sprite?.type !== type) {
      this.sprite?.destroy();
      this.sprite = new FurnitureSprite(type);
      this.ghost.addChildAt(this.sprite.container, 1);
    }
    const under = plan.onItemUid !== null ? items.find((i) => i.uid === plan.onItemUid) : undefined;
    const lift = under ? surfaceHeight(getFurnitureType(under.typeId)) : 0;
    this.sprite.set(plan.x, plan.y, plan.facing, lift);
    this.sprite.container.tint = color;

    // What stands on a moved item moves with it.
    this.riders.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (s.origin && s.uid !== null && ridersOf(items, s.uid).length > 0) {
      const to = { x: plan.x, y: plan.y, facing: plan.facing, onItemUid: plan.onItemUid, roomId: this.hooks.room.id };
      const top = surfaceHeight(type) + lift;
      for (const r of ridersOf(moveItem(items, s.uid, to), s.uid)) {
        const rs = new FurnitureSprite(getFurnitureType(r.typeId));
        rs.set(r.x, r.y, r.facing, top);
        rs.container.tint = color;
        this.riders.addChild(rs.container);
      }
    }
    this.ghost.visible = true;
  }
}
