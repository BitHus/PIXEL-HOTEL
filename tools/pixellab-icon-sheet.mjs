// Usage: node tools/pixellab-icon-sheet.mjs <out.png> <icon.png>...   6x nearest sheet, with a 1x/24px-ish strip below each.
import fs from 'fs'; import { PNG } from 'pngjs';
const [out, ...files] = process.argv.slice(2); const cols = 8, S = 6, cw = 32 * S + 8, rows = Math.ceil(files.length / cols);
const ch = 32 * S + 8 + 32 + 8; const W = cols * cw, H = rows * ch; const o = new PNG({ width: W, height: H });
for (let i = 0; i < W * H; i++) { o.data[i * 4] = 51; o.data[i * 4 + 1] = 51; o.data[i * 4 + 2] = 68; o.data[i * 4 + 3] = 255; }
files.forEach((f, n) => { const s = PNG.sync.read(fs.readFileSync(f)); const bx = (n % cols) * cw + 4, by = Math.floor(n / cols) * ch + 4;
  for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const i = (y * s.width + x) * 4; if (x >= s.width || y >= s.height || !s.data[i + 3]) continue;
    for (let dy = 0; dy < S; dy++) for (let dx = 0; dx < S; dx++) { const j = ((by + y * S + dy) * W + bx + x * S + dx) * 4; o.data[j] = s.data[i]; o.data[j + 1] = s.data[i + 1]; o.data[j + 2] = s.data[i + 2]; }
    // small strip: 24px nearest (sampled) at left, 32 at right
    for (const [ox, sz] of [[0, 24], [40, 32]]) { const sx = Math.floor((x * sz) / 32), sy = Math.floor((y * sz) / 32); if ((x * sz) % 32 >= sz && false) continue; const j = ((by + 32 * S + 8 + sy) * W + bx + ox + sx) * 4; o.data[j] = s.data[i]; o.data[j + 1] = s.data[i + 1]; o.data[j + 2] = s.data[i + 2]; }
  } });
fs.writeFileSync(out, PNG.sync.write(o));
