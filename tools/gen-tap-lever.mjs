// Tap stand lever pull by pixel edit (no PixelLab): from the new tap_stand.png (32x44, two ball knobs at the top, rows 0-6) it writes
//  tap_stand_nolever.png = the base with both knobs erased (the world draws this one; tap_stand.png stays for icons),
//  tap_stand_lever.png   = 8 frames 12 x 11: frames 0-3 the LEFT knob (rest, 1, 2, 3 px down + tilt to the tower), frames 4-7 the RIGHT knob. Frame 0 = the original knob.
// Usage: node tools/gen-tap-lever.mjs
import fs from 'fs'; import { PNG } from 'pngjs';
const dir = 'client/src/assets/sprites/furniture/';
const base = PNG.sync.read(fs.readFileSync(`${dir}tap_stand.png`));
const get = (p, x, y) => { if (x < 0 || y < 0 || x >= p.width || y >= p.height) return null; const o = (y * p.width + x) * 4; return p.data[o + 3] ? [...p.data.slice(o, o + 3)] : null; };
const put = (p, x, y, c) => { if (x < 0 || y < 0 || x >= p.width || y >= p.height) return; const o = (y * p.width + x) * 4; p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; p.data[o + 3] = 255; };
const mk = (w, h) => new PNG({ width: w, height: h });
const KNOB_ROWS = 7; // rows 0..6 hold the knob, row 7 is the neck's top outline
const X0 = [0, 20], W = 12, H = 11;
const nolever = mk(32, 44); base.data.copy(nolever.data);
for (const x0 of X0) for (let y = 0; y < KNOB_ROWS; y++) for (let x = x0; x < x0 + W; x++) { const o = (y * 32 + x) * 4; nolever.data[o + 3] = 0; }
fs.writeFileSync(`${dir}tap_stand_nolever.png`, PNG.sync.write(nolever));
const SHIFT = [[0, 0], [0, 1], [1, 2], [1, 3]]; // [dx toward the tower, dy down] per frame
const strip = mk(W * 8, H);
for (let slot = 0; slot < 2; slot++) for (let f = 0; f < 4; f++) {
  const [dx, dy] = SHIFT[f]; const sx = slot === 0 ? dx : -dx;
  for (let y = 0; y < KNOB_ROWS; y++) for (let x = 0; x < W; x++) { const c = get(base, X0[slot] + x, y); if (c) put(strip, (slot * 4 + f) * W + x + sx, y + dy, c); }
}
fs.writeFileSync(`${dir}tap_stand_lever.png`, PNG.sync.write(strip));
// contact sheet at 6x: base, nolever, then the 8 frames composed on the nolever base
const S = 6; const sheet = mk(32 * S * 5, 44 * S * 2);
const blit = (src, ox, oy) => { for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) { const c = get(src, x, y); if (!c) continue; for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) put(sheet, ox + x * S + i, oy + y * S + j, c); } };
for (let i = 0; i < sheet.data.length; i += 4) { sheet.data[i] = 90; sheet.data[i + 1] = 105; sheet.data[i + 2] = 136; sheet.data[i + 3] = 255; }
blit(base, 0, 0); blit(nolever, 32 * S, 0);
for (let f = 0; f < 4; f++) { const comp = mk(32, 44); nolever.data.copy(comp.data); for (let slot = 0; slot < 2; slot++) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = get(strip, (slot * 4 + f) * W + x, y); if (c) put(comp, X0[slot] + x, y, c); } blit(comp, f * 32 * S, 44 * S); }
fs.writeFileSync(process.argv[2] ?? 'tap_lever_sheet.png', PNG.sync.write(sheet));
console.log('tap lever written');
