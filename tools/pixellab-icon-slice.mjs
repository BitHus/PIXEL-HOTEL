// Usage: node tools/pixellab-icon-slice.mjs <sheet.png> <cols> <outDir> <name|-> ...   (row-major; '-' skips an icon)
// PixelLab sheets drift off the 32 px grid, so icons are found as blobs (opaque pixels merged within GAP px), ordered row-major (rows by y centre, `cols` per row),
// then each is cropped, hard-snapped to Endesga 32 (alpha>127) and centred whole-pixel in 32x32. Never scales. Reports blobs that are not 1..32 px or a count mismatch.
import fs from 'fs'; import { PNG } from 'pngjs';
const [sheet, colsS, outDir, ...names] = process.argv.slice(2); const cols = +colsS; const GAP = +(process.env.GAP || 3);
const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const snap = (r, g, b) => { let best = 0, bd = 1e9; pal.forEach((p, i) => { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }); return pal[best]; };
const s = PNG.sync.read(fs.readFileSync(sheet)); const W = s.width, H = s.height; fs.mkdirSync(outDir, { recursive: true });
const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && s.data[(y * W + x) * 4 + 3] > 127;
const lab = new Int32Array(W * H).fill(-1); const blobs = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { if (!op(x, y) || lab[y * W + x] >= 0) continue; const id = blobs.length; const b = { px: [], x0: x, y0: y, x1: x, y1: y }; const st = [[x, y]]; lab[y * W + x] = id;
  while (st.length) { const [cx, cy] = st.pop(); b.px.push([cx, cy]); b.x0 = Math.min(b.x0, cx); b.x1 = Math.max(b.x1, cx); b.y0 = Math.min(b.y0, cy); b.y1 = Math.max(b.y1, cy);
    for (let dy = -GAP; dy <= GAP; dy++) for (let dx = -GAP; dx <= GAP; dx++) { const nx = cx + dx, ny = cy + dy; if (op(nx, ny) && lab[ny * W + nx] < 0) { lab[ny * W + nx] = id; st.push([nx, ny]); } } }
  blobs.push(b); }
const big = blobs.filter((b) => b.px.length >= 12); // drop specks
const rows = Math.ceil(names.length / cols); big.sort((a, b) => (a.y0 + a.y1) - (b.y0 + b.y1));
if (big.length !== names.length) console.log(`COUNT MISMATCH blobs ${big.length} names ${names.length}`);
const ordered = []; for (let r = 0; r < rows; r++) ordered.push(...big.slice(r * cols, (r + 1) * cols).sort((a, b) => (a.x0 + a.x1) - (b.x0 + b.x1)));
names.forEach((name, n) => { const b = ordered[n]; if (!b || name === '-') return; const w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1; if (w > 32 || h > 32) console.log('TOO BIG', name, w, h);
  const o = new PNG({ width: 32, height: 32 }); const dx = Math.floor((32 - w) / 2) - b.x0, dy = Math.floor((32 - h) / 2) - b.y0;
  for (const [x, y] of b.px) { const nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx > 31 || ny > 31) continue; const i = (y * W + x) * 4; const c = snap(s.data[i], s.data[i + 1], s.data[i + 2]); const j = (ny * 32 + nx) * 4; o.data[j] = c[0]; o.data[j + 1] = c[1]; o.data[j + 2] = c[2]; o.data[j + 3] = 255; }
  fs.writeFileSync(`${outDir}/${name}.png`, PNG.sync.write(o)); console.log(name, w + 'x' + h); });
