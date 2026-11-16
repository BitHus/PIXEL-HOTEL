// Draws the floor and wall style PNGs (64x64, Endesga 32 colours only) into client/src/assets/sprites.
// Run: node tools/gen-style-art.mjs   (deterministic; floors repeat in both axes, walls sideways.)
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const P = { rust: '#be4a2f', clay: '#d77643', cream: '#ead4aa', sand: '#e4a672', oak: '#b86f50', walnut: '#733e39', outline: '#3e2731', crimson: '#a22633', red: '#e43b44', orange: '#f77622', gold: '#feae34', butter: '#fee761', lime: '#63c74d', green: '#3e8948', forest: '#265c42', silver: '#c0cbdc', steel: '#8b9bb4', slate: '#5a6988', dusk: '#3a4466', night: '#262b44', skin: '#e8b796', tan: '#c28569' };
const N = 64;
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const mk = (fill) => {
  const g = Array.from({ length: N }, () => Array(N).fill(fill));
  g.set = (x, y, c) => { g[((y % N) + N) % N][((x % N) + N) % N] = c; };
  g.rect = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) g.set(x + i, y + j, c); };
  return g;
};

function png(g, file) {
  const stride = N * 4 + 1;
  const raw = Buffer.alloc(N * stride);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const h = g[y][x], o = y * stride + 1 + x * 4;
    raw[o] = parseInt(h.slice(1, 3), 16); raw[o + 1] = parseInt(h.slice(3, 5), 16); raw[o + 2] = parseInt(h.slice(5, 7), 16); raw[o + 3] = 255;
  }
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

// Planks: rows of height h; each row lists plank lengths (sum 64) so joints repeat.
function planks(seed, h, rows, tones, hi, gap, grain, nails) {
  const g = mk(tones[0]);
  rows.forEach((lens, r) => {
    let x = 0; const y0 = r * h;
    lens.forEach((L, i) => {
      g.rect(x, y0, L, h, tones[Math.floor(hash(seed, r, i) * tones.length)]);
      g.rect(x, y0, L, 1, hi); g.rect(x, y0, 1, h, hi); // light from the top-left
      g.rect(x, y0 + h - 1, L, 1, gap); g.rect(x + L - 1, y0, 1, h, gap);
      for (let k = 0; k < Math.max(1, L >> 3); k++) {
        const gx = x + 3 + Math.floor(hash(seed, r * 9 + i, k) * (L - 9)), gy = y0 + 2 + Math.floor(hash(seed + 1, r * 9 + i, k) * (h - 4));
        g.rect(gx, gy, 3 + Math.floor(hash(seed + 2, r, k + i) * 4), 1, grain);
      }
      if (nails) { g.set(x + 2, y0 + 2, gap); g.set(x + L - 3, y0 + h - 3, gap); }
      x += L;
    });
  });
  return g;
}

