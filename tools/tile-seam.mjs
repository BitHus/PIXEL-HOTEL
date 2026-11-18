// usage: node tools/tile-seam.mjs in.png  -> prints mean abs diff across wrap seams (x and y) vs inner neighbour columns
import sharp from 'sharp';
const { data, info } = await sharp(process.argv[2]).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width: w, height: h } = info;
const d = (a, b) => { let s = 0; for (let k = 0; k < 3; k++) s += Math.abs(data[a * 4 + k] - data[b * 4 + k]); return s; };
let sx = 0, ix = 0, sy = 0, iy = 0;
for (let y = 0; y < h; y++) { sx += d(y * w + w - 1, y * w); ix += d(y * w + 31, y * w + 32); }
for (let x = 0; x < w; x++) { sy += d((h - 1) * w + x, x); iy += d((h >> 1) * w + x, ((h >> 1) + 1) * w + x); }
console.log(process.argv[2], 'seamX', (sx / h).toFixed(1), 'innerX', (ix / h).toFixed(1), 'seamY', (sy / w).toFixed(1), 'innerY', (iy / w).toFixed(1));
