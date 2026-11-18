// Furniture thumbnails from the real sprite (tester run 9): the pure parts. The front (down) PNG is trimmed to its opaque pixels and fitted
// in the slot (whole-number scale up, nearest-neighbour steps down for big pieces). The canvas work lives in ui/itemIcon.ts.

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box around every pixel with alpha > 0 in RGBA data of w x h, or null when the picture is empty. */
export function trimBounds(rgba: ArrayLike<number>, w: number, h: number): Box | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if ((rgba[(y * w + x) * 4 + 3] ?? 0) > 0) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/**
 * Where a trimmed picture of bw x bh goes in a size x size slot (with `pad` px free around): scaled by a whole factor when it grows (at most 2x, so a
 * small prop does not turn into a blur of big pixels), by a fraction when it must shrink (nearest-neighbour), centred on whole pixels.
 */
export function fitInSlot(bw: number, bh: number, size: number, pad = 1): Box {
  const room = size - pad * 2;
  const ratio = Math.min(room / bw, room / bh);
  const scale = ratio >= 1 ? Math.min(2, Math.floor(ratio)) : ratio;
  const w = Math.max(1, Math.round(bw * scale));
  const h = Math.max(1, Math.round(bh * scale));
  return { x: Math.floor((size - w) / 2), y: Math.floor((size - h) / 2), w, h };
}
