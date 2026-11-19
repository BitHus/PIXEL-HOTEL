// Usage: node tools/gen-pond-art.mjs
// Builds the POND ART SET (docs/NOTES.md POND ART SET) into art-src/staging/lake/ from the PixelLab sources in art-src/pixellab/lake/.
// Only reorders (corner mask order), snaps to Endesga 32, wraps (water drift frames) and pixel-draws the ripple rings. NO scaling.
// Also draws the sample pond contact sheet (4x nearest) to the Desktop styletest folder.
import fs from 'fs'; import path from 'path'; import { PNG } from 'pngjs';
const SRC = 'art-src/pixellab/lake', OUT = 'client/src/assets/sprites/lake';
const SHEET = process.env.POND_SHEET || 'C:/Users/ajren/Desktop/PocketBarrel-styletest/pond';
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(SHEET, { recursive: true });
const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const cache = new Map();
const snap = (r, g, b) => { const k = (r << 16) | (g << 8) | b; if (cache.has(k)) return cache.get(k); let best = 0, bd = 1e9; pal.forEach((p, i) => { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }); cache.set(k, pal[best]); return pal[best]; };
const read = (f) => PNG.sync.read(fs.readFileSync(f));
const blank = (w, h) => new PNG({ width: w, height: h });
function put(dst, src, dx, dy, sx = 0, sy = 0, w = src.width, h = src.height) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((sy + y) * src.width + sx + x) * 4; if (src.data[i + 3] === 0) continue;
    const X = dx + x, Y = dy + y; if (X < 0 || Y < 0 || X >= dst.width || Y >= dst.height) continue;
    const o = (Y * dst.width + X) * 4; dst.data[o] = src.data[i]; dst.data[o + 1] = src.data[i + 1]; dst.data[o + 2] = src.data[i + 2]; dst.data[o + 3] = 255;
  }
}
function snapAll(p) { for (let i = 0; i < p.data.length; i += 4) { if (p.data[i + 3] < 128) { p.data[i + 3] = 0; continue; } const s = snap(p.data[i], p.data[i + 1], p.data[i + 2]); p.data[i] = s[0]; p.data[i + 1] = s[1]; p.data[i + 2] = s[2]; p.data[i + 3] = 255; } return p; }
const save = (name, p) => { fs.writeFileSync(path.join(OUT, name), PNG.sync.write(snapAll(p))); };
const crop = (p, x, y, w, h) => { const o = blank(w, h); put(o, p, 0, 0, x, y, w, h); return o; };
const rot90 = (p) => { const o = blank(p.height, p.width); for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) { const s = (y * p.width + x) * 4, d = (x * p.height + (p.height - 1 - y)) * 4; for (let k = 0; k < 4; k++) o.data[d + k] = p.data[s + k]; } return o; };
const trim = (p) => { let x0 = p.width, y0 = p.height, x1 = -1, y1 = -1; for (let y = 0; y < p.height; y++) for (let x = 0; x < p.width; x++) if (p.data[(y * p.width + x) * 4 + 3] > 0) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return crop(p, x0, y0, x1 - x0 + 1, y1 - y0 + 1); };
const px = (p, x, y, c) => { if (x < 0 || y < 0 || x >= p.width || y >= p.height) return; const o = (y * p.width + x) * 4; p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; p.data[o + 3] = 255; };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// 1) the three Wang corner sets -> 4x4 sheet in MASK ORDER. mask = NW*1 + NE*2 + SE*4 + SW*8 where a corner is 1 when it is the 'upper' (higher) terrain.
const SETS = [['grass_sand', 'shore_grass_sand'], ['sand_water', 'shore_sand_water'], ['shallow_deep', 'shore_shallow_deep']];
const sets = {};
for (const [name, file] of SETS) {
  const img = read(`${SRC}/${file}.png`), meta = JSON.parse(fs.readFileSync(`${SRC}/${file}.json`, 'utf8'));
  const out = blank(128, 128); const seen = new Set();
  for (const t of meta.tileset_data.tiles) {
    const c = t.corners, m = (c.NW === 'upper' ? 1 : 0) | (c.NE === 'upper' ? 2 : 0) | (c.SE === 'upper' ? 4 : 0) | (c.SW === 'upper' ? 8 : 0);
    seen.add(m); put(out, img, (m % 4) * 32, Math.floor(m / 4) * 32, t.bounding_box.x, t.bounding_box.y, 32, 32);
  }
  if (seen.size !== 16) throw new Error(name + ' missing masks');
  save(`tiles_${name}.png`, out); sets[name] = read(`${OUT}/tiles_${name}.png`);
}

// 2) water drift frames (wrap shift of the all-lower base tile: mask 0 of sand_water = shallow, mask 0 of shallow_deep = deep), 4 frames in a 128x32 strip.
function driftStrip(set, name) {
  const base = crop(set, 0, 0, 32, 32), out = blank(128, 32);
  const sh = [[0, 0], [8, 3], [16, 6], [24, 9]];
  sh.forEach(([dx, dy], f) => { for (let y = 0; y < 32; y++) for (let x = 0; x < 32; x++) { const s = (((y + dy) % 32) * 32 + ((x + dx) % 32)) * 4, d = (y * 128 + f * 32 + x) * 4; for (let k = 0; k < 4; k++) out.data[d + k] = base.data[s + k]; } });
  save(name, out);
}
driftStrip(sets.sand_water, 'water_shallow_drift.png'); driftStrip(sets.shallow_deep, 'water_deep_drift.png');

