// Builds the modular bar pieces (owner 19 Nov) from the PixelLab bar source art-src/pixellab/bar/straight_src.png:
// the 32 px straight tile is the source's centre cell made mirror-symmetric (so left edge = right edge, tiles forever); every other piece is
// composed from its pixels (no scaling). Output art-src/staging/bar/*.png (NOT in the game yet). Usage: node tools/gen-bar-art.mjs
import fs from 'fs'; import { PNG } from 'pngjs';
const src = PNG.sync.read(fs.readFileSync('art-src/pixellab/bar/straight_src.png'));
const px = (x, y) => { const i = (y * src.width + x) * 4; return src.data[i + 3] < 128 ? null : [src.data[i], src.data[i + 1], src.data[i + 2]]; };
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const O = hex('402931'), O2 = hex('462c35'), R = hex('b94831'), P = hex('733e3a'), B = hex('e98b3d'), BH = hex('f8c762'), D = hex('1b1523');
const TW = 32, TH = 39;
// straight tile T[r][x]: source rows 4..42, columns 32..47 mirrored to 32..63 (post at the centre)
const T = [];
for (let r = 0; r < TH; r++) { T.push([]); for (let x = 0; x < TW; x++) { const sx = x < 16 ? 32 + x : 32 + (31 - x); T[r].push(px(sx, 4 + r)); } }
for (let r = 13; r <= 29; r++) for (let x = 0; x < TW; x++) { const v = T[r][x]; if (v && v[0] === D[0] && v[1] === D[1]) T[r][x] = P; }
const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => hex(h));
const snap = (v) => { let b = pal[0], bd = 1e9; for (const p of pal) { const d = (p[0]-v[0])**2+(p[1]-v[1])**2+(p[2]-v[2])**2; if (d < bd) { bd = d; b = p; } } return b; };
const canvas = (w, h) => Array.from({ length: h }, () => Array(w).fill(null));
const save = (name, c) => { const h = c.length, w = c[0].length; const p = new PNG({ width: w, height: h }); for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = c[y][x] && snap(c[y][x]), i = (y * w + x) * 4; if (v) { p.data[i] = v[0]; p.data[i + 1] = v[1]; p.data[i + 2] = v[2]; p.data[i + 3] = 255; } } fs.mkdirSync('art-src/staging/bar', { recursive: true }); fs.writeFileSync(`art-src/staging/bar/${name}.png`, PNG.sync.write(p)); };
const clone = (c) => c.map((r) => r.slice());
// ---- horizontal run (front faces down), 32 x 39
const straight = clone(T);
const endL = clone(T), endR = clone(T);
for (let r = 1; r <= 36; r++) { endL[r][0] = O; endR[r][31] = O; }
// finished end: a foot post at the cap (copy of the centre post r30..38, x 12..18)
for (let r = 30; r < TH; r++) for (let k = 0; k < 7; k++) { endL[r][1 + k] = T[r][12 + k]; endR[r][24 + k] = T[r][12 + k]; }
// back view (staff side): plain planks, no brass rail, no feet
const up = clone(T);
for (let r = 13; r <= 38; r++) for (let x = 0; x < TW; x++) { const base = T[24][x]; up[r][x] = (r === 13) ? O : (r >= 37 ? O : (base && base[0] === R[0] && base[1] === R[1] ? R : P)); }
for (let x = 0; x < TW; x++) up[37][x] = O2;
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
for (const [k, v] of Object.entries(pieces)) save(k, v);
console.log('wrote', Object.keys(pieces).join(' '));
