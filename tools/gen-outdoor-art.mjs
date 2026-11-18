// Draws the OUTDOOR art PNGs (Endesga 32 only, no alpha blending): lakeside trees (lake/tree_*), the farm grass, soil and hedge.
// Run: node tools/gen-outdoor-art.mjs   (deterministic). Light from the top-left, 1 px dark warm outline, no anti-aliasing.
// Trees: 64 x 88 canvas, anchor = (32, 80) = the bottom middle of the trunk. tree_<v>_trunk.png and tree_<v>_crown.png share
// that canvas so the game can draw both (or sway the crown alone); the ground shadow is drawn by the game (alpha oval).
import { writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const C = {
  rust: '#be4a2f', clay: '#d77643', cream: '#ead4aa', sand: '#e4a672', oak: '#b86f50', walnut: '#733e39', out: '#3e2731', crimson: '#a22633',
  red: '#e43b44', orange: '#f77622', gold: '#feae34', butter: '#fee761', lime: '#63c74d', green: '#3e8948', forest: '#265c42', pine: '#193c3e',
  white: '#ffffff', silver: '#c0cbdc', steel: '#8b9bb4', slate: '#5a6988', pink: '#f6757a', rose: '#b55088', plum: '#68386c',
};
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  outline(c) {
    const add = [];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      if (this.get(x, y)) continue;
      if (this.get(x - 1, y) || this.get(x + 1, y) || this.get(x, y - 1) || this.get(x, y + 1)) add.push([x, y]);
    }
    for (const [x, y] of add) this.set(x, y, c);
  }
  fillHoles() {
    const seen = new Uint8Array(this.w * this.h), st = [[0, 0]]; seen[0] = 1;
    while (st.length) { const [x, y] = st.pop(); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= this.w || Y >= this.h || seen[Y * this.w + X] || this.p[Y * this.w + X]) continue; seen[Y * this.w + X] = 1; st.push([X, Y]); } }
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) if (!this.p[y * this.w + x] && !seen[y * this.w + x]) this.p[y * this.w + x] = this.get(x - 1, y) ?? this.get(x + 1, y) ?? this.get(x, y - 1);
  }
  save(file) {
    if (this.w === 64 && this.h === 88) this.fillHoles();
    const png = new PNG({ width: this.w, height: this.h });
    this.p.forEach((c, i) => {
      if (!c) { png.data[i * 4 + 3] = 0; return; }
      png.data[i * 4] = parseInt(c.slice(1, 3), 16); png.data[i * 4 + 1] = parseInt(c.slice(3, 5), 16); png.data[i * 4 + 2] = parseInt(c.slice(5, 7), 16); png.data[i * 4 + 3] = 255;
    });
    writeFileSync(file, PNG.sync.write(png));
  }
}

const OUT = 'client/src/assets/sprites';
mkdirSync(`${OUT}/lake`, { recursive: true });
const AX = 32, AY = 80; // the tree anchor in the 64 x 88 canvas

// ---------- leaf crowns ----------
// A shaded leaf cluster (an ellipse): tone by the angle to the light (top-left) mixed with the whole crown's own shading, a dark rim on the shaded side.
function cluster(img, cx, cy, rx, ry, ramp, crown, seed) {
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const tone = [];
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
    if (!inside(x, y)) continue;
    const nx = (x - cx) / rx, ny = (y - cy) / ry;
    const gx = (x - AX - crown.x) / crown.rx, gy = (y - AY - crown.y) / crown.ry;
    let l = 0.55 * (-0.6 * nx - 0.8 * ny) + 0.45 * (-0.6 * gx - 0.8 * gy);
    l += ((x + y) & 1 ? 0.07 : -0.07) * (hash(seed, x, y) > 0.5 ? 1 : 0); // a little dither at the band edges only
    const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    let c = l > 0.52 ? ramp.hi : l > 0.14 ? ramp.lit : l > -0.3 ? ramp.base : ramp.dark;
    if (edge && l < 0.1) c = ramp.dark;
    else if (edge && l > 0.3) c = ramp.lit;
    tone.push([x, y, c]);
  }
  for (const [x, y, c] of tone) img.set(x, y, c);
  // leaf ticks: short marks so the mass reads as leaves, not as a ball
  const n = Math.round(rx * ry / 9);
  for (let i = 0; i < n; i++) {
    const x = Math.round(cx + (hash(seed, i, 1) * 2 - 1) * rx * 0.8), y = Math.round(cy + (hash(seed, i, 2) * 2 - 1) * ry * 0.8);
    if (!inside(x, y) || !inside(x + 1, y)) continue;
    const c = img.get(x, y);
    const mark = c === ramp.lit || c === ramp.hi ? ramp.base : c === ramp.base ? (hash(seed, i, 3) > 0.5 ? ramp.lit : ramp.dark) : ramp.base;
    if (c === ramp.dark && hash(seed, i, 4) > 0.4) continue;
    img.set(x, y, mark); if (hash(seed, i, 5) > 0.4) img.set(x + 1, y, mark);
  }
}

