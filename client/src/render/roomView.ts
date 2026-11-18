// Draws a room: floor, rugs, back wall and borders, then the depth-sorted object layer
// (brief section 7). All children are in world px; the camera scales and moves `world`.

import { Container, Graphics, TilingSprite } from 'pixi.js';
import { BUILD_CELL, borderRects, doorRect, floorCellList, floorRects, floorStyleAt, innDoorSpots, wallBands, type Rect, type Room } from '@pixel-hotel/shared';
import { BORDER_COLOR } from './bareStyles.ts';
import { doorOpenNear, doorSpill, drawInnDoor, setDoorOpen } from './innDoors.ts';
import { floorTexture, wallTexture } from './styleArt.ts';
import { DepthLayer } from './depthLayer.ts';


export class RoomView {
  /** Scaled and moved by the camera. */
  readonly world = new Container();

  readonly floorLayer = new Container();
  readonly rugLayer = new Container();
  /** Non-blocking items (rugs), sorted among themselves, under everything else. */
  readonly rugs = new DepthLayer();
  /** The faint build grid and the floor paint preview (step BG1), above rugs, under the items. */
  readonly gridLayer = new Container({ eventMode: 'none' });
  /** Debug drawings on the floor (Blockers mode), above rugs and below the wall. */
  readonly debugLayer = new Container();
  readonly wallLayer = new Container();
  /** Shadows and ground dust (atmosphere step): on the floor, under the depth-sorted objects. */
  readonly shadowLayer = new Container({ eventMode: 'none' });
  readonly objects = new DepthLayer();
  /** The light map (ambient and light pools), over the room and under the markers. */
  readonly lightLayer = new Container({ eventMode: 'none' });
  /** Dust specks floating in the light pools. */
  readonly airLayer = new Container({ eventMode: 'none' });
  /** Markers above everything in the room (the farm's ripe markers, step 9b). */
  readonly markerLayer = new Container({ eventMode: 'none' });
  /** Build mode ghost, above everything. */
  readonly ghostLayer = new Container({ eventMode: 'none' });

  constructor() {
    this.rugLayer.addChild(this.rugs.container);
    this.world.addChild(
      this.floorLayer,
      this.rugLayer,
      this.gridLayer,
      this.debugLayer,
      this.wallLayer,
      this.shadowLayer,
      this.objects.container,
      this.lightLayer,
      this.airLayer,
      this.markerLayer,
      this.ghostLayer,
    );
  }

  /** Call once per frame: re-sorts the rug and object lists when something moved. */
  update(): void {
    this.rugs.update();
    this.objects.update();
  }

  private doors: { c: Container; x: number; y: number }[] = [];

  /** Shows the cellar door open while the avatar is near it (call per frame; null = nobody). */
  updateDoors(avatar: { x: number; y: number } | null): void {
    for (const d of this.doors) setDoorOpen(d.c, doorOpenNear(d.x, d.y, avatar));
  }

  setRoom(room: Room): void {
    this.doors = [];
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
    // Cells painted with another floor style (step BG1): runs of the same style along a row.
    for (const run of paintedRuns(room)) {
      const t = new TilingSprite({ texture: floorTexture(run.style), width: run.w, height: BUILD_CELL });
      t.position.set(run.x, run.y);
      t.tilePosition.set(-run.x, -run.y);
      this.floorLayer.addChild(t);
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
    // Inn doors (step MB-3): the doorway in the back wall band above each door spot.
    for (const d of innDoorSpots(room)) {
      const door = { id: d.id, x: d.spot.x + d.spot.w / 2, y: d.spot.y, w: d.spot.w };
      this.doors.push({ c: drawInnDoor(this.wallLayer, door), x: door.x, y: door.y });
      const spill = doorSpill(door);
      if (spill) this.floorLayer.addChild(spill);
    }
  }
}

function fillRect(g: Graphics, r: Rect, color: string): void {
  if (r.w > 0 && r.h > 0) g.rect(r.x, r.y, r.w, r.h).fill(color);
}

/** Painted floor cells joined into runs of one style along a row: { x, y, w } in px. */
function paintedRuns(room: Room): { x: number; y: number; w: number; style: string }[] {
  if (!room.floorCells) return [];
  const out: { x: number; y: number; w: number; style: string }[] = [];
  for (const { c, r } of floorCellList(room)) {
    const style = floorStyleAt(room, c, r);
    if (style === room.floorStyle) continue;
    const last = out[out.length - 1];
    if (last && last.style === style && last.y === r * BUILD_CELL && last.x + last.w === c * BUILD_CELL) last.w += BUILD_CELL;
    else out.push({ x: c * BUILD_CELL, y: r * BUILD_CELL, w: BUILD_CELL, style });
  }
  return out;
}
