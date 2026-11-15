// Painting floors per cell (step BG1). The player picks an unlocked floor style as the brush, then
// taps one cell or drags a rectangle of cells; letting go paints it (hooks.paint asks the GameAPI,
// which keeps the unlocked-forever rule). While dragging, the rectangle shows on the floor. The
// rules (which cells are floor, what painting does) live in shared/room.ts; this file keeps the
// session and draws the preview.

import { Container, Graphics } from 'pixi.js';
import { BUILD_CELL, PALETTE, cellOf, cellOnFloor, type Point, type Room } from '@pixel-hotel/shared';

type Cell = { c: number; r: number };

const BRUSH_COLOR = PALETTE[12];
const BAD_COLOR = PALETTE[8];

export interface FloorPaintHooks {
  getRoom(): Room;
  /** Asks the GameAPI to paint the cells; true if something was painted. */
  paint(from: Cell, to: Cell, styleId: string): Promise<boolean>;
  /** The mode started, ended, or the brush changed. */
  onChange(): void;
}

export class FloorPaint {
  private brushId: string | null = null;
  private from: Cell | null = null;
  private to: Cell | null = null;
  readonly container = new Container({ eventMode: 'none' });
  private readonly preview = new Graphics();

  constructor(private readonly hooks: FloorPaintHooks) {
    this.container.addChild(this.preview);
  }

  get active(): boolean {
    return this.brushId !== null;
  }

  /** The floor style being painted with, or null when not painting. */
  get brush(): string | null {
    return this.brushId;
  }

  start(styleId: string): void {
    this.brushId = styleId;
    this.clearPreview();
    this.hooks.onChange();
  }

  /** Picks another brush while painting. */
  setBrush(styleId: string): void {
    if (this.brushId === null) return;
    this.brushId = styleId;
    this.hooks.onChange();
  }

  end(): void {
    if (this.brushId === null) return;
    this.brushId = null;
    this.clearPreview();
    this.hooks.onChange();
  }

  /** A tap paints the one cell under it. */
  tap(world: Point): void {
    const c = cellOf(world);
    void this.commit(c, c);
  }

  /** A one-finger / left drag paints the rectangle from the cell it started on to the cell it ends on. */
  drag(phase: 'start' | 'move' | 'end', world: Point): void {
    if (this.brushId === null) return;
    const here = cellOf(world);
    if (phase === 'start') this.from = here;
    if (!this.from) return;
    this.to = here;
    if (phase === 'end') {
      const [a, b] = [this.from, here];
      this.from = null;
      this.to = null;
      this.clearPreview();
      void this.commit(a, b);
      return;
    }
    this.drawPreview(this.from, here);
  }

  private async commit(a: Cell, b: Cell): Promise<void> {
    const id = this.brushId;
    if (id === null) return;
    await this.hooks.paint(a, b, id);
  }

  private clearPreview(): void {
    this.from = null;
    this.to = null;
    this.preview.clear();
  }

  private drawPreview(a: Cell, b: Cell): void {
    const room = this.hooks.getRoom();
    this.preview.clear();
    for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
      for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) {
        const ok = cellOnFloor(room, c, r);
        this.preview.rect(c * BUILD_CELL, r * BUILD_CELL, BUILD_CELL, BUILD_CELL).fill({ color: ok ? BRUSH_COLOR : BAD_COLOR, alpha: ok ? 0.35 : 0.15 });
      }
    }
  }
}