// 3) ripple rings (4 frames 32x32, 150 ms each, one shot: a fishing splash / bobber ring grows and fades)
{ const out = blank(128, 32); const W = hex('#ffffff'), L = hex('#c0cbdc'), M = hex('#8b9bb4'); const rad = [3, 6, 9, 12], col = [W, L, L, M];
  rad.forEach((r, f) => { for (let a = 0; a < 360; a += 3) { const x = Math.round(16 + r * Math.cos(a * Math.PI / 180)), y = Math.round(16 + r * 0.55 * Math.sin(a * Math.PI / 180)); if (f === 3 && (a / 3) % 2) continue; px(out, f * 32 + x, y, col[f]); } });
  save('ripple.png', out); }

// 4) decor: copy trimmed or full-canvas (the canvas is the final size; anchor = bottom centre)
const DECOR = { pond_reeds: 'reeds', pond_lily_flower: 'lily_flower', pond_lily_plain: 'lily_plain', pond_rocks: 'rocks', pond_lantern_post: 'lantern_post', pond_rowboat: 'rowboat', pond_fish_shadow: 'fish_shadow' };
for (const [src, dst] of Object.entries(DECOR)) save(`${dst}.png`, read(`${SRC}/${src}.png`));
// pier: the AI piece (17 px wide planks, 2 posts at each end) is the pier END cap (north-south, posts at both ends = a 1 cell stub); decks come from tiles_pro
save('pier_cap.png', read(`${SRC}/pond_pier_mid.png`));
for (const [n, f] of [['pier_deck_h0', 'deck_1'], ['pier_deck_h1', 'deck_2'], ['pier_deck_v0', 'deck_4'], ['pier_deck_v1', 'deck_5']]) save(`${n}.png`, read(`${SRC}/${f}.png`));

// 5) sample pond: vertex grid of terrain levels 0 grass, 1 sand, 2 shallow, 3 deep. A cell (c,r) has corners NW=v[r][c] NE=v[r][c+1] SE=v[r+1][c+1] SW=v[r+1][c]; max-min of the 4 must be <= 1.
export function pickTile(v, c, r) {
  const k = [v[r][c], v[r][c + 1], v[r + 1][c + 1], v[r + 1][c]]; const lo = Math.min(...k), hi = Math.max(...k);
  if (hi - lo > 1) throw new Error(`bad cell ${c},${r}: ${k}`);
  const set = lo === hi ? (lo <= 0 ? ['grass', 0] : lo === 1 ? ['sand', 0] : lo === 2 ? ['shallow', 0] : ['deep', 0]) : [['grass_sand', 'sand_water', 'shallow_deep'][lo], k.reduce((m, x, i) => m | ((x === lo ? 1 : 0) << i), 0)];
  return set;
}
const COLS = 18, ROWS = 12; // 576 x 384 px = the lakeside room
const V = []; for (let r = 0; r <= ROWS; r++) { V.push([]); for (let c = 0; c <= COLS; c++) {
  const dx = (c - 10) / 6.2, dy = (r - 5.6) / 3.3, wob = Math.sin(c * 1.3 + r * 0.7) * 0.18 + Math.sin(r * 2.1) * 0.12;
  const d = Math.hypot(dx, dy) + wob, bump = (c > 12 && r < 4) ? 0.35 : 0;  // a lobe in the north east
  const lvl = d < 0.45 - bump ? 3 : d < 0.8 ? 2 : d < 1.06 ? 1 : 0; V[r].push(lvl);
} }
// the corridor of the pier: x 6..9 at row 6 is forced (shore sand -> shallow) so smooth afterwards
function smooth() { let ch = true; while (ch) { ch = false; for (let r = 0; r <= ROWS; r++) for (let c = 0; c <= COLS; c++) for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]]) { const rr = r + dr, cc = c + dc; if (rr < 0 || cc < 0 || rr > ROWS || cc > COLS) continue; if (V[r][c] - V[rr][cc] > 1) { V[rr][cc] = V[r][c] - 1; ch = true; } } } }
smooth();
const base = { grass: read(`${SRC}/shore_grass_sand.png`), sand: null, shallow: null, deep: null };
const tileOf = (kind, m) => { const set = kind === 'grass' ? sets.grass_sand : kind === 'sand' ? sets.grass_sand : kind === 'shallow' ? sets.sand_water : kind === 'deep' ? sets.shallow_deep : sets[kind]; const idx = kind === 'grass' ? 15 : kind === 'sand' ? 0 : kind === 'shallow' ? 0 : kind === 'deep' ? 0 : m; return { set, idx }; };
const map = blank(COLS * 32, ROWS * 32);
for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) { const [kind, m] = pickTile(V, c, r); const { set, idx } = tileOf(kind, m); put(map, set, c * 32, r * 32, (idx % 4) * 32, Math.floor(idx / 4) * 32, 32, 32); }
const dec = (name, cx, by) => { const p = read(`${OUT}/${name}.png`); put(map, p, Math.round(cx - p.width / 2), by - p.height); };
{ const d = read(`${OUT}/pier_deck_h0.png`), e = read(`${OUT}/pier_deck_h1.png`); for (let i = 0; i < 5; i++) put(map, i % 2 ? e : d, 96 + i * 32, 6 * 32 - 16); }
dec('rocks', 120, 150); dec('rocks', 420, 330);
dec('reeds', 150, 300); dec('reeds', 182, 310); dec('reeds', 470, 120); dec('reeds', 505, 135);
dec('lily_flower', 300, 200); dec('lily_plain', 340, 250); dec('lily_plain', 250, 180); dec('lily_flower', 400, 160);
dec('rowboat', 330, 232); dec('fish_shadow', 300, 270); dec('lantern_post', 112, 205);
fs.writeFileSync(`${SHEET}/sample_pond_1x.png`, PNG.sync.write(map));
export { V };
console.log('pond art set written to', OUT);
