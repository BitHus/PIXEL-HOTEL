// Draws the inn DOORWAY PNGs (Endesga 32 only, no alpha blending) into client/src/assets/sprites/doors/.
// Run: node tools/gen-door-art.mjs   (deterministic).  Canvas 96 x 64, anchor = bottom centre (48, 72) = the foot of the back wall band at the doorway centre.
// Stone arch frame (cool grey, 2 px dark outline) so it never merges with warm wallpaper; the opening is much darker or much lighter than any wall.
//   door_cellar_down.png / door_cellar_down_open.png  heavy plank door with iron bands and rings (closed) / swung open on dark steps going down (open, hover or arrival)
//   door_cellar_up.png     the way back: a bright stair going UP (lit from the tavern)
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

/** DOOR DEPTH (19 Nov): the opening is a hole through a THICK wall. A 5 px reveal ring inside the frame shows the wall thickness (left jamb face in shade, right jamb face lit by the top-left light, the top dark under the lintel), the interior sits recessed behind it with a cast shadow, and a two-part worn threshold step (lit top face, front face) projects at the foot. Painted AFTER the interior. */
function depth(g) {
  const RV = 5; // reveal thickness in px
  for (let y = 0; y < H - 5; y++) for (let x = 0; x < W; x++) {
    if (!inShape(x, y, r - 1) || inShape(x, y, r - RV)) continue;
    const dx = x - CX + 0.5, dy = y - CY + 0.5;
    const k = r - 1 - (y < CY ? Math.hypot(dx, dy) : Math.abs(dx)); // 0 at the outer lip .. RV-1 at the inner edge
    const ang = y < CY ? Math.atan2(-dy, dx) : (dx < 0 ? Math.PI : 0); // 0 right, pi/2 top, pi left
    const top = ang > Math.PI * 0.25 && ang < Math.PI * 0.75;
    let c;
    if (top) c = k < 1 ? C.slate : k < 3 ? C.dusk : C.night;
    else if (Math.cos(ang) > 0) c = k < 1 ? C.white : k < 3 ? C.silver : C.steel;
    else c = k < 1 ? C.steel : k < 3 ? C.slate : C.dusk;
    if (!top && y >= CY && (y - CY) % 9 === 8) c = Math.cos(ang) > 0 ? C.steel : C.night;
    g.set(x, y, c);
  }
  for (let y = 0; y < H - 5; y++) for (let x = 0; x < W; x++) {
    if (!inShape(x, y, r - RV)) continue;
    if (!inShape(x - 1, y, r - RV) || !inShape(x + 1, y, r - RV) || !inShape(x, y - 1, r - RV)) g.set(x, y, C.void);
  }
  for (let y = 0; y < H - 5; y++) for (let x = 0; x < W; x++) {
    if (!inShape(x, y, r - RV - 1) || inShape(x, y, r - RV - 5)) continue;
    const dx = x - CX + 0.5, dy = y - CY + 0.5;
    const k = (r - RV - 1) - (y < CY ? Math.hypot(dx, dy) : Math.abs(dx));
    const ang = y < CY ? Math.atan2(-dy, dx) : (dx < 0 ? Math.PI : 0);
    if (!(ang > Math.PI * 0.2 && ang < Math.PI * 0.95)) continue;
    const dens = k < 1 ? 1 : k < 2 ? 0.7 : k < 3 ? 0.45 : 0.2;
    if ((x + y) % 2 === 0 && hash(x, y, 31) < dens) g.set(x, y, C.void);
    else if (k < 1.5) g.set(x, y, C.night);
  }
  const sx = CX - r - 5, sw = 2 * r + 10;
  g.rect(sx, H - 6, sw, 6, C.out);
  g.rect(sx + 1, H - 5, sw - 2, 2, C.silver); g.rect(sx + 1, H - 5, sw - 2, 1, C.white);
  g.rect(sx + 1, H - 3, sw - 2, 2, C.steel); g.rect(sx + 1, H - 2, sw - 2, 1, C.slate);
  for (let x = sx + 3; x < sx + sw - 3; x++) { const h = hash(x, 41); if (h > 0.9) g.set(x, H - 4, C.steel); else if (h < 0.06) g.set(x, H - 3, C.dusk); }
  for (let x = CX - r + RV - 1; x < CX + r - RV + 1; x++) if (inShape(x, H - 7, r - RV)) g.set(x, H - 7, C.night);
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


/** Fill the opening (inside r) with a function (x,y) -> colour or null. Leaves the dark rim line. */
function fillOpening(g, fn) {
  for (let y = 0; y < H - 3; y++) for (let x = 0; x < W; x++) if (inShape(x, y, r - 1)) { const c = fn(x, y); if (c) g.set(x, y, c); }
}
const dith = (x, y, d) => d > 0 && (x + y) % 2 === 0 && hash(x, y, 11) < d;

/** Wooden floor with perspective planks in the opening, from y0 down. tones far -> near */
function planks(g, y0, tones) {
  fillOpening(g, (x, y) => {
    if (y < y0) return null;
    const t = Math.min(tones.length - 1, Math.floor((y - y0) / ((H - 3 - y0) / tones.length)));
    const seam = (x - CX + 40) % 9 === 0 && ((y - y0) % 4 !== 0);
    return seam ? C.walnut : tones[t];
  });
}

/** TAVERN door look: warm glimpse of the common room: barrel, a table with a mug, hearth glow. */
function tavernInside(g) {
  fillOpening(g, () => C.void);
  fillOpening(g, (x, y) => (y < 42 ? (dith(x, y, 0.9 * (1 - Math.hypot((x - CX) / 22, (y - 34) / 24))) ? C.rust : C.night) : null));
  planks(g, 42, [C.walnut, C.oak, C.clay, C.sand, C.cream]);
  g.rect(CX - 4, 24, 9, 8, C.out); g.rect(CX - 3, 25, 7, 6, C.rust); g.rect(CX - 2, 27, 5, 4, C.orange); g.rect(CX - 1, 29, 3, 2, C.gold);
  const bx = CX - 17, by = 36;
  g.rect(bx - 1, by - 1, 14, 17, C.out);
  g.rect(bx, by, 12, 15, C.oak); g.rect(bx, by, 3, 15, C.clay); g.rect(bx + 10, by, 2, 15, C.walnut);
  for (const hy of [3, 11]) { g.rect(bx, by + hy, 12, 2, C.night); g.rect(bx, by + hy, 12, 1, C.steel); }
  g.rect(bx + 3, by + 6, 5, 3, C.walnut); g.set(bx + 5, by + 7, C.gold);
  const tx = CX + 4;
  g.rect(tx - 1, 40, 16, 4, C.out); g.rect(tx, 40, 14, 3, C.clay); g.rect(tx, 40, 14, 1, C.sand); g.rect(tx, 43, 14, 1, C.walnut);
  g.rect(tx + 1, 44, 2, 10, C.out); g.rect(tx + 11, 44, 2, 10, C.out); g.rect(tx + 1, 44, 1, 9, C.oak); g.rect(tx + 11, 44, 1, 9, C.oak);
  g.rect(tx + 4, 34, 6, 7, C.out); g.rect(tx + 5, 35, 4, 5, C.gold); g.rect(tx + 5, 35, 4, 2, C.white); g.rect(tx + 10, 36, 2, 3, C.out);
}

/** SUITE door look: a cosy bedroom glimpse: bed with red blanket, bedside lamp, moonlit window. */
function suiteInside(g) {
  fillOpening(g, () => C.night);
  fillOpening(g, (x, y) => (y < 44 && dith(x, y, 0.85 * (1 - Math.hypot((x - CX - 10) / 24, (y - 34) / 20))) ? C.rust : null));
  g.rect(CX - 12, 14, 11, 12, C.out); g.rect(CX - 11, 15, 9, 10, C.dusk); g.rect(CX - 7, 15, 1, 10, C.out); g.rect(CX - 11, 19, 9, 1, C.out);
  g.rect(CX - 10, 16, 2, 2, C.silver); g.set(CX - 4, 22, C.white);
  planks(g, 46, [C.walnut, C.oak, C.clay, C.sand, C.cream]);
  const bx = CX - 18, by = 34;
  g.rect(bx - 1, by - 1, 33, 17, C.out);
  g.rect(bx, by, 5, 16, C.walnut); g.rect(bx, by, 1, 16, C.oak);
  g.rect(bx + 5, by + 6, 26, 9, C.crimson); g.rect(bx + 5, by + 6, 26, 2, C.red); g.rect(bx + 5, by + 14, 26, 1, C.out);
  g.rect(bx + 6, by + 3, 9, 4, C.cream); g.rect(bx + 6, by + 3, 9, 1, C.white); g.rect(bx + 14, by + 4, 1, 3, C.sand);
  for (let i = 8; i < 28; i += 6) g.rect(bx + i, by + 9, 1, 5, C.rust);
  g.rect(bx + 28, by + 8, 3, 8, C.walnut);
  const lx = CX + 18;
  g.rect(lx - 1, 36, 8, 10, C.out); g.rect(lx, 37, 6, 3, C.walnut); g.rect(lx, 40, 6, 5, C.oak);
  g.rect(lx - 1, 28, 8, 8, C.out); g.rect(lx, 29, 6, 6, C.gold); g.rect(lx + 1, 30, 4, 4, C.butter); g.rect(lx + 2, 31, 2, 2, C.white);
}

/** GARDEN door look: bright green daylight, far hedges, a sand path into the garden, flowers. */
function gardenInside(g) {
  fillOpening(g, (x, y) => (y < 22 ? C.butter : y < 28 ? C.lime : y < 34 ? C.green : C.forest));
  fillOpening(g, (x, y) => (y < 22 && dith(x, y, 0.5) ? C.white : null));
  for (const [bx, w, h] of [[CX - 22, 14, 10], [CX + 8, 16, 12], [CX - 8, 12, 6]]) {
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const d = Math.hypot((x - w / 2) / (w / 2), (y - h) / h); if (d < 1) g.set(bx + x, 34 - h + y + 6, y < 3 ? C.lime : y < 6 ? C.green : C.forest); }
  }
  fillOpening(g, (x, y) => {
    if (y < 34) return null;
    const half = 3 + (y - 34) * 0.95;
    if (Math.abs(x - CX + 0.5) < half) return (y % 7 < 2) ? C.cream : C.sand;
    return hash(x, y, 5) > 0.8 ? C.lime : (y < 46 ? C.green : C.forest);
  });
  for (const [fx, fy, c] of [[CX - 16, 44, C.pink], [CX - 20, 52, C.butter], [CX + 16, 46, C.white], [CX + 20, 54, C.pink], [CX - 10, 36, C.white], [CX + 12, 37, C.butter]]) { g.set(fx, fy, c); g.set(fx - 1, fy + 1, C.lime); g.set(fx + 1, fy + 1, C.lime); }
}

