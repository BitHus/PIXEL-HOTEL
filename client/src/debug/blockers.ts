// Debug: Blockers mode (step 3). While it is on, a one-finger / left drag on the floor draws a
// blocking rectangle, and the blocked nav cells are shown as a faint overlay. The rectangles
// stay (and keep blocking) when the mode is turned off. Debug only, not a game feature.

import { Container, Graphics } from 'pixi.js';
import {
  DEBUG_BLOCKER_MIN_PX,
  DEBUG_NAV_OVERLAY_ALPHA,
  PALETTE,
  floorRect,
  isCellFree,
  type NavGrid,
  type Point,
  type Rect,
  type Room,
} from '@pixel-hotel/shared';
import { DARK_WARM } from '../render/bareStyles.ts';

const BLOCKER_FILL = PALETTE[22];
const PREVIEW_FILL = PALETTE[10];
const OVERLAY_FILL = PALETTE[26];

export class BlockersDebug {
  /** Goes on the floor level of the room view (in world px). */
  readonly container = new Container();
  readonly rects: Rect[] = [];
  on = false;
  private readonly rectGfx = new Graphics();
  private readonly overlayGfx = new Graphics();
  private readonly previewGfx = new Graphics();
  private dragStart: Point | null = null;

  constructor(
    private readonly room: Room,
    /** Called after the list of rectangles changed. */
    private readonly onChange: () => void,
  ) {
    this.container.addChild(this.rectGfx, this.overlayGfx, this.previewGfx);
    this.overlayGfx.visible = false;
  }

  setOn(on: boolean): void {
    this.on = on;
    this.overlayGfx.visible = on;
    if (!on) this.cancelDraw();
  }

  clear(): void {
    this.rects.length = 0;
    this.redrawRects();
    this.onChange();
  }

  /** Drag phases from the input layer, in world px. */
  draw(phase: 'start' | 'move' | 'end', world: Point): void {
    if (phase === 'start') this.dragStart = world;
    if (!this.dragStart) return;
    const r = this.rectFrom(this.dragStart, world);
    this.previewGfx.clear();
    if (phase !== 'end') {
      if (r) this.previewGfx.rect(r.x, r.y, r.w, r.h).fill({ color: PREVIEW_FILL, alpha: 0.5 });
      return;
    }
    this.dragStart = null;
    if (r && r.w >= DEBUG_BLOCKER_MIN_PX && r.h >= DEBUG_BLOCKER_MIN_PX) {
      this.rects.push(r);
      this.redrawRects();
      this.onChange();
    }
  }

  /** Redraws the faint overlay of blocked nav cells. */
  showGrid(grid: NavGrid): void {
    const g = this.overlayGfx.clear();
    for (let r = 0; r < grid.rows; r++) {
      for (let c = 0; c < grid.cols; c++) {
        if (!isCellFree(grid, c, r)) g.rect(c * grid.cell, r * grid.cell, grid.cell, grid.cell);
      }
    }
    g.fill({ color: OVERLAY_FILL, alpha: DEBUG_NAV_OVERLAY_ALPHA });
  }

  private cancelDraw(): void {
    this.dragStart = null;
    this.previewGfx.clear();
  }

  /** The rectangle between two points, in whole px, clipped to the floor. */
  private rectFrom(a: Point, b: Point): Rect | null {
    const f = floorRect(this.room);
    const x0 = Math.max(f.x, Math.round(Math.min(a.x, b.x)));
    const y0 = Math.max(f.y, Math.round(Math.min(a.y, b.y)));
    const x1 = Math.min(f.x + f.w, Math.round(Math.max(a.x, b.x)));
    const y1 = Math.min(f.y + f.h, Math.round(Math.max(a.y, b.y)));
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  private redrawRects(): void {
    const g = this.rectGfx.clear();
    for (const r of this.rects) g.rect(r.x, r.y, r.w, r.h).fill(BLOCKER_FILL).stroke({ color: DARK_WARM, width: 1, alignment: 1 });
  }
}
