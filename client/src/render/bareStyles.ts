// The 'bare' floor and wall styles (brief section 5): plain, dull and a bit boring on purpose.
// Nicer styles arrive in step 7.

import { Texture } from 'pixi.js';
import { FLOOR_TEXTURE_SIZE, PALETTE } from '@pixel-hotel/shared';
import { desaturate, shade } from './colors.ts';

const BROWN = PALETTE[4]; // #b86f50
const SAND = PALETTE[3]; // #e4a672
/** Dark warm color for edges and outlines (never pure black). */
export const DARK_WARM = PALETTE[6]; // #3e2731

export const BARE_FLOOR_BASE = shade(desaturate(BROWN, 0.65), 0.75);
export const BARE_WALL_COLOR = shade(desaturate(SAND, 0.7), 0.7);
/** Height of the dark edge at the bottom of the bare wall band, in px. */
export const BARE_WALL_EDGE = 4;
export const BORDER_COLOR = DARK_WARM;

/**
 * Fixed specks so the floor is not perfectly flat. Positions are hand-picked, never random,
 * and stay inside the tile, so the texture repeats seamlessly.
 */
const SPECKS: ReadonlyArray<[number, number, number]> = [
  [5, 9, 0.93], [22, 3, 1.05], [41, 14, 0.94], [57, 6, 1.04],
  [12, 30, 1.05], [33, 26, 0.93], [50, 37, 0.95], [3, 47, 0.94],
  [26, 52, 1.04], [44, 58, 0.93], [60, 49, 1.05], [17, 61, 0.95],
];

/** A 64x64 seamless texture: one flat grey-brown with a few barely visible specks. */
export function createBareFloorTexture(): Texture {
  const size = FLOOR_TEXTURE_SIZE;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');
  ctx.fillStyle = BARE_FLOOR_BASE;
  ctx.fillRect(0, 0, size, size);
  for (const [x, y, f] of SPECKS) {
    ctx.fillStyle = shade(BARE_FLOOR_BASE, f);
    ctx.fillRect(x, y, 1, 1);
  }
  return Texture.from(canvas);
}