// ---------- trunks ----------
const BARK = { lit: C.clay, base: C.oak, dark: C.walnut };
function trunk(img, hw, h, kind, seed) {
  const flare = kind === 'birch' ? 2 : 4;
  for (let y = 0; y < h; y++) {
    const t = y / h; // 0 bottom .. 1 top
    const half = Math.round(hw * (1 - 0.16 * t) + (t < 0.14 ? (0.14 - t) * flare * 7 : 0));
    for (let x = -half; x < half; x++) {
      const u = (x + half) / (half * 2); // 0 left .. 1 right
      let c;
      if (kind === 'birch') c = u < 0.34 ? C.white : u < 0.72 ? C.silver : C.steel;
      else c = u < 0.2 ? BARK.lit : u < 0.5 ? BARK.base : BARK.dark;
      img.set(AX + x, AY - y - 1, c);
    }
  }
  // bark detail
  for (let i = 0; i < h / 3; i++) {
    const y = Math.floor(hash(seed, i, 7) * (h - 4)) + 2;
    const t = y / h, half = Math.round(hw * (1 - 0.16 * t));
    if (kind === 'birch') {
      const x = AX - half + 1 + Math.floor(hash(seed, i, 8) * (half * 2 - 5)), len = 2 + Math.floor(hash(seed, i, 9) * 3);
      for (let k = 0; k < len; k++) img.set(x + k, AY - y - 1, i % 3 === 0 ? C.slate : C.out);
      if (hash(seed, i, 6) > 0.6) img.set(x + 1, AY - y - 2, C.out);
    } else {
      const x = AX - half + 2 + Math.floor(hash(seed, i, 8) * (half * 2 - 5));
      const c = img.get(x, AY - y - 1);
      const len = 2 + Math.floor(hash(seed, i, 9) * 3);
      for (let k = 0; k < len; k++) img.set(x, AY - y - 1 - k, c === BARK.lit ? BARK.base : c === BARK.base ? BARK.dark : C.out);
    }
  }
  if (kind === 'oak') { // a knot hole
    img.rect(AX - 2, AY - 14, 3, 3, C.out); img.set(AX - 2, AY - 14, BARK.dark); img.set(AX - 1, AY - 13, BARK.dark);
  }
  // roots: two small feet
  img.rect(AX - hw - 3, AY - 2, 3, 2, BARK.base); img.set(AX - hw - 3, AY - 2, BARK.lit); img.rect(AX + hw, AY - 2, 3, 2, BARK.dark);
  img.set(AX - hw - 4, AY - 1, BARK.dark); img.set(AX + hw + 3, AY - 1, C.out);
}

// ---------- the crowns ----------
const LEAF = {
  fresh: { dark: C.forest, base: C.green, lit: C.lime, hi: C.lime },
  deep: { dark: C.pine, base: C.forest, lit: C.green, hi: C.lime },
  gold: { dark: C.rust, base: C.orange, lit: C.gold, hi: C.butter },
};
function sparkle(img, ramp, pts) { for (const [x, y] of pts) if (img.get(AX + x, AY + y) === ramp.lit || img.get(AX + x, AY + y) === ramp.hi) img.set(AX + x, AY + y, C.butter); }

