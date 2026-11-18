// Usage: node tools/pixellab-fit.mjs <furnitureId> [facing-suffixes e.g. _up,_right]
// Takes art-src/pixellab/<id>.png (PixelLab output), trims it, scales it (box downsample, majority colour) so the width
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
const scale = Math.min(FW >= 64 ? 1.5 : 1, FW / bw, MAXH / bh); // wide pieces may be stretched up to 1.5x so adjacent cells stay joined
const ow = Math.max(1, Math.round(bw * scale)), oh = Math.max(1, Math.round(bh * scale));
const out = new PNG({ width: FW, height: oh });
const offx = Math.floor((FW - ow) / 2);
for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
  const sx0 = x0 + (x / ow) * bw, sx1 = x0 + ((x + 1) / ow) * bw, sy0 = y0 + (y / oh) * bh, sy1 = y0 + ((y + 1) / oh) * bh;
  const votes = new Map(); let opaque = 0, total = 0;
  for (let sy = Math.floor(sy0); sy < Math.max(Math.ceil(sy1), Math.floor(sy0) + 1); sy++) for (let sx = Math.floor(sx0); sx < Math.max(Math.ceil(sx1), Math.floor(sx0) + 1); sx++) {
    const i = (sy * src.width + sx) * 4; total++; if (src.data[i + 3] <= 127) continue; opaque++;
    const k = snap(src.data[i], src.data[i + 1], src.data[i + 2]).join(','); votes.set(k, (votes.get(k) || 0) + 1);
  }
  if (opaque * 2 < total || !votes.size) continue;
  // prefer the darkest colour when it is at least a third of the votes (keeps the 1 px outline alive)
  let pick = null, top = 0; for (const [k, n] of votes) if (n > top) { top = n; pick = k; }
  for (const [k, n] of votes) { const c = k.split(',').map(Number); const p = pick.split(',').map(Number); if (n * 3 >= opaque && c[0] + c[1] + c[2] < p[0] + p[1] + p[2] - 60) pick = k; }
  const c = pick.split(',').map(Number); const o = (y * FW + x + offx) * 4; out.data[o] = c[0]; out.data[o + 1] = c[1]; out.data[o + 2] = c[2]; out.data[o + 3] = 255;
}
const dir = 'client/src/assets/sprites/furniture/';
// _right of a long piece: the AI side view is short; stretch a band of rows (env BAND="0.1-0.5", default top half) so the sprite spans the footprint length (target = length + (down sprite height - depth)); STRETCH=0 turns it off
let fin = out;
if (ROT === '_right' && process.env.STRETCH !== '0') {
  const dh = PNG.sync.read(fs.readFileSync(`${dir}${id}.png`)).height; const target = t.w + (dh - t.d);
  if (oh < target * 0.9) {
    const [a, b] = (process.env.BAND || '0.1-0.55').split('-').map(Number); const b0 = Math.floor(oh * a), b1 = Math.floor(oh * b), extra = target - oh;
    fin = new PNG({ width: FW, height: target });
    for (let y = 0; y < target; y++) { const sy = y < b0 ? y : y < b1 + extra ? b0 + Math.floor((y - b0) * (b1 - b0) / (b1 - b0 + extra)) : y - extra; out.data.copy(fin.data, y * FW * 4, sy * FW * 4, (sy + 1) * FW * 4); }
  }
}
// the game needs the sprite at least as tall as the footprint depth (spriteAssets.test): stretch a middle band of rows to reach it
const minH = ROT === '_right' ? t.w : t.d;
if (fin.height < minH) {
  const h0 = fin.height, b0 = Math.floor(h0 * 0.2), b1 = Math.floor(h0 * 0.7), extra = minH - h0; const g = new PNG({ width: FW, height: minH });
  for (let y = 0; y < minH; y++) { const sy = y < b0 ? y : y < b1 + extra ? b0 + Math.floor((y - b0) * (b1 - b0) / (b1 - b0 + extra)) : y - extra; fin.data.copy(g.data, y * FW * 4, sy * FW * 4, (sy + 1) * FW * 4); }
  fin = g;
}
const buf = PNG.sync.write(fin);
fs.writeFileSync(`${dir}${id}${ROT}.png`, buf); for (const s of copies) fs.writeFileSync(`${dir}${id}${s}.png`, buf);
console.log(id, `${bw}x${bh} -> ${FW}x${oh} (max ${MAXH}) scale ${scale.toFixed(2)}`);
