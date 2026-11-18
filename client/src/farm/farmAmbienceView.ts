// Draws the farm's looks that are not rules (see farmAmbience.ts): per-cell grass variety over the floor tile and the
// decor (bushes, flowers, stones, mushrooms, tufts, trees along the back hedge). RENDERING ONLY: nothing here is state or
// reaches the nav grid; everything is eventMode 'none'. A decor spot hides while its cell holds soil, a block or a plant.

import { Container, Graphics, Rectangle, Sprite, Texture } from 'pixi.js';
import { BUILD_CELL, PALETTE, blockStack, cellOnFloor, floorStyleAt, plantInCell, type Room } from '@pixel-hotel/shared';
import type { RoomView } from '../render/roomView.ts';
import { spriteTexture } from '../render/spriteStore.ts';
import { drawBush, drawFlower, drawMushroom, drawStone, drawTree, drawTuft } from '../lakeside/lakesideArt.ts';
import { GRASS_TINT_ALPHA, farmDecorSpots, grassRoll, type FarmDecorSpot } from './farmAmbience.ts';

const UID_BASE = -3_000_000;
const GRASS_IDS = ['grass', 'grass_b', 'grass_c'] as const;

interface DecorView {
  spot: FarmDecorSpot;
  node: Container;
  shown: boolean;
}

export class FarmAmbienceView {
  private readonly ground = new Container({ eventMode: 'none' });
  private decor: DecorView[] = [];
  private roomKey = "";
  private cellsRef: unknown = null;
  private blocksRef: unknown = null;
  private plantsRef: unknown = null;
  private readonly quarters = new Map<string, Texture>();

  constructor(private readonly view: RoomView) {
    view.rugLayer.addChildAt(this.ground, 0);
  }

  /** Call every frame with the room (cheap: it only redraws when the room's floor, blocks or plants changed). */
  sync(room: Room): void {
    if (room.kind !== 'farm') {
      this.clear();
      return;
    }
    const newRoom = `${room.id}:${room.w}x${room.h}` !== this.roomKey;
    if (newRoom) {
      this.clear();
      this.roomKey = `${room.id}:${room.w}x${room.h}`;
      for (const spot of farmDecorSpots(room)) this.decor.push(this.makeDecor(spot));
    }
    if (newRoom || room.floorCells !== this.cellsRef) {
      this.cellsRef = room.floorCells;
      this.drawGround(room);
    }
    if (newRoom || room.blocks !== this.blocksRef || room.plants !== this.plantsRef || room.floorCells !== this.cellsRef) {
      this.blocksRef = room.blocks;
      this.plantsRef = room.plants;
      for (const d of this.decor) this.setShown(d, !this.cellUsed(room, d.spot));
    }
  }

  private cellUsed(room: Room, s: FarmDecorSpot): boolean {
    return floorStyleAt(room, s.c, s.r) !== room.floorStyle || blockStack(room, s.c, s.r).length > 0 || plantInCell(room, s.c, s.r) !== null;
  }

  private setShown(d: DecorView, on: boolean): void {
    if (d.shown === on) return;
    d.shown = on;
    if (on) this.view.objects.add(d.node, { y: d.spot.y, x: d.spot.x, uid: UID_BASE - d.spot.c * 1000 - d.spot.r });
    else this.view.objects.remove(d.node);
  }

  private makeDecor(spot: FarmDecorSpot): DecorView {
    const node = new Container({ eventMode: 'none' });
    node.position.set(spot.x, spot.y);
    const v = spot.variant;
    const art =
      spot.kind === 'tree' ? drawTree('tree', 0, v % 6)
      : spot.kind === 'bush' ? drawBush(v)
      : spot.kind === 'flower' ? drawFlower(v % 4, v >> 2)
      : spot.kind === 'stone' ? drawStone(v)
      : spot.kind === 'mushroom' ? drawMushroom(v)
      : drawTuft(v);
    art.eventMode = 'none';
    node.addChild(art);
    return { spot, node, shown: false };
  }

  /** A quarter (32 x 32) of a 64 px grass tile. */
  private quarter(id: string, q: number): Texture | null {
    const base = spriteTexture('floors', id);
    if (!base) return null;
    const key = `${id}:${q}`;
    let t = this.quarters.get(key);
    if (!t) {
      const f = base.frame;
      t = new Texture({ source: base.source, frame: new Rectangle(f.x + (q & 1) * BUILD_CELL, f.y + (q >> 1) * BUILD_CELL, BUILD_CELL, BUILD_CELL) });
      this.quarters.set(key, t);
    }
    return t;
  }

  private drawGround(room: Room): void {
    for (const c of this.ground.removeChildren()) c.destroy();
    const variants = GRASS_IDS.filter((id) => spriteTexture('floors', id)).length || 1;
    const have = GRASS_IDS.filter((id) => spriteTexture('floors', id));
    const tint = new Graphics();
    const cols = Math.ceil(room.w / BUILD_CELL);
    const rows = Math.ceil(room.h / BUILD_CELL);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (!cellOnFloor(room, c, r) || floorStyleAt(room, c, r) !== 'grass') continue;
        const roll = grassRoll(room.id, c, r, variants);
        const id = have[roll.variant] ?? 'grass';
        if (roll.shift !== 0 || roll.variant !== 0) {
          const tex = this.quarter(id, (((c & 1) + (r & 1) * 2) + roll.shift) & 3);
          if (tex) {
            const s = new Sprite(tex);
            s.position.set(c * BUILD_CELL, r * BUILD_CELL);
            s.eventMode = 'none';
            this.ground.addChild(s);
          }
        }
        if (roll.tint !== 0) {
          tint.rect(c * BUILD_CELL, r * BUILD_CELL, BUILD_CELL, BUILD_CELL).fill({ color: roll.tint > 0 ? PALETTE[12]! : PALETTE[15]!, alpha: GRASS_TINT_ALPHA });
        }
      }
    }
    this.ground.addChild(tint);
  }

  private clear(): void {
    for (const d of this.decor) {
      if (d.shown) this.view.objects.remove(d.node);
      d.node.destroy({ children: true });
    }
    this.decor = [];
    for (const c of this.ground.removeChildren()) c.destroy();
    this.roomKey = "";
    this.cellsRef = this.blocksRef = this.plantsRef = null;
  }
}
