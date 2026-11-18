// Draws the inn DOORWAY PNGs (Endesga 32 only, no alpha blending) into client/src/assets/sprites/doors/.
// Run: node tools/gen-door-art.mjs   (deterministic).  Canvas 96 x 64, anchor = bottom centre (48, 72) = the foot of the back wall band at the doorway centre.
// Stone arch frame (cool grey, 2 px dark outline) so it never merges with warm wallpaper; the opening is much darker or much lighter than any wall.
//   door_cellar_down.png / door_cellar_down_open.png  heavy plank door with iron bands and rings (closed) / swung open on dark steps going down (open, hover or arrival)
//   door_cellar_up.png     the way back: a bright stair going UP (lit from the tavern)
//   door_kitchen.png       timber frame with a red curtain, the warm kitchen behind
//   door_spill.png         64 x 14 dithered warm light on the floor in front (draw on the floor, anchor top centre)
import { writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const C = {
  rust: '#be4a2f', clay: '#d77643', cream: '#ead4aa', sand: '#e4a672', oak: '#b86f50', walnut: '#733e39', out: '#3e2731', crimson: '#a22633',
  red: '#e43b44', orange: '#f77622', gold: '#feae34', butter: '#fee761', lime: '#63c74d', green: '#3e8948', forest: '#265c42', pine: '#193c3e',
  white: '#ffffff', silver: '#c0cbdc', steel: '#8b9bb4', slate: '#5a6988', dusk: '#3a4466', night: '#262b44', void: '#181425', pink: '#f6757a',
};
const hash = (a, b = 0, c = 0) => { let h = (a * 374761393 + b * 668265263 + c * 2147483647) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const W = 96, H = 64, CX = 48, CY = 32, R = 31, r = 24;

class Img {
  constructor(w, h) { this.w = w; this.h = h; this.p = new Array(w * h).fill(null); }
  set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.p[y * this.w + x] = c; }
  get(x, y) { return x < 0 || y < 0 || x >= this.w || y >= this.h ? null : this.p[y * this.w + x]; }
  rect(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c); }
  save(file) {
    const png = new PNG({ width: this.w, height: this.h });
    this.p.forEach((c, i) => { if (!c) return; png.data[i * 4] = parseInt(c.slice(1, 3), 16); png.data[i * 4 + 1] = parseInt(c.slice(3, 5), 16); png.data[i * 4 + 2] = parseInt(c.slice(5, 7), 16); png.data[i * 4 + 3] = 255; });
    writeFileSync(file, PNG.sync.write(png));
  }
}
const OUT = 'client/src/assets/sprites/doors';
mkdirSync(OUT, { recursive: true });

// arch shapes: round top (circle centre CY) over straight sides down to the bottom
const inShape = (x, y, rad) => (y >= CY ? Math.abs(x - CX + 0.5) <= rad : (x - CX + 0.5) ** 2 + (y - CY + 0.5) ** 2 <= rad * rad);