const floors = {
  bare: () => planks(11, 16, [[40, 24], [16, 36, 12], [28, 36], [8, 32, 24]], [P.oak, P.tan, P.oak, P.oak], P.tan, P.walnut, P.walnut, false),
  wood_planks: () => planks(23, 8, [[24, 40], [40, 24], [8, 32, 24], [32, 32], [16, 24, 24], [36, 28], [12, 40, 12], [28, 36]], [P.oak, P.tan, P.oak, P.sand], P.sand, P.walnut, P.walnut, true),
  stone_tiles: () => {
    const g = mk(P.steel);
    [[0, 20, [0, 28, 64]], [20, 24, [0, 36, 64]], [44, 20, [0, 20, 64]]].forEach(([y0, h, xs], r) => {
      for (let i = 0; i < xs.length - 1; i++) {
        const x0 = xs[i], w = xs[i + 1] - x0, tone = [P.steel, P.silver, P.steel, P.steel][Math.floor(hash(31, r, i) * 4)];
        g.rect(x0, y0, w, h, tone);
        g.rect(x0, y0, w, 1, P.silver); g.rect(x0, y0, 1, h, P.silver);
        g.rect(x0, y0 + h - 1, w, 1, P.slate); g.rect(x0 + w - 1, y0, 1, h, P.slate);
        for (let k = 0; k < 3; k++) g.rect(x0 + 3 + Math.floor(hash(32, r * 5 + i, k) * (w - 8)), y0 + 3 + Math.floor(hash(33, r * 5 + i, k) * (h - 6)), 2, 1, P.slate);
      }
    });
    g.rect(10, 8, 1, 4, P.dusk); g.rect(11, 11, 3, 1, P.dusk); g.rect(46, 52, 4, 1, P.dusk);
    return g;
  },
  crypt_flagstones: () => {
    const g = mk(P.dusk);
    for (let r = 0; r < 2; r++) for (let i = 0; i < 2; i++) {
      const x0 = i * 32 + (r ? 16 : 0), y0 = r * 32;
      g.rect(x0, y0, 32, 32, [P.dusk, P.slate, P.dusk][Math.floor(hash(41, r, i) * 3)]);
      g.rect(x0, y0, 32, 1, P.steel); g.rect(x0, y0, 1, 32, P.steel);
      g.rect(x0, y0 + 31, 32, 1, P.night); g.rect(x0 + 31, y0, 1, 32, P.night);
      g.rect(x0 + 8, y0 + 12, 6, 1, P.night); g.rect(x0 + 18, y0 + 22, 4, 1, P.night);
    }
    return g;
  },
  red_carpet: () => {
    const g = mk(P.crimson);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const dx = Math.abs(((x + 8) % 16) - 8), dy = Math.abs(((y + 8) % 16) - 8);
      if (dx + dy === 8) g.set(x, y, P.rust);
      else if (dx + dy < 3) g.set(x, y, P.gold);
      else if (dx + dy === 3 && (x + y) % 2 === 0) g.set(x, y, P.walnut);
    }
    for (let y = 0; y < N; y += 16) for (let x = 0; x < N; x += 16) g.set(x + 8, y + 8, P.butter);
    for (let x = 0; x < N; x++) if (hash(51, x) > 0.8) g.set(x, 0, P.red);
    return g;
  },
  soil: () => {
    const g = mk(P.walnut);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = hash(61, x, y); if (v > 0.97) g.set(x, y, P.oak); else if (v < 0.03) g.set(x, y, P.outline); }
    for (let y = 4; y < N; y += 16) { g.rect(0, y, N, 3, P.outline); g.rect(0, y + 3, N, 1, P.oak); g.rect(0, y - 1, N, 1, P.walnut); }
    for (const [x, y] of [[6, 12], [22, 26], [40, 10], [54, 42], [14, 54], [34, 38]]) { g.rect(x, y, 2, 1, P.tan); g.set(x, y + 1, P.outline); }
    return g;
  },
  grass: () => {
    const g = mk(P.green);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const v = hash(71, x, y); if (v > 0.96) g.set(x, y, P.lime); else if (v < 0.05) g.set(x, y, P.forest); }
    for (const [x, y] of [[5, 7], [22, 3], [41, 12], [57, 25], [12, 30], [33, 37], [50, 49], [8, 52], [27, 58], [44, 61]]) { g.set(x, y, P.lime); g.set(x + 2, y - 1, P.lime); g.set(x + 2, y, P.lime); g.set(x + 1, y + 1, P.forest); }
    for (const [x, y, c] of [[17, 18, P.butter], [53, 6, P.cream], [38, 50, P.butter]]) g.set(x, y, c);
    return g;
  },
};

