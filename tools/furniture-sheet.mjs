// Usage: node tools/furniture-sheet.mjs <out.png> [scale=3] [cols=8] [id,id,...]  -> contact sheet of furniture down-facing sprites (nearest neighbour) + prints a magick annotate script path
import fs from 'fs'; import { PNG } from 'pngjs';
const out = process.argv[2], S = +(process.argv[3] || 3), COLS = +(process.argv[4] || 8);
const dir = 'client/src/assets/sprites/furniture/';
let ids = process.argv[5] ? process.argv[5].split(',') : fs.readdirSync(dir).filter((f) => f.endsWith('.png') && !/_(up|right|ready|cold|fire|dry|wet|lever|nolever)\.png$/.test(f)).map((f) => f.slice(0, -4));
const imgs = ids.map((id) => PNG.sync.read(fs.readFileSync(dir + id + '.png')));
const CW = Math.max(...imgs.map((i) => i.width)) * S + 12, CH = Math.max(...imgs.map((i) => i.height)) * S + 28;
const rows = Math.ceil(ids.length / COLS); const o = new PNG({ width: CW * COLS, height: CH * rows });
for (let i = 0; i < o.data.length; i += 4) { o.data[i] = 58; o.data[i + 1] = 42; o.data[i + 2] = 32; o.data[i + 3] = 255; }
// footprint floor mark not drawn; sprite bottom-centre aligned in the cell
const cmds = [];
imgs.forEach((im, n) => {
  const cx = (n % COLS) * CW, cy = Math.floor(n / COLS) * CH; const ox = cx + Math.floor((CW - im.width * S) / 2), oy = cy + CH - 8 - im.height * S;
  for (let y = 0; y < im.height; y++) for (let x = 0; x < im.width; x++) { const a = im.data[(y * im.width + x) * 4 + 3]; if (a < 128) continue; for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const p = ((oy + y * S + dy) * o.width + ox + x * S + dx) * 4, q = (y * im.width + x) * 4; o.data[p] = im.data[q]; o.data[p + 1] = im.data[q + 1]; o.data[p + 2] = im.data[q + 2]; } }
  cmds.push('-annotate', `+${cx + 4}+${cy + 12}`, `${ids[n]} ${im.width}x${im.height}`);
});
fs.writeFileSync(out, PNG.sync.write(o)); import('child_process').then((c) => { c.execFileSync('magick', [out, '-font', 'Arial', '-pointsize', '15', '-fill', 'white', ...cmds, out]); });
console.log(ids.length, 'sprites', o.width + 'x' + o.height);
