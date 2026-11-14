// Placing (step 4b, inventory in step 5; faster after 9e, owner's decision): the ghost of one item,
// green if it fits and red if not. A NEW item (from the hotbar or the bag) follows a one-finger /
// left drag by the drag distance, or jumps to a tapped spot. A PLACED item is moved by dragging it
// in build mode (main.ts starts the session when the drag begins): the ghost follows the finger
// and letting go puts it down (or back where it was, when it does not fit there). Nothing changes
// in the room until place() asks the GameAPI (hooks.commit); cancel() just ends the session (a
// moved item was never moved, only hidden).
// The rules live in shared/placing.ts; this file keeps the session and draws the ghost.

import { Container, Graphics } from 'pixi.js';
import {
  FIRST_BUY_POP_MS,
  GHOST_ALPHA,
  PALETTE,
  footprintRect,
  getFurnitureType,
  moveGhost,
  moveItem,
  nextInventoryUid,
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
  getRoom(): Room;
  /** The current room's items and the inventory furniture. */
  getItems(): readonly FurnitureItem[];
  /** Asks the GameAPI to place (or move) the item; true if it was done. */
  commit(session: PlacingSession, snap: boolean): Promise<boolean>;
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
  /** True while a place request is on its way. */
  private busy = false;
  /** ms into the pop animation (the first catalog purchase), or null. */
  private popMs: number | null = null;

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

  /** True while a placed item is being moved (dragged in build mode); false for a new item. */
  get moving(): boolean {
    return (this.session?.origin ?? null) !== null;
  }

  /** The uid of the item of this session, or null. */
  get uid(): number | null {
    return this.session?.uid ?? null;
  }

  /** Puts the ghost's footprint center at a world point (a tap while placing a new item). */
  moveTo(center: Point): void {
    if (!this.session) return;
    this.session = moveGhost(this.session, center);
    this.dragFrom = null;
    this.changed();
  }

  /** The furniture type being placed, or null. */
  get typeId(): string | null {
    return this.session?.typeId ?? null;
  }

  /** Starts placing an inventory item of this type. False if there is none. */
  startNew(typeId: string, center: Point): boolean {
    const uid = nextInventoryUid(this.hooks.getItems(), typeId);
    if (uid === null) return false;
    this.end();
    this.session = startNewPlacing(typeId, center, uid);
    this.changed();
    return true;
  }

  /** Starts moving a placed item: the ghost starts where it stands. */
  startMove(uid: number): void {
    const item = this.hooks.getItems().find((i) => i.uid === uid && i.roomId === this.hooks.getRoom().id);
    if (!item) return;
    this.end();
    this.session = startMovePlacing(item);
    this.changed();
  }

  /** A short pop: the ghost grows in from small, a bit too big, then normal (FIRST_BUY_POP_MS). */
  pop(): void {
    if (this.session) this.popMs = 0;
  }

  /** Call every frame (the pop animation). */
  tick(dtMs: number): void {
    if (this.popMs === null) return;
    this.popMs += dtMs;
    const k = Math.min(1, this.popMs / FIRST_BUY_POP_MS);
    const scale = k < 0.7 ? 0.3 + (k / 0.7) * 0.9 : 1.2 - ((k - 0.7) / 0.3) * 0.2;
    const p = this.plan;
    if (k >= 1 || !p) {
      this.popMs = null;
      this.ghost.scale.set(1);
      this.ghost.pivot.set(0, 0);
      this.ghost.position.set(0, 0);
      return;
    }
    // Grow around the item's anchor.
    this.ghost.pivot.set(p.x, p.y);
    this.ghost.position.set(p.x, p.y);
    this.ghost.scale.set(scale);
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
  async place(): Promise<void> {
    const s = this.session;
    if (!s || this.busy || !this.valid) return;
    this.busy = true;
    const ok = await this.hooks.commit(s, !this.shift).finally(() => (this.busy = false));
    if (!ok || this.session !== s) return;
    this.session = null;
    this.changed();
  }

  /** Stops placing: a moved item stays exactly where it was, an inventory item stays in the inventory. */
  cancel(): void {
    if (!this.session) return;
    this.session = null;
    this.changed();
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
    this.plan = planGhost(this.hooks.getRoom(), items, s, !this.shift);
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
      const to = { x: plan.x, y: plan.y, facing: plan.facing, onItemUid: plan.onItemUid, roomId: this.hooks.getRoom().id };
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