/** Leaves and vines climbing over the stone frame (garden only), deterministic. */
function vines(g) {
  const leaf = (x, y, big) => {
    g.rect(x, y, big ? 4 : 3, big ? 3 : 2, C.out); g.rect(x + 1, y, big ? 2 : 1, big ? 2 : 1, C.lime); g.set(x + (big ? 2 : 1), y + 1, C.green);
    if (big) g.set(x + 1, y + 1, C.green);
  };
  for (let y = 6; y < 58; y += 1) { const x = 10 + Math.round(2 * Math.sin(y / 6)); g.set(x, y, C.forest); g.set(x + 1, y, C.green); }
  for (const [x, y] of [[8, 12], [11, 20], [7, 29], [12, 38], [8, 47], [13, 54], [20, 7], [30, 3], [60, 4], [72, 8]]) leaf(x, y, true);
  for (const [x, y] of [[14, 15], [9, 33], [13, 44], [24, 4], [66, 5], ]) leaf(x, y, false);
  for (let y = 0; y < 34; y++) for (let x = 0; x < 50; x++) { const c = g.get(x, y); if ((c === C.silver || c === C.steel) && hash(x, y, 21) > 0.82) g.set(x, y, C.green); }
}

/** A hanging wall sign on an iron bracket right of the arch (x = left of the board). kind 'mug' | 'star' | 'leaf'. 11 x 14 board. */
function sign(g, x, y, kind) {
  const body = { mug: C.oak, star: C.dusk, leaf: C.forest }[kind], hi = { mug: C.clay, star: C.steel, leaf: C.green }[kind];
  g.rect(x - 4, y - 1, 11, 2, C.out); g.rect(x - 4, y, 10, 1, C.night);
  g.rect(x + 1, y + 1, 1, 3, C.out); g.rect(x + 8, y + 1, 1, 3, C.out);
  g.rect(x, y + 4, 11, 14, C.out); g.rect(x + 1, y + 5, 9, 12, body); g.rect(x + 1, y + 5, 9, 1, hi); g.rect(x + 1, y + 5, 1, 12, hi);
  if (kind === 'mug') {
    g.rect(x + 2, y + 8, 5, 7, C.out); g.rect(x + 3, y + 9, 3, 5, C.gold); g.rect(x + 3, y + 8, 3, 2, C.white); g.rect(x + 7, y + 10, 2, 3, C.out); g.set(x + 7, y + 11, C.cream);
  } else if (kind === 'star') {
    g.rect(x + 5, y + 8, 2, 7, C.butter); g.rect(x + 3, y + 10, 6, 2, C.butter); g.set(x + 5, y + 10, C.white);
  } else {
    g.rect(x + 3, y + 7, 5, 6, C.lime); g.rect(x + 4, y + 6, 3, 1, C.lime); g.rect(x + 5, y + 13, 1, 3, C.out); g.rect(x + 4, y + 8, 1, 3, C.green); g.set(x + 6, y + 9, C.butter);
  }
}

