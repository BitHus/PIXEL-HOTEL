// Small inventory icons (step 5): until real 32x32 icons exist, an item's icon is a small version
// of its placeholder boxes (facing down), and a material's icon is one small box in its color.
// Drawn once per type on a canvas and cached as a data URL.

import { PALETTE, getFurnitureType, getMaterialType, type MaterialId } from '@pixel-hotel/shared';
import { furnitureRects, type ArtRect } from '../render/furnitureArt.ts';
import { DARK_WARM } from '../render/bareStyles.ts';
import { shade } from '../render/colors.ts';

/** Icon canvases are drawn at this size (px) and shown at the slot's icon size by CSS. */
export const ICON_CANVAS = 64;

/**
 * Fits rectangles into a size x size square (centered, scaled down if needed, never up), on whole
 * pixels. Every rectangle keeps at least 1 px.
 */
export function fitRects(rects: readonly ArtRect[], size: number): ArtRect[] {
  if (rects.length === 0) return [];
  const minX = Math.min(...rects.map((r) => r[0]));
  const minY = Math.min(...rects.map((r) => r[1]));
  const maxX = Math.max(...rects.map((r) => r[0] + r[2]));
  const maxY = Math.max(...rects.map((r) => r[1] + r[3]));
  const s = Math.min(1, size / (maxX - minX), size / (maxY - minY));
  const offX = (size - (maxX - minX) * s) / 2;
  const offY = (size - (maxY - minY) * s) / 2;
  return rects.map(([x, y, w, h, c]) => {
    const x0 = Math.round((x - minX) * s + offX);
    const y0 = Math.round((y - minY) * s + offY);
    const x1 = Math.max(x0 + 1, Math.round((x + w - minX) * s + offX));
    const y1 = Math.max(y0 + 1, Math.round((y + h - minY) * s + offY));
    return [x0, y0, x1 - x0, y1 - y0, c];
  });
}

const cache = new Map<string, string>();

function render(key: string, rects: readonly ArtRect[]): string {
  const hit = cache.get(key);
  if (hit) return hit;
  const canvas = document.createElement('canvas');
  canvas.width = ICON_CANVAS;
  canvas.height = ICON_CANVAS;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    for (const [x, y, w, h, c] of fitRects(rects, ICON_CANVAS)) {
      ctx.fillStyle = c;
      ctx.fillRect(x, y, w, h);
    }
  }
  const url = canvas.toDataURL();
  cache.set(key, url);
  return url;
}

export function furnitureIconUrl(typeId: string): string {
  return render(`f:${typeId}`, furnitureRects(getFurnitureType(typeId), 'down'));
}

export function materialIconUrl(id: MaterialId): string {
  const color = PALETTE[getMaterialType(id).color] ?? PALETTE[0];
  // One small box: a top face and a darker front face with a dark outline.
  const rects: ArtRect[] = [
    [-1, -1, 26, 22, DARK_WARM],
    [0, 0, 24, 8, color],
    [0, 8, 24, 12, shade(color, 0.72)],
  ];
  return render(`m:${id}`, rects);
}
