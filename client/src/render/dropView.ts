// Ground drops on screen (OB-8 J2, rules in shared/src/drops.ts): the item icon lying on the floor with a soft shadow, a
// gentle bob, a ring in its rank colour (rarer = stronger) and a thin beam for ultra rare and legendary. The rule moves a
// drop in 100 ms ticks; the sprite follows that position smoothly each frame (no stepping), and a picked drop flies the
// last bit into the avatar and is gone. Code-drawn placeholder look (ART HOOK: the artist may swap ring/beam art).

import { Container, Graphics, Sprite } from 'pixi.js';
import { getFurnitureType, getMaterialType, isMaterialId, popHeight, rarityStyle, COIN_ICON, type Drop, type Icon, type Point } from '@pixel-hotel/shared';
import { iconTexture } from './drawIcon.ts';
import type { DepthLayer } from './depthLayer.ts';

/** Depth key ids above every other dungeon object. */
const DROP_ID_BASE = 400000;
/** Icon scale on the floor (32 px icon -> 20 px). */
const DROP_SCALE = 0.625;
const DROP_BOB_PX = 2;
/** The sprite catches up with the rule's position with this time constant (ms): smooth between 100 ms ticks. */
const FOLLOW_MS = 45;
/** A picked drop flies into the avatar over this long (ms). */
const FLY_MS = 120;

interface View {
  root: Container;
  sprite: Sprite;
  ring: Graphics;
  x: number;
  y: number;
  /** ms since it was picked (flying into the avatar); -1 = on the ground. */
  flyMs: number;
}

function dropIcon(item: string): Icon {
  if (item === 'gold') return COIN_ICON;
  return isMaterialId(item) ? getMaterialType(item).icon : getFurnitureType(item).icon;
}

export class DropViews {
  private readonly views = new Map<number, View>();

  constructor(private readonly objects: DepthLayer) {}

  /**
   * Call every frame: drops = the run's ground drops, at = the avatar's feet, seen = fog check. A drop that is gone from
   * the list flies into the avatar and is removed.
   */
  sync(drops: readonly Drop[], at: Point, dtMs: number, clockMs: number, seen: (p: Point) => boolean): void {
    const live = new Set<number>();
    const follow = 1 - Math.exp(-dtMs / FOLLOW_MS);
    for (const d of drops) {
      live.add(d.id);
      let v = this.views.get(d.id);
      if (!v) {
        v = this.make(d);
        this.views.set(d.id, v);
        this.objects.add(v.root, { y: d.y, x: d.x, uid: DROP_ID_BASE + d.id });
      }
      v.x += (d.x - v.x) * follow;
      v.y += (d.y - v.y) * follow;
      const bob = d.state === 'rest' ? DROP_BOB_PX * (0.5 + 0.5 * Math.sin(clockMs / 280 + d.id)) : 0;
      v.root.position.set(Math.round(v.x), Math.round(v.y));
      v.sprite.y = -Math.round(2 + popHeight(d) + bob);
      v.ring.alpha = 0.55 + 0.25 * Math.sin(clockMs / 400 + d.id);
      v.root.visible = seen(d);
      this.objects.setKey(v.root, { y: v.y, x: v.x, uid: DROP_ID_BASE + d.id });
    }
    for (const [id, v] of this.views) {
      if (live.has(id)) continue;
      if (v.flyMs < 0) v.flyMs = 0;
      v.flyMs += dtMs;
      const k = Math.min(1, v.flyMs / FLY_MS);
      v.root.position.set(Math.round(v.x + (at.x - v.x) * k), Math.round(v.y + (at.y - 20 - v.y) * k));
      v.root.alpha = 1 - 0.6 * k;
      if (k >= 1) this.remove(id);
    }
  }

  /** A new floor or the end of a run: every view goes at once. */
  clear(): void {
    for (const id of [...this.views.keys()]) this.remove(id);
  }

  private make(d: Drop): View {
    const style = rarityStyle(d.rank);
    const color = parseInt(style.color.slice(1), 16);
    const root = new Container();
    const ring = new Graphics();
    // A soft dark shadow, then the rank ring (only above common) and the beam for the sparkling ranks.
    ring.ellipse(0, 0, 7, 3).fill({ color: 0x000000, alpha: 0.35 });
    if (style.glow > 0) ring.ellipse(0, 0, 8 + 2 * style.glow, 3 + style.glow).stroke({ color, width: 1, alpha: 0.6 + 0.2 * style.glow });
    if (style.beam) ring.rect(-1, -34, 2, 30).fill({ color, alpha: 0.35 });
    const sprite = new Sprite(iconTexture(dropIcon(d.item), d.rank));
    sprite.anchor.set(0.5, 1);
    sprite.scale.set(DROP_SCALE);
    root.addChild(ring, sprite);
    return { root, sprite, ring, x: d.x, y: d.y, flyMs: -1 };
  }

  private remove(id: number): void {
    const v = this.views.get(id);
    if (!v) return;
    this.objects.remove(v.root);
    v.root.destroy({ children: true });
    this.views.delete(id);
  }
}