function oakCrown(img, ramp, v) {
  const L = v === 0
    ? [[-3, -63, 11, 9], [9, -60, 10, 9], [-16, -50, 11, 10], [1, -52, 14, 12], [17, -49, 11, 10], [-12, -40, 12, 8], [10, -39, 12, 8], [-1, -38, 11, 7]]
    : [[6, -64, 11, 9], [-8, -58, 11, 10], [-18, -46, 10, 9], [3, -50, 14, 12], [19, -45, 9, 9], [-9, -38, 13, 8], [9, -37, 12, 8], [-1, -33, 9, 5]];
  const crown = { x: 0, y: -50, rx: 30, ry: 24 };
  L.forEach(([x, y, rx, ry], i) => cluster(img, AX + x, AY + y, rx, ry, ramp, crown, 100 + v * 11 + i));
  sparkle(img, ramp, [[-8, -66], [-1, -70], [3, -58], [-19, -54], [-14, -45]]);
}
function birchCrown(img, ramp, v) {
  const L = [[-4, -64, 8, 9], [6, -58, 9, 9], [-9, -52, 9, 10], [3, -47, 10, 11], [12, -42, 8, 9], [-7, -40, 9, 8], [0, -34, 8, 6], [-14, -44, 6, 7]];
  const crown = { x: 0, y: -50, rx: 22, ry: 24 };
  L.forEach(([x, y, rx, ry], i) => cluster(img, AX + x, AY + y, rx, ry, ramp, crown, 200 + v * 13 + i));
  sparkle(img, ramp, [[-7, -69], [-12, -55], [-2, -52]]);
}
function pineCrown(img, ramp, v) {
  const tiers = [[-14, 18, 20], [-28, 17, 17], [-42, 15, 14], [-56, 13, 11]]; // [bottom y, height, half width at the bottom]
  tiers.forEach(([by, h, w], k) => {
    const rows = [];
    for (let i = 0; i < h; i++) {
      const half = Math.max(1, Math.round(w * ((i + 1) / h) ** 0.92) + (hash(300 + v, k, i) > 0.7 ? 1 : 0));
      rows.push(half);
    }
    for (let i = 0; i < h; i++) {
      const y = AY + by - h + 1 + i, half = rows[i];
      for (let x = -half; x <= half; x++) {
        const u = x / half;
        let c = u < -0.45 ? ramp.lit : u < 0.2 ? ramp.base : ramp.dark;
        if (u < -0.7 && i > 3 && hash(400 + v, k * 9 + i, x) > 0.8) c = ramp.hi;
        img.set(AX + x, y, c);
      }
      // slanting branch strokes
      if (i % 4 === 2) for (let x = -half + 2; x < half - 1; x += 1) if (((x + i) % 5) === 0) img.set(AX + x, y, ramp.dark);
    }
    // the drooping hem: lobes below the last row
    const half = rows[h - 1];
    for (let x = -half; x <= half; x++) {
      const lobe = Math.floor((x + half) / 5) % 2;
      const depth = lobe ? 2 : 1;
      for (let d = 1; d <= depth; d++) img.set(AX + x, AY + by + d, d === depth && x > -half + 3 ? ramp.dark : ramp.base);
    }
    for (let x = -half; x <= half; x++) img.set(AX + x, AY + by, ramp.dark); // underside shade
  });
  // the tip
  for (let i = 0; i < 10; i++) { const half = Math.round(i * 0.6); for (let x = -half; x <= half; x++) img.set(AX + x, AY - 68 - 10 + i + 8, x < 0 ? ramp.lit : ramp.base); }
}

function makeTree(v) {
  const kind = v % 3 === 0 ? 'oak' : v % 3 === 1 ? 'pine' : 'birch';
  const ramp = v === 5 ? LEAF.gold : kind === 'pine' ? (v === 1 ? LEAF.fresh : LEAF.deep) : v >= 3 ? LEAF.deep : LEAF.fresh;
  const tr = new Img(64, 88), cr = new Img(64, 88);
  if (kind === 'oak') { trunk(tr, 7, 30, 'oak', v); oakCrown(cr, ramp, v === 0 ? 0 : 1); }
  else if (kind === 'pine') { trunk(tr, 4, 24, 'pine', v); pineCrown(cr, ramp, v); }
  else { trunk(tr, 5, 36, 'birch', v); birchCrown(cr, ramp, v); }
  tr.outline(C.out); cr.outline(C.out);
  tr.save(`${OUT}/lake/tree_${v}_trunk.png`); cr.save(`${OUT}/lake/tree_${v}_crown.png`);
}
for (let v = 0; v < 6; v++) makeTree(v);

