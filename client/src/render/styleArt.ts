// Floor and wall styles drawn in code (placeholder art, step 7). Floors are seamless 64x64
// textures; walls are a 64x64 piece of the 64 px wall band that repeats sideways. Warm palette
// colours only; the 'bare' styles stay plain and dull on purpose (bareStyles.ts).

import { Texture } from 'pixi.js';
import { FLOOR_TEXTURE_SIZE, PALETTE, WALL_BAND } from '@pixel-hotel/shared';
import { BARE_WALL_COLOR, BARE_WALL_EDGE, BORDER_COLOR, createBareFloorTexture } from './bareStyles.ts';
import { desaturate, shade } from './colors.ts';

type Paint = (ctx: CanvasRenderingContext2D, size: number) => void;

const rect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string): void => {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
};

const FLOORS: Record<string, Paint> = {
  wood_planks: (ctx, n) => {
    const base = PALETTE[4];
    const rows = 4;
    const h = n / rows;
    for (let r = 0; r < rows; r++) {
      rect(ctx, 0, r * h, n, h, shade(base, r % 2 ? 0.95 : 1.02));
      rect(ctx, 0, r * h + h - 1, n, 1, shade(base, 0.62));
      // Plank ends, staggered per row (all inside the tile, so it repeats).
      const off = (r * 24) % n;
      rect(ctx, off, r * h, 1, h - 1, shade(base, 0.62));
      rect(ctx, (off + 40) % n, r * h + 5, 6, 1, shade(base, 0.85));
      rect(ctx, (off + 12) % n, r * h + 10, 4, 1, shade(base, 1.1));
    }
  },
  stone_tiles: (ctx, n) => {
    const base = desaturate(PALETTE[3], 0.65);
    const t = n / 2;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        rect(ctx, x * t, y * t, t, t, shade(base, (x + y) % 2 ? 0.92 : 1));
        rect(ctx, x * t, y * t, t, 1, shade(base, 1.12));
        rect(ctx, x * t, y * t, 1, t, shade(base, 1.08));
        rect(ctx, x * t, y * t + t - 1, t, 1, shade(base, 0.6));
        rect(ctx, x * t + t - 1, y * t, 1, t, shade(base, 0.6));
      }
    }
    rect(ctx, 9, 13, 3, 1, shade(base, 0.8));
    rect(ctx, 44, 40, 2, 2, shade(base, 0.82));
  },
  red_carpet: (ctx, n) => {
    const base = PALETTE[7];
    rect(ctx, 0, 0, n, n, base);
    const dot = shade(base, 0.8);
    for (let y = 0; y < n; y += 16) {
      for (let x = 0; x < n; x += 16) {
        const o = (y / 16) % 2 ? 8 : 0;
        rect(ctx, (x + o + 7) % n, y + 6, 2, 4, dot);
        rect(ctx, (x + o + 6) % n, y + 7, 4, 2, dot);
      }
    }
    rect(ctx, 0, 0, n, 1, shade(base, 1.08));
  },
  // The farm's ground (step 9b): soft green with tufts and a few flowers, seamless.
  grass: (ctx, n) => {
    const base = PALETTE[13];
    rect(ctx, 0, 0, n, n, base);
    const tufts: [number, number][] = [[5, 7], [22, 3], [41, 12], [57, 25], [12, 30], [33, 37], [50, 49], [8, 52], [27, 58], [44, 61]];
    for (const [x, y] of tufts) {
      rect(ctx, x, y, 1, 2, shade(base, 1.25));
      rect(ctx, x + 2, y - 1, 1, 3, shade(base, 1.25));
      rect(ctx, x + 1, y + 2, 3, 1, shade(base, 0.8));
    }
    for (const [x, y] of [[17, 18], [53, 6], [38, 50]] as const) rect(ctx, x, y, 1, 1, PALETTE[11]);
    rect(ctx, 30, 22, 2, 1, shade(base, 0.85));
  },
};

