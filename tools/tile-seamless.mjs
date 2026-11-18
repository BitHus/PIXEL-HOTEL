// Make a 64x64 tile wrap seamlessly: near each wrapped edge take pixels from the half-shifted copy (continuous there),
// with an ordered-dither ramp so no new line appears. Pixels are only copied, so the palette stays untouched.
// usage: node tools/tile-seamless.mjs in.png out.png [band=10] [axes=xy]
import sharp from 'sharp';
const [inp, out, bandArg, axes = 'xy'] = process.argv.slice(2);
const band = Number(bandArg ?? 10);
const { data, info } = await sharp(inp).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height;
const B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const thr = (x, y) => (B[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
let cur = Buffer.from(data);
const fix = (axis) => {
  const nxt = Buffer.from(cur);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = axis === 'x' ? x : y, n = axis === 'x' ? W : H;
    const dist = Math.min(c, n - 1 - c); // 0 at the wrap seam
    const p = Math.max(0, Math.min(1, 1 - dist / band)); // chance to take the shifted pixel
    if (thr(x, y) < p) {
      const sx = axis === 'x' ? (x + W / 2) % W : x, sy = axis === 'y' ? (y + H / 2) % H : y;
      for (let k = 0; k < 4; k++) nxt[(y * W + x) * 4 + k] = cur[(sy * W + sx) * 4 + k];
    }
  }
  cur = nxt;
};
if (axes.includes('x')) fix('x');
if (axes.includes('y')) fix('y');
await sharp(cur, { raw: { width: W, height: H, channels: 4 } }).png().toFile(out);
