// Usage: node tools/stool-ground.mjs  -> bar_stool (+_right, _up): outer legs reach the same floor line as the centre foot, plus a baked contact shadow (3e2731, alpha 90) in the transparent pixels at the bottom rows. Old art copied to art-src/pixellab/old19d once.
import fs from 'fs'; import { PNG } from 'pngjs';
const dir = 'client/src/assets/sprites/furniture/', old = 'art-src/pixellab/old19d/';
for (const f of ['bar_stool.png', 'bar_stool_right.png', 'bar_stool_up.png']) {
  if (!fs.existsSync(old + f)) fs.copyFileSync(dir + f, old + f);
  const p = PNG.sync.read(fs.readFileSync(old + f)), W = p.width, H = p.height;
  const px = (x, y) => (y * W + x) * 4;
  const cp = (sx, sy, dx, dy) => { for (let k = 0; k < 4; k++) p.data[px(dx, dy) + k] = p.data[px(sx, sy) + k]; };
  const clr = (x, y) => { for (let k = 0; k < 4; k++) p.data[px(x, y) + k] = 0; };
  for (const [x0, x1] of [[0, 8], [24, 32]]) {
    const rows = []; for (let y = 0; y < H; y++) { let o = false; for (let x = x0; x < x1; x++) if (p.data[px(x, y) + 3]) o = true; if (o) rows.push(y); }
    const bot = rows[rows.length - 1]; // outline row of the leg bottom (30)
    if (bot > 31) continue;
    const shift = 34 - bot, src = [bot - 8, bot - 7, bot - 6];
    const bottom = []; for (let x = x0; x < x1; x++) bottom.push([x, p.data.slice(px(x, bot), px(x, bot) + 4)]);
    for (let x = x0; x < x1; x++) clr(x, bot);
    for (let i = 0; i < shift; i++) for (let x = x0; x < x1; x++) cp(x, src[i % 3], x, bot + i);
    for (const [x, c] of bottom) for (let k = 0; k < 4; k++) p.data[px(x, bot + shift) + k] = c[k];
  }
  // contact shadow in still-transparent pixels, rows 32..35 (ellipse centre x 15.5, y 34, rx 14, ry 2.6)
  for (let y = 31; y < H; y++) for (let x = 0; x < W; x++) { const i = px(x, y); if (p.data[i + 3]) continue; const dx = (x - 15.5) / 14, dy = (y - 34) / 2.6; if (dx * dx + dy * dy <= 1) { p.data[i] = 0x3e; p.data[i + 1] = 0x27; p.data[i + 2] = 0x31; p.data[i + 3] = 90; } }
  fs.writeFileSync(dir + f, PNG.sync.write(p)); console.log(f, 'done');
}