// ---------- stump (the regrow state) ----------
{
  const g = new Img(64, 88);
  // a short fat trunk, flared roots, a cut top with growth rings, moss, a mushroom, an axe-split chip beside it
  const h = 11;
  for (let y = 0; y < h; y++) {
    const half = 9 + (y < 3 ? 2 - y : 0) - (y > 8 ? 1 : 0);
    for (let x = -half; x < half; x++) {
      const u = (x + half) / (half * 2);
      g.set(AX + x, AY - y - 1, u < 0.22 ? BARK.lit : u < 0.55 ? BARK.base : BARK.dark);
    }
  }
  for (const [x, y, len] of [[-5, 3, 4], [1, 5, 4], [4, 2, 3], [-1, 7, 3]]) for (let k = 0; k < len; k++) g.set(AX + x, AY - y - 1 - k, g.get(AX + x, AY - y - 1) === BARK.base ? BARK.dark : C.out);
  // top (an ellipse seen from above, light wood with rings)
  for (let y = -5; y <= 5; y++) for (let x = -10; x <= 10; x++) {
    if ((x / 10) ** 2 + (y / 5) ** 2 > 1) continue;
    const r = Math.sqrt((x / 10) ** 2 + (y / 5) ** 2);
    const ring = r < 0.22 ? C.oak : (r > 0.4 && r < 0.5) || (r > 0.7 && r < 0.78) ? C.oak : r > 0.9 ? C.oak : C.sand;
    g.set(AX + x, AY - h - 3 + y, ring);
  }
  g.set(AX - 1, AY - h - 3, C.walnut); g.set(AX, AY - h - 3, C.walnut);
  for (let x = -8; x <= -4; x++) g.set(AX + x, AY - h - 6 + (x === -8 ? 1 : 0), C.cream); // light edge, top-left
  // moss on the shaded side and a mushroom
  g.rect(AX + 3, AY - 5, 5, 3, C.green); g.rect(AX + 4, AY - 6, 3, 1, C.lime); g.set(AX + 7, AY - 3, C.forest); g.set(AX + 3, AY - 3, C.forest);
  g.rect(AX + 11, AY - 4, 2, 3, C.cream); g.rect(AX + 9, AY - 7, 6, 3, C.red); g.set(AX + 10, AY - 7, C.white); g.set(AX + 13, AY - 6, C.white); g.set(AX + 9, AY - 5, C.crimson); g.rect(AX + 10, AY - 5, 4, 1, C.crimson);
  // a chip of wood and a tuft
  g.rect(AX - 15, AY - 2, 4, 2, C.sand); g.set(AX - 15, AY - 2, C.oak); g.rect(AX - 14, AY - 3, 2, 1, C.cream);
  g.rect(AX - 13, AY - 1, 1, 1, C.out);
  for (const [x, y] of [[-12, 0], [-11, -2], [13, 0], [14, -1]]) g.set(AX + x, AY + y - 1, C.lime);
  g.outline(C.out);
  g.save(`${OUT}/lake/tree_stump.png`);
}

// ---------- sapling (growing back): fresh and deep ----------
for (const [name, ramp] of [['0', LEAF.fresh], ['1', LEAF.deep]]) {
  const g = new Img(64, 88);
  // a thin stem with a stake and a tie
  for (let y = 0; y < 22; y++) { g.set(AX, AY - y - 1, BARK.lit); g.set(AX + 1, AY - y - 1, BARK.base); g.set(AX + 2, AY - y - 1, BARK.dark); }
  g.rect(AX + 5, AY - 15, 2, 15, C.sand); g.rect(AX + 6, AY - 15, 1, 15, C.oak); g.rect(AX + 3, AY - 8, 4, 1, C.red);
  g.rect(AX - 3, AY - 2, 3, 2, BARK.base); g.rect(AX + 3, AY - 2, 2, 1, BARK.dark);
  const crown = { x: 0, y: -26, rx: 12, ry: 12 };
  cluster(g, AX + 1, AY - 27, 8, 7, ramp, crown, 500);
  cluster(g, AX - 6, AY - 20, 5, 4, ramp, crown, 501);
  cluster(g, AX + 8, AY - 20, 5, 4, ramp, crown, 502);
  cluster(g, AX - 1, AY - 33, 5, 4, ramp, crown, 503);
  for (const [x, y] of [[-9, 0], [10, 0], [-5, -1], [6, -1]]) g.set(AX + x, AY + y - 1, C.lime);
  g.outline(C.out);
  g.save(`${OUT}/lake/tree_sapling_${name}.png`);
}

