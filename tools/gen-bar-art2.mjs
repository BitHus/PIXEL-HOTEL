// Modular bar v2 (owner 19 Nov: "the bar is ugly"): same geometry as tools/gen-bar-art.mjs (32x39 horizontal, 32x58 vertical, top face rows 1..12),
// but the straight tile is DRAWN here (dark oak top, worn lip, framed front panels, dark iron footrail) instead of cut from a PixelLab source.
// Writes straight into client/src/assets/sprites/furniture/bar_*.png (+ bar, bar_up, bar_right copies); old art kept in art-src/pixellab/old19f. Usage: node tools/gen-bar-art2.mjs [outDir]
import fs from 'fs'; import { PNG } from 'pngjs';
const OUT = process.argv[2] ?? 'client/src/assets/sprites/furniture/';
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const O = hex('3e2731'), O2 = hex('3e2731'), D = hex('181425');
const W0 = hex('733e39'), W1 = hex('b86f50'), W2 = hex('c28569'), IR = hex('3a4466'), IH = hex('5a6988'), BR = hex('d77643');
const R = W1, P = W0, B = W0, BH = W0; // rim, side panel, (no brass stripe on the vertical side any more)
const TW = 32, TH = 39;
const T = Array.from({ length: TH }, () => Array(TW).fill(null));
const set = (x, y, c) => { T[y][x] = c; };
// grain streaks on the top boards (left half, mirrored): [row, x0, x1]
const grain = [[2, 3, 9], [3, 12, 15], [4, 1, 4], [6, 6, 13], [7, 0, 2], [8, 10, 14], [3, 0, 0]];
for (let x = 0; x < TW; x++) {
  const m = x < 16 ? x : 31 - x;
  set(x, 0, O); set(x, 1, W1);
  for (let y = 2; y <= 8; y++) set(x, y, W0);
  set(x, 5, O); // seam between the two top boards
  for (const [r, a, b] of grain) if (m >= a && m <= b && r !== 5) set(x, r, W1);
  set(x, 9, W2); set(x, 10, W1); set(x, 11, W0); set(x, 12, O); set(x, 13, D);
  // front: framed panel. Stile across the joint (x30..x1), rails rows 14-15 and 29-30
  for (let y = 14; y <= 30; y++) set(x, y, W0);
  set(x, 31, IH); set(x, 32, IR); set(x, 33, D);
  for (let y = 34; y <= 37; y++) set(x, y, O);
  set(x, 38, O);
}
for (let y = 14; y <= 30; y++) set(30, y, W1); // lit left edge of the joint stile
// recessed panel x2..29, rows 16..28: shadow top/left, light bottom/right
for (let x = 2; x <= 29; x++) { set(x, 16, O); set(x, 28, W1); }
for (let y = 16; y <= 28; y++) { set(2, y, O); set(29, y, W1); }
set(29, 16, O); set(2, 28, O);
// raised field x7..24, rows 19..25: lit top/left, dark bottom/right
for (let x = 7; x <= 24; x++) { set(x, 19, W1); set(x, 25, O); }
for (let y = 19; y <= 25; y++) { set(7, y, W1); set(24, y, O); }
set(24, 19, W0); set(7, 25, W0);
// small brass boss in the middle of the field (subtle trim) and rail stands at the post
set(15, 22, BR); set(16, 22, BR);
for (let y = 33; y <= 37; y++) { set(15, y, IR); set(16, y, IR); }
set(15, 33, IH);

