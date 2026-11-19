// Calm seamless floor styles (owner 19 Nov): flagstone, clay tile, chequer, cobble, carpet. Everything wraps (seamless x and y),
// Endesga 32 only, low contrast, no single feature the eye can lock onto. Wood boards: tools/gen-floor-planks.mjs.
// usage: node tools/gen-floor-styles.mjs <flag|clay|chequer|cobble|carpet> out.png [size=256] [seed=1]
import { PNG } from 'pngjs'; import fs from 'fs';
const [mode, out, sizeArg = '256', seedArg = '1'] = process.argv.slice(2);
const N = Number(sizeArg);
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
let s = (Number(seedArg) * 2654435761) >>> 0 || 1;
const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const waves = Array.from({ length: 4 }, () => ({ kx: ri(1, 2), ky: ri(1, 2), ph: rnd() * 6.28, w: 0.5 + rnd() }));
const broad = (x, y) => waves.reduce((v, q) => v + q.w * Math.cos(6.283 * (q.kx * x + q.ky * y) / N + q.ph), 0) / waves.reduce((v, q) => v + q.w, 0);
const img = Array.from({ length: N }, () => Array(N).fill(null));
const put = (x, y, c) => { img[((y % N) + N) % N][((x % N) + N) % N] = c; };
const get = (x, y) => img[((y % N) + N) % N][((x % N) + N) % N];
// sparse speckle in a stone/tile body: short 1-3 px runs of a near tone
const speckle = (x0, y0, w, h, base, tone, rate) => { for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) if (rnd() < rate * (1 + broad(x, y) * 0.6)) { const l = ri(1, 3); for (let k = 0; k < l && x + k < x0 + w; k++) if (get(x + k, y) === base) put(x + k, y, tone); } };

if (mode === 'flag') { // irregular grey flagstones in courses of 16/24/32 px, stones 24..64 wide, 1 px dark joint, faint lit top edge
  const G = hex('262b44'), A = hex('3a4466'), B = hex('5a6988'), L = hex('8b9bb4');
  const courses = []; let tot = 0; while (tot < N) { let h = [16, 24, 32][ri(0, 2)]; if (N - tot - h < 16 && N - tot - h !== 0) h = N - tot; courses.push([tot, h]); tot += h; }
  for (const [y0, h] of courses) {
    let x = ri(0, N - 1); const start = x; let done = 0;
    while (done < N) { let w = ri(N >= 128 ? 28 : 20, N >= 128 ? 64 : 32); if (N - done - w < 20) w = N - done; const base = rnd() < 0.55 ? A : B;
      for (let yy = 0; yy < h; yy++) for (let xx = 0; xx < w; xx++) put(start + done + xx, y0 + yy, (yy === h - 1 || xx === w - 1) ? G : base);
      for (let xx = 1; xx < w - 2; xx++) if (rnd() < 0.7) put(start + done + xx, y0, base === A ? B : L); // lit top edge, broken
      speckle(start + done, y0 + 1, w - 1, h - 2, base, base === A ? G : A, 0.025);
      done += w; }
  }
} else if (mode === 'clay') { // terracotta squares 16 px, two close tones by tile, grout dark, lit top-left corner nick
  const GR = hex('733e39'), T1 = hex('b86f50'), T2 = hex('be4a2f'), T3 = hex('c28569');
  for (let ty = 0; ty < N; ty += 16) for (let tx = 0; tx < N; tx += 16) {
    const b = broad(tx, ty), base = rnd() < 0.5 + b * 0.25 ? T1 : T2;
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) put(tx + x, ty + y, (x === 15 || y === 15) ? GR : base);
    for (let x = 1; x < 6; x++) put(tx + x, ty, T3); put(tx, ty + 1, T3); put(tx, ty + 2, T3);
    speckle(tx + 1, ty + 1, 13, 13, base, base === T1 ? T2 : T1, 0.02);
  }
} else if (mode === 'chequer') { // dark slate and dark plum chequer of 32 px (= one build cell), soft speckle, thin joint
  const A = hex('262b44'), B = hex('3e2731'), J = hex('181425'), SA = hex('3a4466'), SB = hex('733e39');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const c = ((x >> 5) + (y >> 5)) & 1; put(x, y, (x % 32 === 31 || y % 32 === 31) ? J : c ? B : A); }
  for (let ty = 0; ty < N; ty += 32) for (let tx = 0; tx < N; tx += 32) { const c = ((tx >> 5) + (ty >> 5)) & 1; speckle(tx, ty, 31, 31, c ? B : A, c ? SB : SA, 0.012); }
} else if (mode === 'cobble') { // rounded cobbles: jittered grid of 12 px, nearest point with wrap, joints where the owner changes
  const J = hex('262b44'), A = hex('3a4466'), B = hex('5a6988'), L = hex('8b9bb4'), W = hex('3e2731');
  const C = 12, n = Math.floor(N / C), cell = N / n, pts = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) pts.push({ x: (i + 0.25 + rnd() * 0.5) * cell, y: (j + 0.25 + rnd() * 0.5) * cell, c: rnd() < 0.6 ? A : rnd() < 0.85 ? B : W });
  const own = Array.from({ length: N }, () => Array(N).fill(0));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const ci = Math.floor(x / cell), cj = Math.floor(y / cell); let best = 1e9, bi = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const i = (ci + di + n) % n, j = (cj + dj + n) % n, p = pts[j * n + i];
      let dx = Math.abs(x - p.x); dx = Math.min(dx, N - dx); let dy = Math.abs(y - p.y); dy = Math.min(dy, N - dy); const d = dx * dx + dy * dy; if (d < best) { best = d; bi = j * n + i; } }
    own[y][x] = bi; }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const o = own[y][x], edge = own[y][(x + 1) % N] !== o || own[(y + 1) % N][x] !== o; put(x, y, edge ? J : pts[o].c); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const o = own[y][x]; if (get(x, y) === J) continue; if (get(x, y - 1) === J && get(x - 1, y) !== J && pts[o].c !== W) put(x, y, pts[o].c === A ? B : L); }
} else if (mode === 'carpet') { // deep red woven carpet: weave dots and a faint 32 px diamond lattice in a near red
  const R = hex('a22633'), D = hex('68386c'), H = hex('be4a2f');
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) put(x, y, R);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const u = (x + y) % 32, v = ((x - y) % 32 + 32) % 32; if (u === 0 || v === 0) put(x, y, (x + y) % 2 ? D : R); else if ((x * 7 + y * 3) % 11 === 0 && rnd() < 0.5) put(x, y, H); }
  for (let y = 16; y < N; y += 32) for (let x = 0; x < N; x += 32) { put(x, y, H); put(x + 1, y, H); put(x, y + 1, H); }
} else { console.log('unknown mode', mode); process.exit(1); }
const p = new PNG({ width: N, height: N });
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { const i = (y * N + x) * 4, c = img[y][x] ?? [255, 0, 255]; p.data[i] = c[0]; p.data[i + 1] = c[1]; p.data[i + 2] = c[2]; p.data[i + 3] = 255; }
fs.writeFileSync(out, PNG.sync.write(p)); console.log('wrote', out, mode, N);