/** The stone frame: voussoirs round the arch, courses on the posts, lit from the top-left, dark outline. */
function stoneFrame(g, rad = r) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inShape(x, y, R) || inShape(x, y, rad)) continue;
    const dx = x - CX + 0.5, dy = y - CY + 0.5;
    let joint = false, l;
    if (y < CY) {
      const ang = Math.atan2(-dy, dx); // 0 = right, pi/2 = top
      joint = Math.abs(((ang / (Math.PI / 9)) % 1 + 1) % 1 - 0.5) > 0.46;
      l = -0.6 * (dx / R) + 0.8 * (dy / R) * -1 * -1; // top-left lit
      l = (-0.6 * dx - 0.8 * dy) / R;
    } else {
      const row = Math.floor((y - CY) / 9), off = row % 2 ? 6 : 0;
      joint = (y - CY) % 9 === 8 || ((Math.abs(dx) < R - 0.5) && (Math.floor((x + off) / 12) !== Math.floor((x + off - 1) / 12) && false));
      l = dx < 0 ? 0.6 : -0.3;
      if (!joint) { const col = Math.floor((x + off) / 13); if ((x + off) % 13 === 0 && col !== 0) joint = true; }
    }
    const tone = joint ? C.dusk : l > 0.3 ? C.silver : l > -0.25 ? C.steel : C.slate;
    g.set(x, y, tone);
    if (!joint && hash(x, y, 3) > 0.93) g.set(x, y, l > 0 ? C.silver : C.slate);
  }
  // inner edge: a lit lip on the top-left, a dark line on the shaded side; outer: 2 px dark warm outline
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const o = inShape(x, y, R);
    if (!o) {
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]].some(([a, b]) => inShape(x + a, y + b, R));
      const near2 = !near && [[2, 0], [-2, 0], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2], [0, 2]].some(([a, b]) => inShape(x + a, y + b, R));
      if ((near || near2) && y < H) g.set(x, y, C.out);
    }
  }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!inShape(x, y, rad)) continue;
    const edge = !inShape(x - 1, y, rad) || !inShape(x + 1, y, rad) || !inShape(x, y - 1, rad) || (y < CY && !inShape(x, y + 1, rad));
    if (edge) g.set(x, y, C.void);
  }
  // keystone
  g.rect(CX - 4, CY - R, 8, R - r + 1, C.silver); g.rect(CX - 4, CY - R, 1, R - r + 1, C.white); g.rect(CX + 3, CY - R, 1, R - r + 1, C.steel);
  g.rect(CX - 5, CY - R - 1, 10, 1, C.out); g.rect(CX - 5, CY - R, 1, R - r + 1, C.out); g.rect(CX + 4, CY - R, 1, R - r + 1, C.out);
  g.rect(CX - 4, CY - r, 8, 1, C.slate);
  // the sill: a worn stone step under the opening
  g.rect(CX - r - 4, H - 3, 2 * r + 8, 3, C.steel); g.rect(CX - r - 4, H - 3, 2 * r + 8, 1, C.silver); g.rect(CX - r - 4, H - 1, 2 * r + 8, 1, C.slate);
  g.rect(CX - r - 5, H - 4, 1, 4, C.out); g.rect(CX + r + 4, H - 4, 1, 4, C.out); g.rect(CX - r - 4, H - 4, 2 * r + 8, 1, C.out);
}

/** A wall lantern on an iron bracket at the right of the arch, lit. */
function lantern(g, x, y) {
  g.rect(x - 7, y - 1, 8, 2, C.out); g.rect(x - 7, y, 7, 1, C.night); // bracket
  g.rect(x, y - 2, 1, 4, C.out);
  g.rect(x - 4, y + 2, 9, 11, C.out); // cage
  g.rect(x - 3, y + 3, 7, 9, C.gold); g.rect(x - 2, y + 4, 5, 7, C.butter); g.rect(x - 1, y + 5, 3, 4, C.white);
  g.rect(x - 4, y + 7, 9, 1, C.night); g.set(x, y + 3, C.night); g.set(x, y + 11, C.night);
  g.rect(x - 5, y + 1, 11, 2, C.out); g.rect(x - 4, y + 1, 9, 1, C.night); g.rect(x - 5, y + 13, 11, 1, C.out);
  // warm halo pixels on the wall around it (dither)
  for (let j = -4; j <= 18; j++) for (let i = -9; i <= 9; i++) {
    if (g.get(x + i, y + j)) continue;
    const d = Math.hypot(i, (j - 7) * 0.8);
    if (d > 7.5 && d < 9) g.set(x + i, y + j, C.rust);
  }
}

