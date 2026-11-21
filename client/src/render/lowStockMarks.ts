// 3e / OB (21 Nov): a small code-drawn dot over a tap stand or the serving hatch that runs low (butter) or ran dry (red), from TavernView.lowStock
// (shared/src/refill.ts lowStockMarks). Placeholder art: the artist may replace the dot with a sprite (HOOK: same place, markerLayer).
// Rendering only, no rules.

import { Graphics } from 'pixi.js';
import { PALETTE, type FurnitureItem } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import type { RoomView } from './roomView.ts';

/** Where the dot of a piece sits (world px): centred over the piece, this high above its anchor. Pure (tested). */
export function lowStockDotAt(item: Pick<FurnitureItem, 'x' | 'y'>, lift: number): { x: number; y: number } {
  return { x: Math.round(item.x), y: Math.round(item.y - lift) };
}

const LOW = parseInt((PALETTE[11] ?? '#fee761').slice(1), 16);
const EMPTY = parseInt((PALETTE[8] ?? '#e43b44').slice(1), 16);
const OUTLINE = parseInt((DARK_WARM ?? '#3e2731').slice(1), 16);

export class LowStockMarks {
  private readonly g = new Graphics();
  private key = '';

  constructor(view: RoomView) {
    this.g.eventMode = 'none';
    view.markerLayer.addChild(this.g);
  }

  /** Draws one 4 x 4 px dot (1 px outline) per mark; an empty list hides them. `lift` = px above the piece's anchor (its drawn top). */
  set(marks: readonly { item: FurnitureItem; level: 'low' | 'empty'; lift: number }[]): void {
    const key = marks.map((m) => `${m.item.uid},${m.item.x},${m.item.y},${m.level},${m.lift}`).join(';');
    if (key === this.key) return;
    this.key = key;
    this.g.clear();
    for (const m of marks) {
      const p = lowStockDotAt(m.item, m.lift);
      this.g.rect(p.x - 3, p.y - 3, 6, 6).fill(OUTLINE);
      this.g.rect(p.x - 2, p.y - 2, 4, 4).fill(m.level === 'empty' ? EMPTY : LOW);
    }
  }
}
