// Audit: per furniture PNG, the colour of the outer outline ring and its thickness (rows/cols of dark pixels deep from the edge).
// Usage: node tools/outline-audit.mjs [ids...]   (default all)
import fs from 'fs'; import { PNG } from 'pngjs';
const dir = 'client/src/assets/sprites/furniture/';
const ids = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(dir).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));
const hx = (r, g, b) => [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
const DARK = new Set(['181425']); 
for (const id of ids) {
  const p = PNG.sync.read(fs.readFileSync(dir + id + '.png')); const W = p.width, H = p.height;
  const op = (x, y) => x >= 0 && y >= 0 && x < W && y < H && p.data[(y * W + x) * 4 + 3] > 0;
  const col = (x, y) => { const o = (y * W + x) * 4; return hx(p.data[o], p.data[o + 1], p.data[o + 2]); };
  let edge = 0, edgeDark = 0, thick2 = 0, total = 0;
  const hist = {};
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (op(x, y)) {
    total++;
    const e = !op(x - 1, y) || !op(x + 1, y) || !op(x, y - 1) || !op(x, y + 1);
    if (!e) continue; edge++; const c = col(x, y); hist[c] = (hist[c] || 0) + 1; if (DARK.has(c)) edgeDark++;
    // second ring dark too?
    const inner = [[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy]) => { const nx=x+dx, ny=y+dy; return op(nx,ny) && !( !op(nx-1,ny)||!op(nx+1,ny)||!op(nx,ny-1)||!op(nx,ny+1)) && DARK.has(col(nx,ny)); });
    if (inner && DARK.has(c)) thick2++;
  }
  const top = Object.entries(hist).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([c, n]) => `${c}:${n}`).join(' ');
  console.log(id.padEnd(22), `${W}x${H}`.padEnd(8), `edge ${edge} black ${(100 * edgeDark / edge).toFixed(0)}% thick2 ${(100 * thick2 / Math.max(1, edgeDark)).toFixed(0)}%  ${top}`);
}