/** The plank door (closed): arched, two leaves, iron bands with rivets, rings. */
function plankDoor(g) {
  const rad = r - 2;
  g.rect(0, 0, 0, 0, C.void);
  for (let y = 0; y < H - 3; y++) for (let x = 0; x < W; x++) {
    if (!inShape(x, y, rad)) continue;
    const dx = x - (CX - rad); const plank = Math.floor(dx / 8), pos = dx % 8;
    let c = pos <= 1 ? C.clay : pos === 7 ? C.walnut : C.oak;
    if (pos === 6) c = C.walnut;
    if (Math.abs(x - CX + 0.5) < 1) c = C.out; // the centre gap
    if (hash(plank, y, 4) > 0.97) c = C.walnut;
    if (pos === 3 && hash(plank, Math.floor(y / 6), 5) > 0.6) c = C.walnut;
    g.set(x, y, c);
  }
  // dark gap between stone and door
  for (let y = 0; y < H - 3; y++) for (let x = 0; x < W; x++) if (inShape(x, y, r) && !inShape(x, y, rad)) g.set(x, y, C.void);
  // iron bands: three, following the arch at the top
  for (const by of [22, 36, 50]) for (let x = 0; x < W; x++) if (inShape(x, by, rad) && inShape(x, by + 3, rad)) {
    g.set(x, by, C.dusk); g.set(x, by + 1, C.night); g.set(x, by + 2, C.night); g.set(x, by + 3, C.void);
    if ((x - CX) % 6 === 2 && Math.abs(x - CX) > 2) g.set(x, by + 1, C.steel);
  }
  // hinges: spike ends at the outer edges of the top and middle bands
  for (const by of [22, 36, 50]) { g.rect(CX - rad, by - 1, 4, 5, C.night); g.set(CX - rad + 1, by + 1, C.steel); g.rect(CX + rad - 4, by - 1, 4, 5, C.night); g.set(CX + rad - 3, by + 1, C.steel); }
  // ring handles, one on each leaf, with a lit top-left edge
  for (const rx of [CX - 8, CX + 4]) {
    g.rect(rx, 40, 6, 7, C.void); g.rect(rx + 1, 41, 4, 5, C.oak); g.rect(rx + 2, 42, 2, 3, C.void);
    g.rect(rx + 1, 40, 4, 1, C.silver); g.set(rx, 41, C.silver); g.set(rx, 42, C.steel); g.set(rx + 5, 43, C.slate); g.rect(rx + 1, 46, 4, 1, C.slate);
    g.rect(rx + 2, 37, 2, 3, C.steel); // the ring plate
  }
}

/** The opened cellar door: dark opening, steps going down, the leaves swung back as slivers, warm glow from below. */
function openDoor(g) {
  const rad = r;
  for (let y = 0; y < H - 3; y++) for (let x = 0; x < W; x++) if (inShape(x, y, rad)) g.set(x, y, C.void);
  // steps: from far (high, dark, narrow) to near (low, bright, wide)
  const steps = [[30, C.slate, 12], [36, C.steel, 15], [42, C.silver, 18], [49, C.cream, 20], [55, C.white, 22]];
  steps.forEach(([y0, tread, half], i) => {
    const y1 = i === steps.length - 1 ? H - 3 : steps[i + 1][0];
    for (let y = y0; y < y1; y++) for (let x = CX - half; x < CX + half; x++) if (inShape(x, y, rad - 3)) g.set(x, y, y - y0 < 2 ? tread : y - y0 < 4 ? shadeOf(tread) : C.walnut);
    for (let x = CX - half; x < CX + half; x++) if (inShape(x, y0, rad - 3)) g.set(x, y0, tread);
  });
  // warm glow far down the stairs (a dithered orange haze above the first step)
  for (let y = 14; y < 30; y++) for (let x = CX - 12; x < CX + 12; x++) { const d = Math.hypot((x - CX) / 12, (y - 30) / 16); if (d < 1 && (x + y) % 2 === 0 && hash(x, y, 9) < 0.7 * (1 - d)) g.set(x, y, d < 0.5 ? C.orange : C.rust); }
  g.rect(CX - 3, 28, 6, 2, C.gold); g.rect(CX - 2, 29, 4, 1, C.butter);
  // the leaves swung back: narrow slivers on both sides with bands
  for (const s of [-1, 1]) for (let y = 10; y < H - 3; y++) {
    const xo = s < 0 ? CX - r : CX + r - 7;
    for (let x = xo; x < xo + 7; x++) {
      if (!inShape(x, y, r - 1)) continue;
      const pos = s < 0 ? x - xo : 6 - (x - xo);
      g.set(x, y, pos === 0 ? C.clay : pos < 4 ? C.oak : C.walnut);
    }
    if ([22, 36, 50].some((by) => y >= by && y <= by + 2)) for (let x = xo; x < xo + 7; x++) if (inShape(x, y, r - 1)) g.set(x, y, C.night);
  }
}
const shadeOf = (c) => ({ [C.dusk]: C.night, [C.slate]: C.dusk, [C.steel]: C.slate, [C.silver]: C.steel, [C.sand]: C.oak, [C.cream]: C.oak, [C.white]: C.sand }[c] ?? c);

