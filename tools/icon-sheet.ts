// Contact sheet of one real icon per shape (non-furniture), as in the bag. Run:
// npx tsx tools/icon-sheet.ts <out.ppm> [scale]   (convert the PPM to PNG with PIL)
import { writeFileSync } from 'node:fs';
import { ICON_SHAPES, iconGroups, type Icon } from '@pixel-hotel/shared';
import { ICON_SIZE, iconPixels } from '../client/src/render/iconPixels.ts';

const out = process.argv[2] ?? 'icons.ppm';
const S = Number(process.argv[3] ?? 4);
const seen = new Map<string, Icon[]>();
for (const list of Object.values(iconGroups())) {
  for (const { icon } of list) {
    const a = seen.get(icon.shape) ?? [];
    if (a.length < 3 && !a.some((i) => i.colors.join() === icon.colors.join())) a.push(icon);
    seen.set(icon.shape, a);
  }
}
const shapes = ICON_SHAPES.filter((s) => !['chair', 'sofa', 'table', 'lamp', 'shelf', 'bed', 'rug', 'plant', 'box', 'barrel', 'bench', 'sign', 'banner', 'torch', 'throne', 'jar', 'chandelier', 'counter', 'stool', 'tank'].includes(s));
const COLS = 6;
const CW = 3 * 36;
const CH = 38;
const W = COLS * CW;
const H = Math.ceil(shapes.length / COLS) * CH;
const buf = new Uint8Array(W * H * 3);
for (let i = 0; i < W * H; i++) buf.set([234, 212, 170], i * 3);
const rgb = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
shapes.forEach((shape, i) => {
  const ox = (i % COLS) * CW;
  const oy = Math.floor(i / COLS) * CH;
  (seen.get(shape) ?? [{ shape, colors: ['orange', 'gold'] }]).forEach((icon, k) => {
    iconPixels(icon).forEach((c, j) => {
      if (c) buf.set(rgb(c), ((oy + 3 + Math.floor(j / ICON_SIZE)) * W + ox + k * 36 + 2 + (j % ICON_SIZE)) * 3);
    });
  });
});
const W2 = W * S;
const H2 = H * S;
const big = new Uint8Array(W2 * H2 * 3);
for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) big.set(buf.subarray((Math.floor(y / S) * W + Math.floor(x / S)) * 3, (Math.floor(y / S) * W + Math.floor(x / S)) * 3 + 3), (y * W2 + x) * 3);
writeFileSync(out, Buffer.concat([Buffer.from(`P6\n${W2} ${H2}\n255\n`), Buffer.from(big)]));
console.log(`${shapes.length} shapes`);