const WALLS: Record<string, Paint> = {
  // The farm's back band (step 9b): a hedge with a wooden fence in front of it.
  hedge: (ctx, n) => {
    const leaf = PALETTE[14];
    rect(ctx, 0, 0, n, WALL_BAND, shade(PALETTE[15], 1));
    rect(ctx, 0, 6, n, WALL_BAND - 6, leaf);
    for (let x = 0; x < n; x += 8) {
      rect(ctx, x + 1, 4 + ((x / 8) % 2) * 2, 6, 3, leaf);
      rect(ctx, x + 2, 8 + ((x / 8) % 3) * 9, 3, 2, shade(leaf, 1.3));
      rect(ctx, x + 5, 14 + ((x / 8) % 2) * 11, 2, 2, shade(leaf, 0.75));
    }
    // The fence: two rails and posts every 32 px.
    const wood = PALETTE[4];
    rect(ctx, 0, WALL_BAND - 26, n, 3, wood);
    rect(ctx, 0, WALL_BAND - 17, n, 3, wood);
    rect(ctx, 0, WALL_BAND - 23, n, 1, shade(wood, 0.65));
    rect(ctx, 0, WALL_BAND - 14, n, 1, shade(wood, 0.65));
    for (let x = 4; x < n; x += 32) {
      rect(ctx, x, WALL_BAND - 32, 4, 26, shade(wood, 1.05));
      rect(ctx, x + 3, WALL_BAND - 32, 1, 26, shade(wood, 0.65));
    }
  },
  plaster: (ctx, n) => {
    const base = shade(PALETTE[2], 0.92);
    rect(ctx, 0, 0, n, WALL_BAND, base);
    for (const [x, y] of [[7, 9], [30, 22], [51, 14], [18, 38], [44, 33]] as const) rect(ctx, x, y, 2, 1, shade(base, 0.9));
    // Wooden skirting board.
    rect(ctx, 0, WALL_BAND - 12, n, 8, PALETTE[5]);
    rect(ctx, 0, WALL_BAND - 12, n, 1, PALETTE[4]);
  },
  wood_panels: (ctx, n) => {
    const base = PALETTE[5];
    rect(ctx, 0, 0, n, WALL_BAND, base);
    for (let x = 0; x < n; x += 16) {
      rect(ctx, x, 0, 1, WALL_BAND, shade(base, 0.7));
      rect(ctx, x + 1, 0, 1, WALL_BAND, shade(base, 1.18));
      rect(ctx, x + 5, 14, 6, 1, shade(base, 0.85));
    }
    rect(ctx, 0, 20, n, 2, PALETTE[4]);
  },
  brick: (ctx, n) => {
    const mortar = desaturate(PALETTE[3], 0.5);
    rect(ctx, 0, 0, n, WALL_BAND, mortar);
    const bh = 8;
    for (let r = 0; r * bh < WALL_BAND; r++) {
      const off = r % 2 ? 8 : 0;
      for (let x = -16; x < n; x += 16) {
        const c = shade(PALETTE[0], 0.85 + ((r * 7 + x) % 3) * 0.07);
        const x0 = Math.max(0, x + off);
        const x1 = Math.min(n, x + off + 15);
        if (x1 > x0) rect(ctx, x0, r * bh, x1 - x0, bh - 1, c);
      }
    }
  },
};

function canvasTexture(w: number, h: number, paint: Paint): Texture {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  paint(ctx, w);
  return Texture.from(canvas);
}

const floorCache = new Map<string, Texture>();
const wallCache = new Map<string, Texture>();

/** The seamless floor texture of a style (unknown styles look bare). */
export function floorTexture(id: string): Texture {
  let t = floorCache.get(id);
  if (!t) {
    const paint = FLOORS[id];
    t = paint ? canvasTexture(FLOOR_TEXTURE_SIZE, FLOOR_TEXTURE_SIZE, paint) : createBareFloorTexture();
    floorCache.set(id, t);
  }
  return t;
}

/** A piece of the wall band of a style, repeating sideways, with the dark edge at the bottom. */
export function wallTexture(id: string): Texture {
  let t = wallCache.get(id);
  if (!t) {
    const paint = WALLS[id];
    t = canvasTexture(FLOOR_TEXTURE_SIZE, WALL_BAND, (ctx, n) => {
      if (paint) paint(ctx, n);
      else rect(ctx, 0, 0, n, WALL_BAND, BARE_WALL_COLOR);
      rect(ctx, 0, WALL_BAND - BARE_WALL_EDGE, n, BARE_WALL_EDGE, BORDER_COLOR);
    });
    wallCache.set(id, t);
  }
  return t;
}

/** A small preview of a style for the catalog and the room panel (data URL). */
export function stylePreviewUrl(kind: 'floor' | 'wall', id: string): string {
  const t = kind === 'floor' ? floorTexture(id) : wallTexture(id);
  const src = t.source.resource as HTMLCanvasElement | undefined;
  return src instanceof HTMLCanvasElement ? src.toDataURL() : '';
}
