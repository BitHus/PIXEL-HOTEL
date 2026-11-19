// Usage: node tools/pixellab-fit.mjs <furnitureId> [facing-suffixes e.g. _up,_right]
// NO SCALING (owner 19 Nov, only trim/pad/snap; ignore the old scale wording). Takes art-src/pixellab/<id>.png (PixelLab output), trims it, scales it (box downsample, majority colour) so the width
// fits the furniture.json footprint and the height stays within footprint depth + piece height + 8, pads to the footprint
// width (anchor = bottom centre), snaps every colour to shared/src/palette.ts and writes
// client/src/assets/sprites/furniture/<id>.png (plus copies for the given suffixes, for symmetric pieces like stools).
import fs from 'fs'; import { PNG } from 'pngjs';
const id = process.argv[2]; const copies = (process.argv[3] || '').split(',').filter(Boolean);
const types = JSON.parse(fs.readFileSync('shared/data/furniture.json', 'utf8')); const list = Array.isArray(types) ? types : (types.furniture || Object.values(types));
const t = list.find((x) => x.id === id); if (!t) { console.error('unknown furniture id', id); process.exit(1); }
const ROT = process.env.ROT || ''; // '_right' or '_up': fit art-src/pixellab/<id><ROT>.png to the rotated footprint, write only <id><ROT>.png
const FW = ROT === '_right' ? t.d : t.w, MAXH = (ROT === '_right' ? t.w : t.d) + t.height + 8;
const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const snap = (r, g, b) => { let best = 0, bd = 1e9; pal.forEach((p, i) => { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }); return pal[best]; };
const src = PNG.sync.read(fs.readFileSync(`art-src/pixellab/${id}${ROT}.png`));
let x0 = src.width, y0 = src.height, x1 = -1, y1 = -1;
for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) if (src.data[(y * src.width + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
// ART RULE (owner 19 Nov): NEVER scale, stretch or squeeze. Only trim, pad (transparent) to the footprint width / depth, snap colours.
// A sprite wider or taller than its footprint stays as it is (anchor = bottom centre).
const minH = ROT === '_right' ? t.w : t.d;
const OW = Math.max(FW, bw + (bw % 2 !== FW % 2 ? 1 : 0)), OH = Math.max(bh, minH), oh = OH;
const fin = new PNG({ width: OW, height: OH });
const offx = Math.floor((OW - bw) / 2), offy = OH - bh;
for (let y = 0; y < bh; y++) for (let x = 0; x < bw; x++) {
  const i = ((y0 + y) * src.width + x0 + x) * 4; if (src.data[i + 3] <= 127) continue;
  const c = snap(src.data[i], src.data[i + 1], src.data[i + 2]); const o = ((y + offy) * OW + x + offx) * 4;
  fin.data[o] = c[0]; fin.data[o + 1] = c[1]; fin.data[o + 2] = c[2]; fin.data[o + 3] = 255;
}
const dir = 'client/src/assets/sprites/furniture/';
const buf = PNG.sync.write(fin);
fs.writeFileSync(`${dir}${id}${ROT}.png`, buf); for (const s of copies) fs.writeFileSync(`${dir}${id}${s}.png`, buf);
console.log(id, `${bw}x${bh} -> ${OW}x${OH} (no scaling)`);
