// Draws a room: floor, rugs, back wall and borders, then the depth-sorted object layer
// (brief section 7). All children are in world px; the camera scales and moves `world`.

import { Container, Graphics, TilingSprite, type Texture } from 'pixi.js';
import {
  bottomBorderRects,
  doorRect,
  floorRect,
  leftBorderRect,
  rightBorderRect,
  wallBandRect,
  type Rect,
  type Room,
} from '@pixel-hotel/shared';
import { BARE_WALL_COLOR, BARE_WALL_EDGE, BORDER_COLOR, createBareFloorTexture } from './bareStyles.ts';
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
  /** Build mode ghost, above everything. */
  readonly ghostLayer = new Container({ eventMode: 'none' });
  private floorTexture: Texture | null = null;

  constructor() {
    this.rugLayer.addChild(this.rugs.container);
    this.world.addChild(
      this.floorLayer,
      this.rugLayer,
      this.debugLayer,
      this.wallLayer,
      this.objects.container,
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
    this.floorTexture ??= createBareFloorTexture();

    // The floor also runs through the door opening.
    const floor = floorRect(room);
    const door = doorRect(room);
    const floorSprite = new TilingSprite({ texture: this.floorTexture, width: floor.w, height: floor.h + door.h });
    floorSprite.position.set(floor.x, floor.y);
    this.floorLayer.addChild(floorSprite);

    const walls = new Graphics();
    const band = wallBandRect(room);
    fillRect(walls, band, BARE_WALL_COLOR);
    fillRect(walls, { x: band.x, y: band.y + band.h - BARE_WALL_EDGE, w: band.w, h: BARE_WALL_EDGE }, BORDER_COLOR);
    for (const r of [leftBorderRect(room), rightBorderRect(room), ...bottomBorderRects(room)]) {
      fillRect(walls, r, BORDER_COLOR);
    }
    this.wallLayer.addChild(walls);
  }
}

function fillRect(g: Graphics, r: Rect, color: string): void {
  if (r.w > 0 && r.h > 0) g.rect(r.x, r.y, r.w, r.h).fill(color);
}
