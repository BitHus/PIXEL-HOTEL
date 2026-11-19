// The faint build grid (step BG1): thin lines around every floor cell, drawn on the floor under the
// items while the player places furniture or paints floors. Drawing only; the cells come from
// shared (floorCellList). Hidden unless asked for.

import { Container, Graphics } from 'pixi.js';
import { BUILD_CELL, PALETTE, floorCellList, kitchenZone, type Rect, type Room } from '@pixel-hotel/shared';

/** Line colour (cream) and how strong it is; the grid must stay a hint, never the picture. */
const LINE_COLOR = PALETTE[2];
const LINE_ALPHA = 0.22;
/** The kitchen zone (step T1, staff only) is a faint warm tint under the grid: it must stay a hint too. */
const KITCHEN_COLOR = PALETTE[9];
const KITCHEN_ALPHA = 0.16;

/** A2: the faint guides for the pieces that are NOT on the cell grid: the back wall bands (wall items hang anywhere on them) and the tops of surfaces (small decor sits anywhere on them). */
const AID_COLOR = PALETTE[2];

export class CellGrid {
  readonly container = new Container({ eventMode: 'none' });
  /** Above the walls and the objects (the wall bands and the bar tops are drawn over the things they belong to); the caller adds it to the room view's marker layer. */
  readonly aids = new Container({ eventMode: 'none' });
  private readonly aidLines = new Graphics();
  private readonly lines = new Graphics();
  private readonly kitchen = new Graphics();

  constructor() {
    this.container.addChild(this.kitchen, this.lines);
    this.aids.addChild(this.aidLines);
    this.container.visible = false;
    this.aids.visible = false;
  }

  /** Draws the wall bands and the surface tops (null lists = hide them); a band is a hint of where wall pieces hang, a top where small decor sits. */
  setAids(bands: readonly Rect[], tops: readonly Rect[]): void {
    this.aidLines.clear();
    for (const r of bands) this.aidLines.rect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1).fill({ color: AID_COLOR, alpha: 0.08 }).stroke({ color: AID_COLOR, width: 1, alpha: 0.35 });
    for (const r of tops) this.aidLines.rect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1).stroke({ color: AID_COLOR, width: 1, alpha: 0.45 });
    this.aids.visible = bands.length + tops.length > 0;
  }

  /** Redraws the lines for a room (call when the room or its level changes). */
  setRoom(room: Room): void {
    this.lines.clear();
    this.kitchen.clear();
    const zone = kitchenZone(room);
    if (zone) this.kitchen.rect(zone.x, zone.y, zone.w, zone.h).fill({ color: KITCHEN_COLOR, alpha: KITCHEN_ALPHA });
    for (const { c, r } of floorCellList(room)) this.lines.rect(c * BUILD_CELL + 0.5, r * BUILD_CELL + 0.5, BUILD_CELL - 1, BUILD_CELL - 1);
    this.lines.stroke({ color: LINE_COLOR, width: 1, alpha: LINE_ALPHA });
  }

  set visible(on: boolean) {
    this.container.visible = on;
  }

  get visible(): boolean {
    return this.container.visible;
  }
}
