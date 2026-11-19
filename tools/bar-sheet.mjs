// Contact sheet for the modular bar pieces: node tools/bar-sheet.mjs <out.png>
import sharp from 'sharp'; import fs from 'fs';
const D = 'art-src/staging/bar/', F = 'client/src/assets/sprites/furniture/';
const W = 32 * 15, H = 32 * 9;
const layers = [];
const put = (file, cx, cy, lift = 0) => layers.push({ input: file, left: cx * 32, top: (cy + 1) * 32 - lift, _sort: cy });
async function place(file, cx, cy, lift = 0) { const m = await sharp(file).metadata(); layers.push({ input: file, left: cx * 32 + Math.floor((32 - m.width) / 2), top: (cy + 1) * 32 - m.height - lift, s: cy * 10 + (lift ? 1 : 0) }); }
// floor
const floor = await sharp({ create: { width: W, height: H, channels: 4, background: '#5b3f35' } }).png().toBuffer();
const tiles = []; for (let y = 0; y < 9; y++) for (let x = 0; x < 15; x++) if ((x + y) % 2) tiles.push({ input: { create: { width: 32, height: 32, channels: 4, background: '#644638' } }, left: x * 32, top: y * 32 });
// row 1: 6 straight in a row
for (let i = 0; i < 6; i++) await place(D + 'bar_straight.png', 1 + i, 1);
await place(F + 'register.png', 2, 1, 28); await place(F + 'tap_stand.png', 5, 1, 28);
// row 3: finished ends + run, then L (SW corner) going down
await place(D + 'bar_end_left.png', 1, 3); for (const x of [2, 3]) await place(D + 'bar_straight.png', x, 3); await place(D + 'bar_corner_sw.png', 4, 3); await place(D + 'bar_straight_right.png', 4, 4); await place(D + 'bar_straight_right.png', 4, 5); await place(D + 'bar_end_down.png', 4, 6);
// right: SE corner shape (arms east+south) with end right
await place(D + 'bar_corner_se.png', 6, 3); await place(D + 'bar_straight.png', 7, 3); await place(D + 'bar_end_right.png', 8, 3); await place(D + 'bar_straight_right.png', 6, 4); await place(D + 'bar_end_down.png', 6, 5);
// U-ish: NW and NE corners at the bottom: bar going up and turning
await place(D + 'bar_end_up.png', 9, 4); await place(D + 'bar_straight_right.png', 9, 5); await place(D + 'bar_corner_nw.png', 9, 6); await place(D + 'bar_end_right.png', 8, 6);
await place(D + 'bar_end_up.png', 11, 4); await place(D + 'bar_straight_right.png', 11, 5); await place(D + 'bar_corner_ne.png', 11, 6); await place(D + 'bar_end_left.png', 13, 7);
await place(D + 'bar_straight_up.png', 1, 7); await place(D + 'bar_straight_up.png', 2, 7);
layers.sort((a, b) => a.s - b.s);
const out = process.argv[2];
const buf = await sharp(floor).composite([...tiles, ...layers.map(({ s, ...l }) => l)]).png().toBuffer();
await sharp(buf).resize(W * 6, H * 6, { kernel: 'nearest' }).toFile(out);