console.log('trees, stump, saplings written');

// ---------- farm ground (64 x 64, repeats in both axes) ----------
class Tile extends Img {
  constructor(w, h) { super(w, h); }
  set(x, y, c) { x = ((Math.round(x) % this.w) + this.w) % this.w; y = ((Math.round(y) % this.h) + this.h) % this.h; this.p[y * this.w + x] = c; }
  get(x, y) { x = ((x % this.w) + this.w) % this.w; y = ((y % this.h) + this.h) % this.h; return this.p[y * this.w + x]; }
}
{
  const g = new Tile(64, 64);
  g.rect(0, 0, 64, 64, C.green);
  // soft mottling: blobs of a sparse light dither (sun-bleached) and a sparse dark dither (shade), so the field has big calm shapes instead of static
  const blob = (cx, cy, rx, ry, c, k) => { for (let y = -ry; y <= ry; y++) for (let x = -rx; x <= rx; x++) { const r2 = (x / rx) ** 2 + (y / ry) ** 2; if (r2 <= 1 && hash(k, x + cx, y + cy) < 0.3 * (1 - r2) + 0.02) g.set(cx + x, cy + y, c); } };
  blob(17, 12, 12, 7, C.lime, 1); blob(49, 41, 13, 8, C.lime, 2);
  blob(8, 44, 11, 7, C.forest, 5);
  // grass tufts: little three-blade clumps (light blades, dark foot), few and deliberate
  const tuft = (x, y, big) => {
    g.set(x, y, C.forest); g.set(x + 1, y, C.forest); g.set(x + 2, y, C.forest);
    g.set(x, y - 1, C.lime); g.set(x + 1, y - 2, C.lime); g.set(x + 1, y - 1, C.lime); g.set(x + 2, y - 1, C.lime);
    if (big) { g.set(x - 1, y - 2, C.lime); g.set(x + 3, y - 2, C.lime); g.set(x + 1, y - 3, C.lime); g.set(x + 3, y, C.forest); g.set(x - 1, y, C.forest); }
  };
  [[6, 8, 0], [41, 14, 1], [57, 27, 0], [13, 33, 0], [28, 40, 1], [51, 58, 0], [26, 61, 0]].forEach(([x, y, b]) => tuft(x, y, b));
  // clover / small flowers: a stem pixel and a bloom; white, butter, pink
  const flower = (x, y, c, c2) => { g.set(x, y + 1, C.forest); g.set(x, y, c); g.set(x - 1, y - 1, c2 ?? c); g.set(x + 1, y - 1, c2 ?? c); g.set(x, y - 2, c2 ?? c); };
  flower(22, 47, C.white, C.butter); flower(56, 8, C.butter);
  g.set(30, 22, C.butter); g.set(9, 60, C.pink);
  // a few pebbles and a leaf-litter patch
  const pebble = (x, y) => { g.set(x, y, C.steel); g.set(x + 1, y, C.silver); g.set(x, y + 1, C.slate); g.set(x + 1, y + 1, C.slate); };
  pebble(45, 24);
  // short dark blade rows to break up the flat tone
  for (const [x, y] of [[34, 6], [22, 30], [58, 44], [4, 22]]) { g.set(x, y, C.forest); g.set(x + 1, y + 1, C.forest); }
  g.save(`${OUT}/floors/grass.png`);
}

// ---------- tilled soil (64 x 64): raised ridges and dark furrows, 16 px rows ----------
{
  const g = new Tile(64, 64);
  for (let row = 0; row < 4; row++) {
    const y0 = row * 16;
    g.rect(0, y0, 64, 16, C.walnut);
    // ridge top (light, 2 rows), furrow (dark, 3 rows) with a lit lip under it
    g.rect(0, y0 + 1, 64, 1, C.oak);
    g.rect(0, y0 + 2, 64, 2, C.walnut);
    g.rect(0, y0 + 12, 64, 3, C.out);
    g.rect(0, y0 + 15, 64, 1, C.oak);
    // clods: little lit bumps with a shade pixel
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash(row, i, 1) * 62), y = y0 + 4 + Math.floor(hash(row, i, 2) * 7), big = hash(row, i, 3) > 0.55;
      g.set(x, y, C.oak); g.set(x + 1, y, C.oak); g.set(x, y + 1, C.walnut); g.set(x + 1, y + 1, C.out);
      if (big) { g.set(x - 1, y + 1, C.walnut); g.set(x + 2, y, C.walnut); g.set(x, y - 1, C.clay); }
    }
    // a few grains
    for (let i = 0; i < 5; i++) g.set(Math.floor(hash(row, i, 9) * 64), y0 + 4 + Math.floor(hash(row, i, 10) * 7), hash(row, i, 11) > 0.5 ? C.oak : C.out);
  }
  g.save(`${OUT}/floors/soil.png`);
}