/** The way back (inside the cellar): a stair going UP, bright warm light from the tavern at the top. */
function upStairs(g) {
  const rad = r;
  for (let y = 0; y < H - 3; y++) for (let x = 0; x < W; x++) if (inShape(x, y, rad)) {
    // a light gradient from a bright top (the tavern) to a shaded bottom
    const t = (y - (CY - rad)) / (H - 3 - (CY - rad));
    const tones = [C.butter, C.cream, C.sand, C.oak];
    const idx = Math.min(3, Math.floor(t * 4));
    g.set(x, y, tones[Math.max(0, idx)]);
  }
  // steps: risers are dark lines, treads lighter, each lower one wider
  const rows = [[20, 11], [26, 14], [33, 17], [40, 19], [48, 21], [56, 23]];
  rows.forEach(([y, half], i) => {
    for (let x = CX - half; x < CX + half; x++) { if (!inShape(x, y, rad - 1)) continue; g.set(x, y, C.walnut); g.set(x, y + 1, C.out); if (inShape(x, y - 1, rad - 1)) g.set(x, y - 1, i === 0 ? C.white : C.cream); }
  });
  // a banister rail on the right side and the light at the top
  g.rect(CX + 12, 18, 2, 40, C.oak); g.rect(CX + 12, 18, 1, 40, C.clay); g.rect(CX + 13, 18, 1, 40, C.walnut);
  for (let y = 18; y < 58; y += 10) { g.rect(CX + 11, y, 4, 2, C.out); }
  g.rect(CX - 9, 10, 18, 3, C.white);
}

