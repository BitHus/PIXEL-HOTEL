// One furniture item on screen: the box placeholder art for its facing, at its anchor (the
// bottom center of the footprint). Items on a surface are lifted by the surface height.

import { Container, type Graphics } from 'pixi.js';
import type { Facing, FurnitureType } from '@pixel-hotel/shared';
import { drawFurniture } from './furnitureArt.ts';

export class FurnitureSprite {
  /** Positioned at the anchor, in world px. */
  readonly container = new Container();
  private art: Graphics | null = null;
  private facing: Facing | null = null;

  constructor(readonly type: FurnitureType) {}

  /** Shows the item at (x, y), drawn `lift` px higher (standing on a surface). */
  set(x: number, y: number, facing: Facing, lift = 0): void {
    this.container.position.set(Math.round(x), Math.round(y - lift));
    if (facing === this.facing) return;
    this.facing = facing;
    this.art?.destroy();
    this.art = drawFurniture(this.type, facing);
    this.art.scale.x = facing === 'left' ? -1 : 1;
    this.container.addChild(this.art);
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
