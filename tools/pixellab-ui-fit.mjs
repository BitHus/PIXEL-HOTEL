// Usage: node tools/pixellab-ui-fit.mjs <dir with the unzipped PixelLab UI zips: controls/ sign/ ia/ ib/ pd/ pp/>
// Proof-set builder (docs/PLAN-PIXELLAB-ART.md, UI proof): trims every PixelLab UI PNG, hard-snaps colours to
// shared/src/palette.ts (alpha > 127 = opaque, no anti-aliasing), centres state images on the size of the normal
// element, and writes art-src/pixellab/ui/<name>.png. Also writes 2x box-reduced "_s" variants of icons and signs.
import fs from 'fs'; import path from 'path'; import { PNG } from 'pngjs';
const root = process.argv[2]; const out = 'art-src/pixellab/ui/'; fs.mkdirSync(out, { recursive: true });
const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const snap = (r, g, b) => { let best = 0, bd = 1e9; pal.forEach((p, i) => { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }); return pal[best]; };
const read = (p) => PNG.sync.read(fs.readFileSync(path.join(root, p)));
function trim(s) {
  let x0 = s.width, y0 = s.height, x1 = -1, y1 = -1;
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) if (s.data[(y * s.width + x) * 4 + 3] > 127) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  return crop(s, x0, y0, x1 - x0 + 1, y1 - y0 + 1);
}
function crop(s, cx, cy, w, h) {
  const o = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = ((cy + y) * s.width + cx + x) * 4, j = (y * w + x) * 4;
    if (s.data[i + 3] > 127) { const c = snap(s.data[i], s.data[i + 1], s.data[i + 2]); o.data[j] = c[0]; o.data[j + 1] = c[1]; o.data[j + 2] = c[2]; o.data[j + 3] = 255; }
  }
  return o;
}
function center(s, w, h) { // state images are trimmed smaller: put them centred (bottom aligned for width < w) on the normal size
  const o = new PNG({ width: w, height: h }); const ox = Math.floor((w - s.width) / 2), oy = Math.floor((h - s.height) / 2);
  for (let y = 0; y < s.height; y++) for (let x = 0; x < s.width; x++) { const i = (y * s.width + x) * 4, j = ((y + oy) * w + x + ox) * 4; if (x + ox >= 0 && x + ox < w && y + oy >= 0 && y + oy < h) s.data.copy(o.data, j, i, i + 4); }
  return o;
}
function half(s) { // 2x box reduce, majority vote, darkest colour wins when it is a third of the votes (keeps the outline)
  const w = Math.ceil(s.width / 2), h = Math.ceil(s.height / 2); const o = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const votes = new Map(); let n = 0;
    for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) { const sx = x * 2 + dx, sy = y * 2 + dy; if (sx >= s.width || sy >= s.height) continue; const i = (sy * s.width + sx) * 4; if (s.data[i + 3] <= 127) continue; n++; const k = [s.data[i], s.data[i + 1], s.data[i + 2]].join(','); votes.set(k, (votes.get(k) || 0) + 1); }
    if (n < 2) continue; let pick = null, top = 0; for (const [k, v] of votes) if (v > top) { top = v; pick = k; }
    for (const [k, v] of votes) { const c = k.split(',').map(Number), p = pick.split(',').map(Number); if (v * 3 >= n && c[0] + c[1] + c[2] < p[0] + p[1] + p[2] - 60) pick = k; }
    const c = pick.split(',').map(Number), j = (y * w + x) * 4; o.data[j] = c[0]; o.data[j + 1] = c[1]; o.data[j + 2] = c[2]; o.data[j + 3] = 255;
  }
  return o;
}
const save = (name, s) => { fs.writeFileSync(out + name + '.png', PNG.sync.write(s)); console.log(name, s.width + 'x' + s.height); };
const C = 'controls/controls2/elements/';
const set = (name, s, smaller) => { save(name, s); if (smaller) save(name + '_s', half(s)); };
set('panel_dark', trim(read('pd/panel_dark/elements/element_1.png')));
set('panel_parchment', trim(read('pp/panel_parchment/elements/element_1.png')));
for (const [id, el] of [['btn_round', 'round_disc_button'], ['btn_pill', 'pill_button'], ['tab', 'tab']]) {
  const n = trim(read(`${C}${el}/${el}.png`)); const pr = trim(read(`${C}${el}/pressed.png`)), di = trim(read(`${C}${el}/disabled.png`));
  const [w, h] = [Math.max(n.width, pr.width, di.width), Math.max(n.height, pr.height, di.height)];
  const names = id === 'tab' ? ['tab_active', 'tab_inactive', 'tab_disabled'] : [id, id + '_pressed', id + '_disabled'];
  save(names[0], center(n, w, h)); save(names[1], center(pr, w, h)); save(names[2], center(di, w, h));
}
const bar = trim(read(C + 'progress_bar_trough/progress_bar_trough.png')); save('bar_frame', bar);
const alt = trim(read(C + 'progress_bar_trough/alt.png'));
let gx0 = 1e9, gy0 = 1e9, gx1 = -1, gy1 = -1; // the green fill = bbox of green-dominant pixels
for (let y = 0; y < alt.height; y++) for (let x = 0; x < alt.width; x++) { const i = (y * alt.width + x) * 4; if (alt.data[i + 3] && alt.data[i + 1] > alt.data[i] + 30 && alt.data[i + 1] > alt.data[i + 2] + 30) { gx0 = Math.min(gx0, x); gx1 = Math.max(gx1, x); gy0 = Math.min(gy0, y); gy1 = Math.max(gy1, y); } }
console.log('fill offset', gx0, gy0); save('bar_full', alt); save('bar_fill', crop(alt, gx0, gy0, gx1 - gx0 + 1, gy1 - gy0 + 1));
const sn = trim(read('sign/sign_open/elements/hanging_sign/hanging_sign.png')), sc = trim(read('sign/sign_open/elements/hanging_sign/alt.png'));
const sw = Math.max(sn.width, sc.width), sh = Math.max(sn.height, sc.height);
set('sign_open', center(sn, sw, sh), true); set('sign_closed', center(sc, sw, sh), true);
const I = { ia: ['icons_a', { gold_coin: 'icon_coin', blue_gem: 'icon_gem', open_book: 'icon_book', hammer: 'icon_hammer', crossed_swords: 'icon_swords' }], ib: ['icons_b', { three_dots: 'icon_more', leather_bag: 'icon_bag', close_X: 'icon_close', plus: 'icon_plus', minus: 'icon_minus' }] };
for (const k in I) for (const [f, name] of Object.entries(I[k][1])) set(name, trim(read(`${k}/${I[k][0]}/elements/${f}.png`)), true);