/** The kitchen doorway: a timber frame, a red curtain tied back, the warm kitchen with a fire glow and a floor strip behind. */
function kitchen(g) {
  const half = 24, top = 10;
  g.rect(CX - half - 10, top - 10, 2 * half + 20, H - top + 10, C.out); // outline block
  g.rect(CX - half - 8, top - 8, 2 * half + 16, H - top + 8, C.walnut);
  // timber posts and lintel, lit from the top-left
  g.rect(CX - half - 8, top - 8, 2 * half + 16, 9, C.walnut); g.rect(CX - half - 8, top - 8, 2 * half + 16, 2, C.oak); g.rect(CX - half - 8, top, 2 * half + 16, 1, C.out);
  for (const [x0, w] of [[CX - half - 8, 8], [CX + half, 8]]) { g.rect(x0, top - 8, w, H - top + 8, C.walnut); g.rect(x0, top - 8, 2, H - top + 8, C.oak); g.rect(x0 + w - 2, top - 8, 2, H - top + 8, C.out); }
  for (const x of [CX - half - 6, CX + half + 2]) for (let y = top + 6; y < H - 4; y += 11) g.rect(x, y, 2, 2, C.steel); // nail heads
  g.rect(CX - half - 8, top - 8, 2 * half + 16, 1, C.out);
  // the opening: a dim warm room
  g.rect(CX - half, top + 1, 2 * half, H - top - 1, C.night);
  for (let y = top + 1; y < H; y++) for (let x = CX - half; x < CX + half; x++) {
    const d = Math.hypot((x - (CX + 6)) / 26, (y - (H - 14)) / 30);
    if (d < 0.35) g.set(x, y, C.orange); else if (d < 0.7) g.set(x, y, C.rust); else if (d < 1) g.set(x, y, C.walnut);
  }
  g.rect(CX + 2, H - 30, 14, 2, C.dusk); // a shelf with pots
  g.rect(CX + 3, H - 36, 4, 6, C.slate); g.rect(CX + 3, H - 36, 4, 1, C.steel); g.rect(CX + 9, H - 34, 5, 4, C.clay); g.rect(CX + 9, H - 34, 5, 1, C.sand);
  g.rect(CX - half + 2, H - 26, 5, 2, C.silver); g.set(CX - half + 3, H - 24, C.silver); // a hanging ladle
  // fire glow on the floor strip
  g.rect(CX - half, H - 8, 2 * half, 8, C.walnut);
  for (let x = CX - half; x < CX + half; x += 8) g.rect(x, H - 8, 1, 8, C.out);
  g.rect(CX - half, H - 8, 2 * half, 1, C.oak);
  for (let x = CX - 8; x < CX + 18; x++) if (x % 2 === 0) g.set(x, H - 7, C.gold);
  // the curtain: red valance with scalloped hem, drawn back to both sides
  g.rect(CX - half, top + 1, 2 * half, 6, C.crimson);
  for (let x = CX - half; x < CX + half; x++) { const s = (x - CX + half) % 6; g.set(x, top + 7, s < 3 ? C.crimson : C.red); if (s < 3) g.set(x, top + 8, C.crimson); g.set(x, top + 1, C.red); if (s === 0) g.rect(x, top + 2, 1, 5, C.red); }
  for (const s of [-1, 1]) {
    const x0 = s < 0 ? CX - half : CX + half - 8;
    for (let y = top + 7; y < H - 6; y++) {
      const sag = Math.round(Math.sin((y - top) / 8) * 1.2) * 0;
      const w = y > H - 26 && y < H - 18 ? 4 : 7 - Math.floor((y - top) / 16);
      for (let k = 0; k < w; k++) { const x = s < 0 ? x0 + k : x0 + 8 - 1 - k; g.set(x + sag, y, k === 0 ? C.crimson : (k + y) % 3 === 0 ? C.crimson : C.red); }
    }
    g.rect(s < 0 ? CX - half : CX + half - 8, H - 26, 8, 3, C.gold); // tie-back cord
  }
  g.rect(CX - half, top + 1, 2 * half, 1, C.pink);
  g.rect(CX - half - 8, H - 3, 2 * half + 16, 3, C.steel); g.rect(CX - half - 8, H - 3, 2 * half + 16, 1, C.silver);
  for (let y = top - 11; y < H; y++) for (const x of [CX - half - 11, CX - half - 12, CX + half + 10, CX + half + 11]) g.set(x, y, x < CX ? (x === CX - half - 12 ? C.out : C.silver) : (x === CX + half + 11 ? C.out : C.steel));
  for (let x = CX - half - 12; x <= CX + half + 11; x++) { g.set(x, top - 11, C.out); g.set(x, top - 10, x < CX ? C.silver : C.steel); }
}

// ----- build the sheets -----
{
  const g = new Img(W, H); stoneFrame(g); plankDoor(g); lantern(g, 88, 20); g.save(`${OUT}/door_cellar_down.png`);
  const o = new Img(W, H); stoneFrame(o); openDoor(o); lantern(o, 88, 20); o.save(`${OUT}/door_cellar_down_open.png`);
  const u = new Img(W, H); stoneFrame(u); upStairs(u); u.save(`${OUT}/door_cellar_up.png`);
  const k = new Img(W, H); kitchen(k); k.save(`${OUT}/door_kitchen.png`);
  const s = new Img(64, 14);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot((x - 31.5) / 32, y / 13);
    if (d < 1 && ((x + y) % 2 === 0) && hash(x, y, 8) < 1.1 * (1 - d)) s.set(x, y, d < 0.45 ? C.gold : d < 0.75 ? C.orange : C.rust);
  }
  s.save(`${OUT}/door_spill.png`);
}
console.log('doors written');
