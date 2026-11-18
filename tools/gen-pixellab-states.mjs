// Redoes the state strips of the PixelLab base sprites by editing their pixels (palette stays Endesga 32):
// stove_cold (1 frame), stove_ready (2 frames), stove_fire (3 flame frames 14x9), tap_stand_dry/wet (2 frames 32x48), brewing_barrel_ready (2 frames).
// Usage: node tools/gen-pixellab-states.mjs
import fs from 'fs'; import { PNG } from 'pngjs';
const dir = 'client/src/assets/sprites/furniture/';
const rd = (n) => PNG.sync.read(fs.readFileSync(`${dir}${n}.png`));
const hex = (h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
const mk = (w, h) => new PNG({ width: w, height: h });
const put = (p, x, y, c) => { if (x < 0 || y < 0 || x >= p.width || y >= p.height) return; const o = (y * p.width + x) * 4; p.data[o] = c[0]; p.data[o + 1] = c[1]; p.data[o + 2] = c[2]; p.data[o + 3] = 255; };
const get = (p, x, y) => { const o = (y * p.width + x) * 4; return p.data[o + 3] ? [...p.data.slice(o, o + 3)] : null; };
const hx = (c) => c.map((v) => v.toString(16).padStart(2, '0')).join('');
// blit src into dst at (ox, oy)
const blit = (dst, src, ox, oy) => { for (let y = 0; y < src.height; y++) for (let x = 0; x < src.width; x++) { const c = get(src, x, y); if (c) put(dst, x + ox, y + oy, c); } };
const copy = (src) => { const p = mk(src.width, src.height); src.data.copy(p.data); return p; };
const save = (n, p) => fs.writeFileSync(`${dir}${n}.png`, PNG.sync.write(p));
const C = { dark: hex('181425'), brown: hex('3e2731'), steel: hex('3a4466'), red: hex('a22633'), orange: hex('f77622'), rust: hex('be4a2f'), amber: hex('feae34'), yellow: hex('fee761'), white: hex('ffffff'), cream: hex('ead4aa'), pale: hex('c0cbdc'), grey: hex('8b9bb4'), skin: hex('e8b796') };

// STOVE
const stove = rd('stove');
const isFire = (c) => c && ['a22633', 'f77622', 'be4a2f'].includes(hx(c));
const isHot = (c) => c && ['a22633', 'f77622', 'be4a2f', 'feae34', 'fee761'].includes(hx(c));
const cold = copy(stove);
for (let y = 24; y <= 31; y++) for (let x = 10; x <= 22; x++) if (isHot(get(cold, x, y))) put(cold, x, y, (x + y) % 4 === 0 ? C.brown : C.dark);
save('stove_cold', cold);
const PAD = 6; // top padding for steam
const ready = mk(64, stove.height + PAD);
for (let f = 0; f < 2; f++) {
  const fr = mk(32, stove.height + PAD); blit(fr, stove, 0, PAD);
  for (let y = 24 + PAD; y <= 31 + PAD; y++) for (let x = 10; x <= 22; x++) { const c = get(fr, x, y); if (isFire(c)) put(fr, x, y, hx(c) === 'f77622' ? (f ? C.yellow : C.amber) : hx(c) === 'a22633' ? C.orange : C.amber); }
  // steam puffs over the chimney (chimney top is at x 19-21), alternate frames
  const sx = 20; const puffs = f ? [[sx, 3], [sx + 1, 1], [sx - 1, 0]] : [[sx - 1, 3], [sx, 2], [sx + 1, 0]];
  for (const [px, py] of puffs) put(fr, px, py, py > 1 ? C.white : C.pale);
  // a warm rim light on the firebox arch = "done"
  for (let x = 12; x <= 20; x++) put(fr, x, 25 + PAD, f ? C.amber : C.rust);
  blit(ready, fr, f * 32, 0);
}
save('stove_ready', ready);
// flame overlay: 3 frames 14 x 9, flame centred at the bottom (spec frameW 14)
const fire = mk(42, 9);
const flames = [
  [[7, 8, 'r'], [6, 8, 'r'], [8, 8, 'r'], [5, 8, 'r'], [9, 8, 'r'], [6, 7, 'o'], [7, 7, 'o'], [8, 7, 'o'], [7, 6, 'a'], [6, 6, 'o'], [8, 6, 'o'], [7, 5, 'y'], [7, 4, 'a'], [7, 3, 'y']],
  [[7, 8, 'r'], [6, 8, 'r'], [8, 8, 'r'], [5, 8, 'r'], [9, 8, 'r'], [6, 7, 'o'], [7, 7, 'o'], [8, 7, 'o'], [8, 6, 'a'], [7, 6, 'o'], [6, 6, 'o'], [8, 5, 'y'], [8, 4, 'a'], [9, 7, 'o'], [8, 3, 'y']],
  [[7, 8, 'r'], [6, 8, 'r'], [8, 8, 'r'], [5, 8, 'r'], [9, 8, 'r'], [6, 7, 'o'], [7, 7, 'o'], [8, 7, 'o'], [6, 6, 'a'], [7, 6, 'o'], [8, 6, 'o'], [6, 5, 'y'], [6, 4, 'a'], [5, 7, 'o'], [6, 3, 'y']],
];
const col = { r: C.red, o: C.orange, a: C.amber, y: C.yellow };
flames.forEach((fl, i) => fl.forEach(([x, y, k]) => put(fire, x + i * 14, y, col[k])));
save('stove_fire', fire);

// TAP STAND dry/wet: marks at the two nozzle tips (the sprite is 32x44, the overlay frame 32x48 bottom aligned: sprite row y -> y + 4)
const dry = mk(64, 48), wet = mk(64, 48);
for (let slot = 0; slot < 2; slot++) {
  const nx = slot === 0 ? 5 : 24, ox = slot * 32;
  for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) put(dry, ox + nx + dx, 27 + dy, dy ? C.dark : C.steel);
  put(wet, ox + nx, 27, C.white); put(wet, ox + nx + 1, 27, C.pale); put(wet, ox + nx, 28, C.pale); put(wet, ox + nx + 1, 28, C.grey); put(wet, ox + nx, 29, C.grey); put(wet, ox + nx + 1, 29, C.grey);
}
save('tap_stand_dry', dry); save('tap_stand_wet', wet);

// BREWING BARREL ready: 2 frames, bright froth in the opening + sparkle above (top pad 5)
const bb = rd('brewing_barrel'); const BP = 5;
const br = mk(64, bb.height + BP);
const isLiq = (c) => c && ['f77622', 'feae34', 'a22633'].includes(hx(c));
for (let f = 0; f < 2; f++) {
  const fr = mk(32, bb.height + BP); blit(fr, bb, 0, BP);
  for (let y = 6 + BP; y <= 14 + BP; y++) for (let x = 9; x <= 23; x++) { const c = get(fr, x, y); if (isLiq(c)) put(fr, x, y, hx(c) === 'f77622' ? (f ? C.yellow : C.amber) : hx(c) === 'feae34' ? C.yellow : C.orange); }
  const sp = f ? [[10, 2], [22, 3], [16, 0]] : [[12, 3], [20, 1], [8, 4]];
  for (const [x, y] of sp) { put(fr, x, y, C.yellow); put(fr, x - 1, y, C.cream); put(fr, x + 1, y, C.cream); put(fr, x, y - 1, C.white); put(fr, x, y + 1, C.cream); }
  blit(br, fr, f * 32, 0);
}
save('brewing_barrel_ready', br);
console.log('states written');
