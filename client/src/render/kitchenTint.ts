// The faint kitchen tint (ART-T1): a warm wash over the staff-only kitchen cells, like the build
// grid it is only a hint. The caller (game/, Room panel) hands the zone as cell rectangles in
// WORLD px (x, y, w, h; one rect per zone rectangle, cell sizes are fine) and shows or hides the
// layer. Draws nothing for an empty list. Drawing only, no rules.

import { Container, Graphics } from 'pixi.js';
import { PALETTE, type Rect } from '@pixel-hotel/shared';

/** Tint colour (orange glow) and strength: a hint, never the picture. */
const TINT_COLOR = PALETTE[9];
const TINT_ALPHA = 0.16;
const EDGE_ALPHA = 0.5;

/**
 * Redraws the kitchen tint into `layer` (it clears the layer first; a Container such as
 * RoomView.gridLayer or a child of it). Call again when the zone or the room changes; pass [] to clear.
 */
export function drawKitchenTint(layer: Container, rects: readonly Rect[]): void {
  layer.removeChildren().forEach((c) => c.destroy());
  if (rects.length === 0) return;
  const g = new Graphics();
  for (const r of rects) g.rect(r.x, r.y, r.w, r.h);
  g.fill({ color: TINT_COLOR, alpha: TINT_ALPHA });
  // A dashed edge (2 px on, 2 px off) so the zone reads on any floor colour.
  const e = new Graphics();
  for (const r of rects) {
    for (let x = r.x; x < r.x + r.w; x += 4) {
      e.rect(x, r.y, Math.min(2, r.x + r.w - x), 1);
      e.rect(x, r.y + r.h - 1, Math.min(2, r.x + r.w - x), 1);
    }
    for (let y = r.y; y < r.y + r.h; y += 4) {
      e.rect(r.x, y, 1, Math.min(2, r.y + r.h - y));
      e.rect(r.x + r.w - 1, y, 1, Math.min(2, r.y + r.h - y));
    }
  }
  e.fill({ color: TINT_COLOR, alpha: EDGE_ALPHA });
  layer.addChild(g, e);
}
