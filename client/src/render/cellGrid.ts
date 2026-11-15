// The faint build grid (step BG1): thin lines around every floor cell, drawn on the floor under the
// items while the player places furniture or paints floors. Drawing only; the cells come from
// shared (floorCellList). Hidden unless asked for.

import { Container, Graphics } from 'pixi.js';
import { BUILD_CELL, PALETTE, floorCellList, type Room } from '@pixel-hotel/shared';

/** Line colour (cream) and how strong it is; the grid must stay a hint, never the picture. */
const LINE_COLOR = PALETTE[2];
const LINE_ALPHA = 0.22;

export class CellGrid {
  readonly container = new Container({ eventMode: 'none' });
  private readonly lines = new Graphics();

  constructor() {
    this.container.addChild(this.lines);
    this.container.visible = false;
  }

  /** Redraws the lines for a room (call when the room or its level changes). */
  setRoom(room: Room): void {
    this.lines.clear();
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
