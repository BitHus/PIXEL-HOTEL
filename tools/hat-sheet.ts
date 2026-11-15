// Contact sheet of the 12 hats on the box avatar: down, up, right and the locked silhouette, as a PNG.
// Run: npx tsx tools/hat-sheet.ts <out.png> [scale]
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { START_LOOK } from '@pixel-hotel/shared';
import { avatarParts, type Facing3, type Part } from '../client/src/render/avatarParts.ts';
import { HAT_IDS, hatBoxes } from '../client/src/render/hatParts.ts';
import { DARK_WARM } from '../client/src/render/bareStyles.ts';

const out = process.argv[2] ?? 'hats.png';
const S = Number(process.argv[3] ?? 4);
const CW = 36, CH = 44, COLS = 4, VIEWS = 4;
const W = HAT_IDS.length * CW * 0 + COLS * CW * 1 * 0 + VIEWS * CW * S;
const H = HAT_IDS.length * CH * S;
const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) buf.set([60, 44, 52], i * 3);
const rgb = (h: string): number[] => { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
function rect(ox: number, oy: number, x: number, y: number, w: number, h: number, col: string): void {
  const c = rgb(col);
  for (let py = 0; py < h * S; py++) for (let px = 0; px < w * S; px++) {
    const X = ox + x * S + px, Y = oy + y * S + py;
    if (X >= 0 && Y >= 0 && X < W && Y < H) buf.set(c, (Y * W + X) * 3);
  }
}
function draw(ox: number, oy: number, ps: Part[]): void {
  for (const [x, y, w, h] of ps) rect(ox, oy, x - 1, y - 1, w + 2, h + 2, DARK_WARM);
  for (const [x, y, w, h, c] of ps) rect(ox, oy, x, y, w, h, c);
}
HAT_IDS.forEach((id, r) => {
  const views: [Facing3, boolean][] = [['down', false], ['up', false], ['right', false], ['down', true]];
  views.forEach(([f, locked], v) => {
    const ox = (v * CW + CW / 2) * S, oy = (r * CH + 40) * S - 0;
    // feet at oy offset so the head (y -60) fits: shift by +20 px
    const base = avatarParts(START_LOOK, f);
    const shifted = (ps: Part[]): Part[] => ps.map(([x, y, w, h, c]): Part => [x, y + 0, w, h, c]);
    draw(ox, oy + 20 * S, shifted(base));
    draw(ox, oy + 20 * S, hatBoxes(id, f, locked) ?? []);
  });
});
// PNG
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(buf.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b: Buffer): number => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
const chunk = (t: string, d: Buffer): Buffer => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, W, H);