// ---------- hedge wall (64 x 64, repeats sideways): leafy hedge, wooden fence with pointed posts, grass foot ----------
{
  const g = new Tile(64, 64);
  const ramp = { dark: C.pine, base: C.forest, lit: C.green, hi: C.lime };
  g.rect(0, 0, 64, 64, C.pine);
  // hedge: rounded leaf clumps across the band, repeating at 64
  const crown = { x: 0, y: 0, rx: 1e6, ry: 1e6 };
  const clump = (cx, cy, rx, ry, seed) => {
    const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
    for (let y = cy - ry - 1; y <= cy + ry + 1; y++) for (let x = cx - rx - 1; x <= cx + rx + 1; x++) {
      if (!inside(x, y)) continue;
      const nx = (x - cx) / rx, ny = (y - cy) / ry;
      const l = -0.6 * nx - 0.8 * ny + (hash(seed, x, y) > 0.8 ? 0.15 : 0);
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      let c = l > 0.5 ? ramp.hi : l > 0.1 ? ramp.lit : l > -0.35 ? ramp.base : ramp.dark;
      if (edge && l < 0.05) c = ramp.dark;
      g.set(x, y, c);
    }
  };
  for (let i = 0; i < 8; i++) { const x = i * 8 + 4 + (i % 2) * 1, y = 14 + (i % 3) * 3; clump(x, y, 8, 7, i); }
  for (let i = 0; i < 8; i++) { const x = i * 8 + (i % 2) * 3, y = 28 + ((i * 5) % 4); clump(x, y, 8, 8, 20 + i); }
  for (let i = 0; i < 4; i++) clump(i * 16 + 8, 6, 9, 6, 40 + i);
  // flowers in the hedge
  for (const [x, y, c] of [[10, 22, C.white], [30, 30, C.pink], [50, 18, C.butter], [22, 12, C.pink], [58, 34, C.white], [40, 26, C.butter]]) { g.set(x, y, c); g.set(x + 1, y, c); g.set(x, y - 1, C.butter); }
  // the fence: two rails across, posts every 32 px with pointed tops, in front of the hedge
  const rail = (y) => { g.rect(0, y, 64, 3, C.oak); g.rect(0, y, 64, 1, C.clay); g.rect(0, y + 2, 64, 1, C.walnut); for (let x = 0; x < 64; x++) { g.set(x, y - 1, C.out); g.set(x, y + 3, C.out); } };
  rail(36); rail(48);
  for (const px of [6, 38]) {
    g.rect(px - 1, 29, 8, 31, C.out);
    g.rect(px, 31, 6, 28, C.oak); g.rect(px, 31, 2, 28, C.clay); g.rect(px + 4, 31, 2, 28, C.walnut);
    g.rect(px + 1, 29, 4, 2, C.oak); g.set(px + 1, 29, C.clay); g.set(px + 2, 28, C.out); g.set(px + 3, 28, C.out); g.set(px + 1, 28, C.out); g.set(px + 4, 29, C.walnut);
    g.rect(px + 2, 31, 1, 6, C.clay); g.set(px + 4, 52, C.out); g.set(px + 1, 40, C.walnut);
  }
  // the foot: grass on the floor line with tufts and a shadow strip under the fence
  g.rect(0, 58, 64, 6, C.green);
  g.rect(0, 58, 64, 1, C.out);
  g.rect(0, 59, 64, 1, C.forest);
  for (const x of [4, 14, 27, 40, 53, 60]) { g.set(x, 62, C.lime); g.set(x + 1, 61, C.lime); g.set(x + 2, 62, C.lime); }
  for (const x of [9, 33, 47]) { g.set(x, 61, C.forest); g.set(x + 1, 60, C.forest); }
  g.save(`${OUT}/walls/hedge.png`);
}
console.log('grass, soil, hedge written');
