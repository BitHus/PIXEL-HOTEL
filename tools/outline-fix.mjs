// Thins a 2 px dark outline to 1 px and recolours the outer outline ring from near-black 181425 to the warm dark 3e2731.
// Usage: node tools/outline-fix.mjs <id...>   (furniture ids; edits client/src/assets/sprites/furniture/<id>.png in place; ids ending in _ready etc. are skipped by the caller)
// Ring 1 = opaque pixels with a transparent 4-neighbour. A dark ring-2 pixel (touching ring 1) is replaced by its most common
// non-dark neighbour colour, unless it borders a deeper dark pixel (a real dark shadow band stays).
import fs from 'fs'; import { PNG } from 'pngjs';
const dir = 'client/src/assets/sprites/furniture/';
const DARK = '181425', WARM = [0x3e, 0x27, 0x31];
for (const id of process.argv.slice(2)) {
  const p = PNG.sync.read(fs.readFileSync(dir + id + '.png')); const W = p.width, H = p.height;
  const A = (x, y) => x >= 0 && y >= 0 && x < W && y < H && p.data[(y * W + x) * 4 + 3] > 0;
  const hx = (x, y) => { const o = (y * W + x) * 4; return [p.data[o], p.data[o + 1], p.data[o + 2]].map(v => v.toString(16).padStart(2, '0')).join(''); };
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const ring1 = new Set(), ring2 = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) && N4.some(([dx, dy]) => !A(x + dx, y + dy))) ring1.add(y * W + x);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (A(x, y) && !ring1.has(y * W + x) && N4.some(([dx, dy]) => ring1.has((y + dy) * W + x + dx))) ring2.add(y * W + x);
  const isDark = (x, y) => A(x, y) && hx(x, y) === DARK;
  const edits = [];
  for (const k of ring2) {
    const x = k % W, y = (k - x) / W; if (!isDark(x, y)) continue;
    const n1 = N4.filter(([dx, dy]) => ring1.has((y + dy) * W + x + dx));
    if (!n1.some(([dx, dy]) => isDark(x + dx, y + dy))) continue; // outline is not dark here
    const deeper = N4.some(([dx, dy]) => { const nx = x + dx, ny = y + dy; return A(nx, ny) && !ring1.has(ny * W + nx) && !ring2.has(ny * W + nx) && isDark(nx, ny); });
    if (deeper) continue;
    const votes = new Map();
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const nx = x + dx, ny = y + dy; if (!A(nx, ny) || ring1.has(ny * W + nx) || (dx === 0 && dy === 0)) continue; const c = hx(nx, ny); if (c === DARK || c === '3e2731') continue; votes.set(c, (votes.get(c) || 0) + 1); }
    if (!votes.size) continue;
    const c = [...votes].sort((a, b) => b[1] - a[1])[0][0]; edits.push([x, y, [0, 2, 4].map(i => parseInt(c.slice(i, i + 2), 16))]);
  }
  for (const [x, y, c] of edits) { const o = (y * W + x) * 4; p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; }
  let rc = 0;
  for (const k of ring1) { const x = k % W, y = (k - x) / W; if (hx(x, y) === DARK) { const o = k * 4; p.data[o] = WARM[0]; p.data[o + 1] = WARM[1]; p.data[o + 2] = WARM[2]; rc++; } }
  fs.writeFileSync(dir + id + '.png', PNG.sync.write(p)); console.log(id, 'thinned', edits.length, 'recoloured', rc);
}
