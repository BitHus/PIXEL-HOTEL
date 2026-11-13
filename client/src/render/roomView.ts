// Draws a room: floor, rugs, back wall and borders, then the depth-sorted object layer
// (brief section 7). All children are in world px; the camera scales and moves `world`.

import { Container, Graphics, TilingSprite } from 'pixi.js';
import { borderRects, doorRect, floorRects, wallBands, type Rect, type Room } from '@pixel-hotel/shared';
import { BORDER_COLOR } from './bareStyles.ts';
import { floorTexture, wallTexture } from './styleArt.ts';
import { DepthLayer } from './depthLayer.ts';

export class RoomView {
  /** Scaled and moved by the camera. */
  readonly world = new Container();

  readonly floorLayer = new Container();
  readonly rugLayer = new Container();
  /** Non-blocking items (rugs), sorted among themselves, under everything else. */
  readonly rugs = new DepthLayer();
  /** Debug drawings on the floor (Blockers mode), above rugs and below the wall. */
  readonly debugLayer = new Container();
  readonly wallLayer = new Container();
  readonly objects = new DepthLayer();
  /** Markers above everything in the room (the farm's ripe markers, step 9b). */
  readonly markerLayer = new Container({ eventMode: 'none' });
  /** Build mode ghost, above everything. */
  readonly ghostLayer = new Container({ eventMode: 'none' });

  constructor() {
    this.rugLayer.addChild(this.rugs.container);
    this.world.addChild(
      this.floorLayer,
      this.rugLayer,
      this.debugLayer,
      this.wallLayer,
      this.objects.container,
      this.markerLayer,
      this.ghostLayer,
    );
  }

  /** Call once per frame: re-sorts the rug and object lists when something moved. */
  update(): void {
    this.rugs.update();
    this.objects.update();
  }

  setRoom(room: Room): void {
    this.floorLayer.removeChildren().forEach((c) => c.destroy());
    this.wallLayer.removeChildren().forEach((c) => c.destroy());

    // The floor: one tiling sprite per rectangle of the shape (step 7b), the texture lined up with
    // the world so the seams do not show. It also runs through the door opening.
    const floorTex = floorTexture(room.floorStyle);
    for (const r of [...floorRects(room), doorRect(room)]) {
      const f = new TilingSprite({ texture: floorTex, width: r.w, height: r.h });
      f.position.set(r.x, r.y);
      f.tilePosition.set(-r.x, -r.y);
      this.floorLayer.addChild(f);
    }

    // A back wall band above every floor edge that faces up, then the thin borders.
    const wallTex = wallTexture(room.wallStyle);
    for (const b of wallBands(room)) {
      const wall = new TilingSprite({ texture: wallTex, width: b.w, height: b.h });
      wall.position.set(b.x, b.y);
      wall.tilePosition.set(-b.x, 0);
      this.wallLayer.addChild(wall);
    }
    const walls = new Graphics();
    for (const r of borderRects(room)) fillRect(walls, r, BORDER_COLOR);
    this.wallLayer.addChild(walls);
  }
}

function fillRect(g: Graphics, r: Rect, color: string): void {
  if (r.w > 0 && r.h > 0) g.rect(r.x, r.y, r.w, r.h).fill(color);
}
