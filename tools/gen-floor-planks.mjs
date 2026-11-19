// Calm plank floor (owner 19 Nov: "you see the pattern too much"): horizontal boards of random length, no knots or nails,
// dim seams, grain as soft sparse streaks whose density follows a broad wrapped noise (soft lighter/darker patches).
// Seamless in x and y (everything wraps). Endesga 32 colours only.
// usage: node tools/gen-floor-planks.mjs out.png [size=256] [seed=1] [seam=3e2731] [joint=68386c] [base=733e39] [hi=b86f50] [lo=3e2731] [plank=8] [hiRate=0.10] [loRate=0.05] [lmin=3 lmax=9 gmin=4 gmax=14 streak length and gap]
import { PNG } from 'pngjs'; import fs from 'fs';
const [out, ...rest] = process.argv.slice(2);
const a = Object.fromEntries(rest.map((s) => s.split('=')));
const N = Number(a.size ?? 256), PH = Number(a.plank ?? 8);
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const BASE = hex(a.base ?? '733e39'), HI = hex(a.hi ?? 'b86f50'), LO = hex(a.lo ?? '3e2731');
const SEAM = hex(a.seam ?? '3e2731'), JOINT = hex(a.joint ?? '68386c');
const hiRate = Number(a.hiRate ?? 0.1), loRate = Number(a.loRate ?? 0.05);
let s = Number(a.seed ?? 1) * 2654435761 >>> 0;
const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
// broad wrapped value noise: a few random cosines with whole periods over N
const waves = Array.from({ length: 4 }, () => ({ kx: ri(1, 2), ky: ri(1, 2), ph: rnd() * 6.28, w: 0.5 + rnd() }));
const broad = (x, y) => waves.reduce((v, q) => v + q.w * Math.cos(6.283 * (q.kx * x + q.ky * y) / N + q.ph), 0) / waves.reduce((v, q) => v + q.w, 0);
const img = Array.from({ length: N }, () => Array(N).fill(BASE));
const rows = N / PH;
for (let r = 0; r < rows; r++) {
  const y0 = r * PH;
  // board ends along this row (wrapping); min length 40, max 136 for a 256 tile
  const ends = []; let x = ri(0, N - 1); const start = x; let total = 0;
  const minL = N >= 192 ? 40 : 24, maxL = N >= 192 ? 136 : 56;
  while (total < N - minL) { ends.push((start + total) % N); total += ri(minL, maxL); }
  for (const e of ends) for (let y = y0; y < y0 + PH - 1; y++) img[y][e] = JOINT;
  for (let xx = 0; xx < N; xx++) img[y0 + PH - 1][xx] = SEAM;
  // grain streaks: short horizontal runs, density from the broad noise and a per-board offset
  for (let y = y0; y < y0 + PH - 1; y++) {
    let xx = 0;
    while (xx < N) {
      const b = broad(xx, y);
      const ph = hiRate * (1 + b), pl = loRate * (1 - b);
      const len = ri(Number(a.lmin ?? 3), Number(a.lmax ?? 9)), u = rnd();
      const col = u < ph ? HI : u < ph + pl ? LO : null;
      if (col) for (let k = 0; k < len; k++) { const X = (xx + k) % N; if (img[y][X] === BASE) img[y][X] = col; }
      xx += len + ri(Number(a.gmin ?? 4), Number(a.gmax ?? 14));
    }
  }
}
const p = new PNG({ width: N, height: N });
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4, c = img[y][x]; p.data[i] = c[0]; p.data[i + 1] = c[1]; p.data[i + 2] = c[2]; p.data[i + 3] = 255; }
fs.writeFileSync(out, PNG.sync.write(p)); console.log('wrote', out, N);
