// Keeps one FurnitureSprite per placed item in a room. Blocking items and items on surfaces go
// into the depth-sorted object list; non-blocking items (rugs) go into the rug layer, under
// everything. Item containers take part in Pixi hit testing (eventMode 'static'), so a tap can
// find the item under it.

import type { Container } from 'pixi.js';
import { getFurnitureType, type FurnitureItem } from '@pixel-hotel/shared';
import { FurnitureSprite } from './furnitureSprite.ts';
import { surfaceHeight } from './furnitureArt.ts';
import { itemDepthKey } from './depthOrder.ts';
import type { RoomView } from './roomView.ts';

export class ItemViews {
  private readonly sprites = new Map<number, FurnitureSprite>();
  private readonly uids = new Map<Container, number>();

  constructor(
    private readonly view: RoomView,
    private readonly roomId: number,
  ) {}

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