// Walls: 64 px band, tile repeats sideways. Row 0 = top edge, rows 60..63 = shadow line and foot outline.
function wallFoot(g) { g.rect(0, 0, N, 1, P.outline); g.rect(0, 60, N, 1, P.walnut); g.rect(0, 61, N, 3, P.outline); }
const walls = {
  // bare = a warm timber-and-plaster tavern wall: plaster, timber posts every 32 px, beam, plank wainscot.
  bare: () => {
    const g = mk(P.cream);
    for (let y = 1; y < 38; y++) for (let x = 0; x < N; x++) { const v = hash(81, x, y); g.set(x, y, v > 0.93 ? P.skin : v < 0.05 ? P.sand : P.cream); }
    g.rect(0, 1, N, 7, P.walnut); g.rect(0, 1, N, 1, P.oak); g.rect(0, 7, N, 1, P.outline);
    for (const px of [0, 32]) { g.rect(px, 8, 6, 30, P.walnut); g.rect(px, 8, 1, 30, P.oak); g.rect(px + 5, 8, 1, 30, P.outline); g.rect(px + 2, 14, 1, 6, P.outline); g.rect(px + 3, 26, 1, 5, P.outline); }
    for (let x = 6; x < 32; x++) { g.set(x, 36, P.tan); g.set(x + 32, 36, P.tan); }
    g.rect(0, 38, N, 4, P.walnut); g.rect(0, 38, N, 1, P.oak); g.rect(0, 41, N, 1, P.outline);
    g.rect(0, 42, N, 18, P.oak);
    for (let x = 0; x < N; x += 8) { g.rect(x, 42, 1, 18, P.walnut); g.rect(x + 1, 42, 1, 18, P.tan); g.rect(x + 4, 48 + (x % 16 ? 3 : 0), 1, 5, P.walnut); }
    g.rect(0, 42, N, 2, P.walnut);
    wallFoot(g); return g;
  },
  plaster: () => {
    const g = mk(P.cream);
    for (let y = 1; y < 46; y++) for (let x = 0; x < N; x++) { const v = hash(91, x, y); g.set(x, y, v > 0.92 ? P.skin : v < 0.04 ? P.sand : P.cream); }
    g.rect(0, 1, N, 2, P.skin);
    g.rect(0, 46, N, 3, P.sand); g.rect(0, 46, N, 1, P.cream); g.rect(0, 48, N, 1, P.tan);
    g.rect(0, 49, N, 11, P.skin); for (let x = 0; x < N; x += 16) g.rect(x, 49, 1, 11, P.tan);
    g.rect(0, 49, N, 2, P.tan);
    g.rect(0, 54, N, 6, P.oak); g.rect(0, 54, N, 1, P.sand);
    for (const [x, y] of [[9, 12], [34, 20], [52, 9], [20, 34]]) g.rect(x, y, 3, 1, P.sand);
    wallFoot(g); return g;
  },
  wood_panels: () => {
    const g = mk(P.walnut);
    g.rect(0, 1, N, 5, P.oak); g.rect(0, 1, N, 1, P.tan); g.rect(0, 5, N, 1, P.outline);
    for (let x = 0; x < N; x += 16) {
      g.rect(x + 2, 9, 12, 20, P.walnut); g.rect(x + 2, 9, 12, 1, P.oak); g.rect(x + 2, 9, 1, 20, P.oak); g.rect(x + 13, 9, 1, 20, P.outline); g.rect(x + 2, 28, 12, 1, P.outline);
      g.rect(x, 6, 2, 30, P.outline); g.rect(x + 1, 6, 1, 30, P.oak);
      g.rect(x + 6, 14, 1, 8, P.oak); g.rect(x + 9, 20, 1, 6, P.outline);
    }
    g.rect(0, 32, N, 4, P.oak); g.rect(0, 32, N, 1, P.tan); g.rect(0, 35, N, 1, P.outline);
    for (let x = 0; x < N; x += 16) { g.rect(x + 2, 38, 12, 20, P.oak); g.rect(x + 2, 38, 12, 1, P.tan); g.rect(x + 2, 38, 1, 20, P.tan); g.rect(x + 13, 38, 1, 20, P.walnut); g.rect(x + 2, 57, 12, 1, P.walnut); g.rect(x, 36, 2, 24, P.outline); g.rect(x + 7, 44, 1, 7, P.walnut); }
    g.rect(0, 36, N, 2, P.outline);
    wallFoot(g); return g;
  },
  brick: () => {
    const g = mk(P.skin);
    for (let r = 0; r < 7; r++) for (let i = -1; i < 4; i++) {
      const x0 = i * 16 + (r % 2 ? 8 : 0), y0 = 1 + r * 8, tone = [P.clay, P.rust, P.oak, P.rust][Math.floor(hash(101, r, ((i % 4) + 4) % 4) * 4)];
      const lit = tone === P.oak ? P.tan : tone === P.clay ? P.orange : P.clay;
      for (let j = 0; j < 7; j++) for (let k = 0; k < 15; k++) g.set(x0 + k, y0 + j, j === 0 ? lit : j === 6 || k === 14 ? P.walnut : tone);
      g.set(x0 + 5, y0 + 3, P.walnut); g.set(x0 + 9, y0 + 2, P.clay);
    }
    g.rect(0, 53, N, 7, P.walnut); for (let x = 0; x < N; x += 16) g.rect(x, 53, 1, 7, P.outline); g.rect(0, 53, N, 1, P.oak);
    wallFoot(g); return g;
  },
};

const root = fileURLToPath(new URL('../client/src/assets/sprites/', import.meta.url));
for (const [id, f] of Object.entries(floors)) png(f(), `${root}floors/${id}.png`);
for (const [id, f] of Object.entries(walls)) png(f(), `${root}walls/${id}.png`);
console.log('ok');
