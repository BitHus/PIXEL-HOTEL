// RUN 5: where chat bubbles go on screen (pure, no DOM). Bubbles of one avatar stack upward above its head (newest lowest); a bubble never
// overlaps a bubble of ANOTHER avatar (it moves up above it), never covers an order icon (moves up above it) and slides left of the button column.

export interface BubbleIn {
  avatarId: number;
  /** Screen point above the head (CSS px). */
  headX: number;
  headY: number;
  w: number;
  h: number;
}

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface BubbleOut {
  x: number;
  /** Top of the bubble. */
  y: number;
  /** The lowest bubble of its avatar (draws the tail). */
  tail: boolean;
}

/** `list` newest first; returns one position per bubble in the same order. */
export function placeBubbles(list: readonly BubbleIn[], screenW: number, gap: number, orders: readonly Rect[] = [], col: Rect | null = null): BubbleOut[] {
  const bottom = new Map<number, number>();
  const placed: (Rect & { avatarId: number })[] = [];
  return list.map((b) => {
    const tail = !bottom.has(b.avatarId);
    let y = bottom.get(b.avatarId) ?? b.headY;
    let x = Math.min(Math.max(b.headX - b.w / 2, 4), screenW - b.w - 4);
    for (const o of orders) if (x < o.right && x + b.w > o.left && y > o.top && y - b.h < o.bottom) y = Math.min(y, o.top - 2);
    // RUN 6 (8): the whole strip the button column stands in is kept free (the column rect alone let bubbles clamped at the screen edge sit on its last buttons).
    if (col && x + b.w > col.left - 4) x = Math.max(4, col.left - b.w - 4);
    // Another avatar's bubble in the way: go up above it (repeat until clear; at most once per placed bubble).
    for (let n = 0; n <= placed.length; n++) {
      const hit = placed.find((p) => p.avatarId !== b.avatarId && x < p.right && x + b.w > p.left && y - b.h < p.bottom + gap && y > p.top - gap);
      if (!hit) break;
      y = hit.top - gap;
    }
    placed.push({ avatarId: b.avatarId, left: x, right: x + b.w, top: y - b.h, bottom: y });
    bottom.set(b.avatarId, y - b.h - gap);
    return { x, y: y - b.h, tail };
  });
}

export interface NearCand {
  key: number;
  x: number;
  y: number;
}

/** The `max` candidates nearest to (cx, cy), with hysteresis: one that was shown before stays unless a newcomer is clearly nearer (distance x `keep`), so two
 * heads of equal distance never swap places frame after frame while the camera moves. */
export function pickNearest(cands: readonly NearCand[], cx: number, cy: number, max: number, prev: ReadonlySet<number>, keep = 0.8): Set<number> {
  const d = (c: NearCand): number => Math.hypot(c.x - cx, c.y - cy) * (prev.has(c.key) ? keep : 1);
  return new Set([...cands].sort((a, b) => d(a) - d(b) || a.key - b.key).slice(0, max).map((c) => c.key));
}

/** Rounds a screen coordinate to whole DEVICE pixels (the canvas camera snaps to them; whole CSS px made the text step against the sprite at dpr 2). */
export function snapToDevice(v: number, dpr: number): number {
  return Math.round(v * dpr) / dpr;
}
