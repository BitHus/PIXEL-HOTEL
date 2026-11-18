// Seamless chunky flagstone floors (stone_tiles, crypt_flagstones) in the PixelLab look: soft bevel, calm tone, thin grout.
// usage: node tools/gen-floor-stone.mjs  (writes art-src/pixellab/tiles6/stone_tiles.png, crypt_flagstones.png)
import sharp from 'sharp';
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
function make(name, pal, rows) {
  const N = 64, buf = Buffer.alloc(N * N * 4);
  const put = (x, y, c) => { x = (x + N) % N; y = (y + N) % N; const o = (y * N + x) * 4; buf[o] = c[0]; buf[o + 1] = c[1]; buf[o + 2] = c[2]; buf[o + 3] = 255; };
  let y0 = 0, si = 0;
  for (const r of rows) {
    let x0 = r.off;
    for (const w of r.w) {
      const alt = (si++ % 3 === 1) ? pal.base2 : pal.base;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < w; x++) {
        let c = alt;
        const gx = x0 + x, gy = y0 + y;
        if (x === w - 1 || y === r.h - 1) c = pal.grout;
        else if (x === 0 || y === 0) c = pal.hi;
        else if (x === w - 2 || y === r.h - 2) c = pal.lo;
        // rounded chunky corners
        if ((x === 0 || x === w - 2) && (y === 0 || y === r.h - 2)) c = pal.grout2;
        put(gx, gy, c);
      }
      // a few speckles
      put(x0 + 4 + ((si * 7) % (w - 8)), y0 + 4 + ((si * 5) % (r.h - 8)), pal.lo);
      x0 += w;
    }
    y0 += r.h;
  }
  return sharp(buf, { raw: { width: N, height: N, channels: 4 } }).png().toFile(`art-src/pixellab/tiles6/${name}.png`);
}
const P1 = { base: hex('#8b9bb4'), base2: hex('#95a5bc'.replace('#95a5bc', '#8b9bb4')), hi: hex('#c0cbdc'), lo: hex('#5a6988'), grout: hex('#5a6988'), grout2: hex('#5a6988') };
await make('stone_tiles', P1, [
  { h: 32, off: 0, w: [32, 32] }, { h: 32, off: 0, w: [32, 32] },
]);
const P2 = { base: hex('#3a4466'), base2: hex('#3a4466'), hi: hex('#5a6988'), lo: hex('#262b44'), grout: hex('#262b44'), grout2: hex('#262b44') };
await make('crypt_flagstones', P2, [
  { h: 20, off: 0, w: [24, 40] }, { h: 24, off: 10, w: [30, 20, 14] }, { h: 20, off: 4, w: [36, 28] },
]);