// ----- build the sheets -----
{
  const g = new Img(W, H); stoneFrame(g); plankDoor(g); depth(g); lantern(g, 88, 20); g.save(`${OUT}/door_cellar_down.png`);
  const o = new Img(W, H); stoneFrame(o); openDoor(o); depth(o); lantern(o, 88, 20); o.save(`${OUT}/door_cellar_down_open.png`);
  const u = new Img(W, H); stoneFrame(u); upStairs(u); depth(u); u.save(`${OUT}/door_cellar_up.png`);
  const s = new Img(64, 14);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot((x - 31.5) / 32, y / 13);
    if (d < 1 && ((x + y) % 2 === 0) && hash(x, y, 8) < 1.1 * (1 - d)) s.set(x, y, d < 0.45 ? C.gold : d < 0.75 ? C.orange : C.rust);
  }
  s.save(`${OUT}/door_spill.png`);
}

{
  const t = new Img(W, H); stoneFrame(t); tavernInside(t); depth(t); sign(t, 85, 18, 'mug'); t.save(`${OUT}/door_tavern.png`);
  const u = new Img(W, H); stoneFrame(u); suiteInside(u); depth(u); sign(u, 85, 18, 'star'); u.save(`${OUT}/door_suite.png`);
  const v = new Img(W, H); stoneFrame(v); gardenInside(v); depth(v); vines(v); sign(v, 85, 18, 'leaf'); v.save(`${OUT}/door_garden.png`);
  const sg = new Img(64, 14);
  for (let y = 0; y < 14; y++) for (let x = 0; x < 64; x++) {
    const d = Math.hypot((x - 31.5) / 32, y / 13);
    if (d < 1 && ((x + y) % 2 === 0) && hash(x, y, 8) < 1.1 * (1 - d)) sg.set(x, y, d < 0.45 ? C.butter : d < 0.75 ? C.lime : C.green);
  }
  sg.save(`${OUT}/door_spill_garden.png`);
}
console.log('doors written');