const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => hex(h));
const snap = (v) => { let b = pal[0], bd = 1e9; for (const p of pal) { const d = (p[0]-v[0])**2+(p[1]-v[1])**2+(p[2]-v[2])**2; if (d < bd) { bd = d; b = p; } } return b; };
const canvas = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
const save = (name, c) => { const h = c.length, w = c[0].length; const p = new PNG({ width: w, height: h }); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = c[y][x] && snap(c[y][x]), i = (y * w + x) * 4; if (v) { p.data[i] = v[0]; p.data[i + 1] = v[1]; p.data[i + 2] = v[2]; p.data[i + 3] = 255; } } fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(OUT + name + '.png', PNG.sync.write(p)); };
const clone = (c) => c.map((r) => r.slice());
// ---- horizontal run (front faces down), 32 x 39
const straight = clone(T);
const endL = clone(T), endR = clone(T);
for (let r = 1; r <= 38; r++) { endL[r][0] = O; endR[r][31] = O; }
for (let r = 1; r <= 30; r++) { endL[r][1] = r === 12 ? O : r === 13 ? D : W1; endR[r][30] = r === 12 ? O : r === 13 ? D : (r >= 14 ? O : endR[r][30]); }
endL[31][1] = IH; endL[32][1] = IR; endR[31][30] = IH; endR[32][30] = IR; // the footrail turns at the end
for (let r = 14; r <= 30; r++) { endL[r][30] = W0; endR[r][1] = W0; endR[r][0+1] = W0; }
// back view (staff side): plain planks, no brass rail, no feet
const up = clone(T);
for (let r = 13; r <= 38; r++) for (let x = 0; x < TW; x++) up[r][x] = r === 13 ? D : r >= 36 ? O : (x % 8 === 0 ? O : (x % 8 === 1 ? W1 : W0));
// ---- vertical pieces, 32 x 58: plate rows 0..31 (wood 0..28, south rim 29..31), x: 0 outline, 1..21 wood, 22..24 rim, 25 outline, 26..30 side, 31 outline
const VW = 32, VH = 58;
const wood = (c, y) => T[1 + Math.floor(((c - 1) * 9) / 21)][y];
function vcol(cv, y, opts = {}) { // one row of the plate at canvas row y (0..31)
  cv[y][0] = O; for (let c = 1; c <= 21; c++) cv[y][c] = wood(c, y);
  for (let c = 22; c <= 24; c++) cv[y][c] = R; cv[y][25] = O;
  for (let c = 26; c <= 30; c++) cv[y][c] = P; cv[y][28] = (y % 16 >= 6 && y % 16 <= 8) ? BH : B; cv[y][31] = O;
  if (y % 16 === 0) for (const c of [26, 27, 29, 30]) cv[y][c] = O2;
}
function front(cv, y0, x0, x1, left, right) { // tile front rows r13..r38 at canvas rows y0.. , tile cols mapped x0..x1
  for (let r = 13; r < TH; r++) for (let x = x0; x <= x1; x++) cv[y0 + r - 13][x] = T[r][x];
  if (left) for (let r = 13; r < TH - 2; r++) cv[y0 + r - 13][x0] = O;
  if (right) for (let r = 13; r < TH - 2; r++) cv[y0 + r - 13][x1] = O;
}
const vMid = canvas(VW, VH); for (let y = 0; y < 32; y++) vcol(vMid, y);
const vNorth = clone(vMid); for (let x = 1; x <= 30; x++) vNorth[0][x] = O; vNorth[0][0] = null; vNorth[0][31] = null;
const vSouth = canvas(VW, VH); for (let y = 0; y < 32; y++) vcol(vSouth, y);
for (let y = 29; y <= 31; y++) for (let c = 1; c <= 21; c++) vSouth[y][c] = R; // south overhang rim
front(vSouth, 32, 0, 25, true, false); for (let y = 32; y < VH; y++) { vSouth[y][25] = O; for (let c = 26; c <= 30; c++) vSouth[y][c] = P; vSouth[y][28] = ((y % 16 >= 6 && y % 16 <= 8)) ? BH : B; vSouth[y][31] = O; }
for (let c = 1; c <= 30; c++) vSouth[VH - 1][c] = O; vSouth[VH - 1][0] = null; vSouth[VH - 1][31] = null;
// ---- corners (32 x 58). Band = rows 19..31 (the horizontal top face), plate = rows 0..31 (vertical top)
function band(cv, x0, x1, ext) { // wood rows 20..28, outline row 19, rim 29..31 for x0..x1
  for (let x = x0; x <= x1; x++) { cv[19][x] = O; for (let k = 1; k <= 9; k++) cv[19 + k][x] = T[k][x]; for (let k = 10; k <= 12; k++) cv[19 + k][x] = R; }
}
function vEast(cv, y0, y1) { for (let y = y0; y <= y1; y++) { for (let c = 22; c <= 24; c++) cv[y][c] = R; cv[y][25] = O; for (let c = 26; c <= 30; c++) cv[y][c] = P; cv[y][28] = (y % 16 >= 6 && y % 16 <= 8) ? BH : B; cv[y][31] = O; } }
function vWood(cv, y0, y1) { for (let y = y0; y <= y1; y++) for (let c = 1; c <= 21; c++) cv[y][c] = wood(c, y); }
// SW  (arms west + south)
const cSW = canvas(VW, VH); band(cSW, 0, 21); vWood(cSW, 20, 31); vEast(cSW, 19, 31); for (let c = 22; c <= 31; c++) cSW[19][c] = O; cSW[19][0] = O; for (let y = 29; y <= 31; y++) cSW[y][0] = R; for (let y = 20; y <= 28; y++) cSW[y][0] = T[y - 19][0]; cSW[19][31] = null;
// SE  (arms east + south)
const cSE = canvas(VW, VH); band(cSE, 1, 31); vWood(cSE, 20, 31); for (let y = 19; y <= 31; y++) cSE[y][0] = O; for (let y = 29; y <= 31; y++) for (let c = 22; c <= 31; c++) cSE[y][c] = R; for (let y = 29; y <= 31; y++) for (let c = 1; c <= 21; c++) cSE[y][c] = wood(c, y); cSE[19][0] = null;
// NW  (arms west + north)
const cNW = canvas(VW, VH); for (let y = 0; y < 32; y++) vcol(cNW, y); for (let y = 29; y <= 31; y++) for (let c = 1; c <= 24; c++) cNW[y][c] = R; for (let y = 19; y <= 31; y++) cNW[y][0] = y === 19 ? O : (y >= 29 ? R : T[y - 19][0]); front(cNW, 32, 0, 25, false, false);
for (let y = 32; y < VH; y++) { cNW[y][25] = O; for (let c = 26; c <= 30; c++) cNW[y][c] = P; cNW[y][28] = ((y % 16 >= 6 && y % 16 <= 8)) ? BH : B; cNW[y][31] = O; } for (let c = 1; c <= 30; c++) cNW[VH - 1][c] = O;
// NE  (arms east + north)
const cNE = canvas(VW, VH); for (let y = 0; y < 19; y++) vcol(cNE, y); band(cNE, 1, 31); vWood(cNE, 20, 28); for (let y = 19; y <= 31; y++) cNE[y][0] = O; for (let y = 29; y <= 31; y++) for (let c = 1; c <= 31; c++) cNE[y][c] = R;
for (let y = 19; y <= 28; y++) for (let c = 22; c <= 31; c++) cNE[y][c] = T[y - 19][c];
front(cNE, 32, 0, 31, true, false);
const pieces = { bar_straight: straight, bar_straight_up: up, bar_end_left: endL, bar_end_right: endR, bar_straight_right: vMid, bar_end_up: vNorth, bar_end_down: vSouth, bar_corner_sw: cSW, bar_corner_se: cSE, bar_corner_nw: cNW, bar_corner_ne: cNE };
const NAMES = { bar_straight: ['bar_hmid', 'bar'], bar_straight_up: ['bar_hback', 'bar_up'], bar_end_left: ['bar_hendl'], bar_end_right: ['bar_hendr'], bar_straight_right: ['bar_vmid', 'bar_right'], bar_end_up: ['bar_vendn'], bar_end_down: ['bar_vends'], bar_corner_sw: ['bar_csw'], bar_corner_se: ['bar_cse'], bar_corner_nw: ['bar_cnw'], bar_corner_ne: ['bar_cne'] };
for (const [k, v] of Object.entries(pieces)) for (const n of NAMES[k]) save(n, v);
console.log('wrote', Object.keys(pieces).join(' '));
