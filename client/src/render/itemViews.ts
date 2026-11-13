// Keeps one FurnitureSprite per placed item in a room. Blocking items and items on surfaces go
// into the depth-sorted object list; non-blocking items (rugs) go into the rug layer, under
// everything. Item containers take part in Pixi hit testing (eventMode 'static'), so a tap can
// find the item under it. A refused rotate shakes the item (shake(), call update() every frame).

import type { Container } from 'pixi.js';
import { SHAKE_MS, SHAKE_PX, getFurnitureType, type FurnitureItem, type Rect } from '@pixel-hotel/shared';
import { FurnitureSprite } from './furnitureSprite.ts';
import { surfaceHeight } from './furnitureArt.ts';
import { itemDepthKey } from './depthOrder.ts';
import type { RoomView } from './roomView.ts';

export class ItemViews {
  private readonly sprites = new Map<number, FurnitureSprite>();
  private readonly uids = new Map<Container, number>();
  /** Items shaking, with the ms they have shaken so far. */
  private readonly shakes = new Map<number, number>();

  constructor(
    private readonly view: RoomView,
    private roomId: number,
  ) {}

  /** Shows another room: every sprite of the old room is dropped. */
  setRoom(roomId: number): void {
    for (const [uid, sprite] of this.sprites) this.drop(uid, sprite);
    this.shakes.clear();
    this.roomId = roomId;
  }

  /** Shows the items of this room; `hidden` items (held in build mode) are not drawn. */
  sync(items: readonly FurnitureItem[], hidden: ReadonlySet<number> = new Set()): void {
    const byUid = new Map(items.map((i) => [i.uid, i]));
    const here = items.filter((i) => i.roomId === this.roomId);
    for (const [uid, sprite] of this.sprites) {
      const item = byUid.get(uid);
      if (!item || item.roomId !== this.roomId || item.typeId !== sprite.type.id) this.drop(uid, sprite);
    }
    for (const item of here) {
      const type = getFurnitureType(item.typeId);
      let sprite = this.sprites.get(item.uid);
      if (!sprite) {
        sprite = new FurnitureSprite(type);
        sprite.container.eventMode = 'static';
        this.sprites.set(item.uid, sprite);
        this.uids.set(sprite.container, item.uid);
        this.layerFor(item).add(sprite.container, itemDepthKey(item));
      }
      const under = item.onItemUid !== null ? byUid.get(item.onItemUid) : undefined;
      sprite.set(item.x, item.y, item.facing, under ? surfaceHeight(getFurnitureType(under.typeId)) : 0);
      sprite.container.visible = !hidden.has(item.uid);
      this.layerFor(item).setKey(sprite.container, itemDepthKey(item, under));
    }
  }

  /** The item's bounds on screen (CSS px), or null when it is not shown. */
  screenBounds(uid: number): Rect | null {
    const c = this.sprites.get(uid)?.container;
    if (!c?.visible) return null;
    const b = c.getBounds();
    return { x: b.x, y: b.y, w: b.width, h: b.height };
  }

  /** A short side-to-side shake (a refused rotate). */
  shake(uid: number): void {
    if (this.sprites.has(uid)) this.shakes.set(uid, 0);
  }

  update(dtMs: number): void {
    for (const [uid, t] of this.shakes) {
      const c = this.sprites.get(uid)?.container;
      const next = t + dtMs;
      const done = !c || next >= SHAKE_MS;
      // Whole world px only (pixel-perfect): -2, 0, 2, 0, ...
      if (c) c.pivot.x = done ? 0 : Math.round(Math.sin((next / SHAKE_MS) * Math.PI * 6)) * SHAKE_PX;
      if (done) this.shakes.delete(uid);
      else this.shakes.set(uid, next);
    }
  }

  /** The uid of the item that a hit-tested display object belongs to, or null. */
  uidOf(target: Container | null): number | null {
    for (let c: Container | null = target; c; c = c.parent) {
      const uid = this.uids.get(c);
      if (uid !== undefined) return uid;
    }
    return null;
  }

  private layerFor(item: FurnitureItem) {
    return getFurnitureType(item.typeId).blocks || item.onItemUid !== null ? this.view.objects : this.view.rugs;
  }

  private drop(uid: number, sprite: FurnitureSprite): void {
    this.view.objects.remove(sprite.container);
    this.view.rugs.remove(sprite.container);
    this.uids.delete(sprite.container);
    this.sprites.delete(uid);
    sprite.destroy();
  }
}
