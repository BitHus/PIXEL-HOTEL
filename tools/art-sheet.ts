// Contact sheet of every furniture item, drawn like the game does: the 32 px inventory icon in a
// slot-like cell, and the room sprite (facing down and right). Writes a binary PPM (P6); convert
// with: python3 -c "from PIL import Image; Image.open('sheet.ppm').save('sheet.png')".
// Run: npx tsx tools/art-sheet.ts <out.ppm> [scale]

import { writeFileSync } from 'node:fs';
import { FURNITURE_TYPES, type Facing } from '@pixel-hotel/shared';
import { furnitureRects, iconStylePixels } from '../client/src/render/furnitureArt.ts';
import { ICON_SIZE, iconPixels } from '../client/src/render/iconPixels.ts';

const out = process.argv[2] ?? 'sheet.ppm';
const S = Number(process.argv[3] ?? 3);
const COLS = 6;
const CELL_W = 32 + 112 + 112 + 12; // icon + room sprite down + right
const CELL_H = 100;
const rows = Math.ceil(FURNITURE_TYPES.length / COLS);
const W = COLS * CELL_W;
const H = rows * CELL_H;
const buf = new Uint8Array(W * H * 3);
const BG = [60, 44, 52];
for (let i = 0; i < W * H; i++) buf.set(BG, i * 3);

function rgb(hex: string): number[] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function put(x: number, y: number, c: number[]): void {
  if (x >= 0 && y >= 0 && x < W && y < H) buf.set(c, (y * W + x) * 3);
}

FURNITURE_TYPES.forEach((type, idx) => {
  const ox = (idx % COLS) * CELL_W;
  const oy = Math.floor(idx / COLS) * CELL_H;
  // slot-like backing for the icon
  for (let y = 0; y < 34; y++) for (let x = 0; x < 34; x++) put(ox + 2 + x, oy + 4 + y, rgb('#ead4aa'));
  iconPixels(type.icon).forEach((c, i) => {
    if (c) put(ox + 3 + (i % ICON_SIZE), oy + 5 + Math.floor(i / ICON_SIZE), rgb(c));
  });
  let cx = ox + 44;
  for (const facing of ['down', 'right'] as Facing[]) {
    const rects = iconStylePixels(furnitureRects(type, facing, undefined, false));
    // Draw at 1x (the real size), anchor at the bottom middle of a 108 x 92 box.
    const mirror = false;
    for (const [rx, ry, rw, rh, c] of rects) {
      for (let y = 0; y < rh; y++) for (let x = 0; x < rw; x++) put(cx + 54 + (mirror ? -(rx + x) : rx + x), oy + 90 + ry + y, rgb(c));
    }
    cx += 112;
  }
});

// Upscale by S (nearest).
const W2 = W * S;
const H2 = H * S;
const big = new Uint8Array(W2 * H2 * 3);
for (let y = 0; y < H2; y++) {
  for (let x = 0; x < W2; x++) {
    const si = (Math.floor(y / S) * W + Math.floor(x / S)) * 3;
    big.set(buf.subarray(si, si + 3), (y * W2 + x) * 3);
  }
}
writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${W2} ${H2}\n255\n`), Buffer.from(big)]));
console.log(`wrote ${out} (${W2}x${H2})`);
