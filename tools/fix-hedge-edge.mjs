import sharp from 'sharp';
const p = process.argv[2];
const { data, info } = await sharp(p).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const W = info.width, H = info.height, bad = (o) => data[o + 2] > data[o] + 25 && data[o + 2] > data[o + 1] + 10 && data[o] > 100;
for (let pass = 0; pass < 4; pass++) for (const [y, ref] of [[0, 1], [1, 2], [2, 3], [H - 1, H - 2], [H - 2, H - 3], [H - 3, H - 4]]) for (let x = 0; x < W; x++) {
  const o = (y * W + x) * 4; if (bad(o)) { const r = (ref * W + x) * 4; for (let k = 0; k < 4; k++) data[o + k] = data[r + k]; }
}
await sharp(data, { raw: { width: W, height: H, channels: 4 } }).png().toFile(p);
