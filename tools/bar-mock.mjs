// Bar layout check: a straight run with ends, a back run, a vertical run and a closed ring of corners, from a folder of bar_*.png.
// usage: node tools/bar-mock.mjs <dir/> out.png [floor.png] [scale=4]
import sharp from 'sharp';
const [dir, out, floor = 'client/src/assets/sprites/floors/bare.png', sc = '4'] = process.argv.slice(2);
const W = 32 * 15, H = 32 * 8;
const L = [];
for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) L.push({ input: floor, left: x, top: y });
const cells = []; // [tile, col, row, mirror]
['hendl', 'hmid', 'hmid', 'hmid', 'hendr'].forEach((t, i) => cells.push([t, 1 + i, 2]));
['hback', 'hback', 'hback'].forEach((t, i) => cells.push([t, 2 + i, 5]));
['vendn', 'vmid', 'vmid', 'vends'].forEach((t, i) => cells.push([t, 7, 1 + i]));
[['cse', 9, 1], ['hmid', 10, 1], ['hmid', 11, 1], ['csw', 12, 1], ['vmid', 9, 2, true], ['vmid', 12, 2], ['cne', 9, 3], ['hmid', 10, 3], ['hmid', 11, 3], ['cnw', 12, 3]].forEach((c) => cells.push(c));
cells.push(['hendl', 9, 6], ['hendr', 10, 6]);
cells.sort((a, b) => a[2] - b[2]);
for (const [t, c, r, m] of cells) {
  let img = sharp(dir + 'bar_' + t + '.png'); if (m) img = img.flop();
  const buf = await img.png().toBuffer(); const meta = await sharp(buf).metadata();
  L.push({ input: buf, left: c * 32, top: (r + 1) * 32 - meta.height });
}
const reg = 'client/src/assets/sprites/furniture/register.png', tap = 'client/src/assets/sprites/furniture/tap_stand.png';
for (const [f, c] of [[reg, 1], [tap, 3]]) { const m = await sharp(f).metadata(); L.push({ input: f, left: c * 32 + 16 - Math.round(m.width / 2), top: 3 * 32 - 28 - m.height }); }
const b = await sharp({ create: { width: W, height: H, channels: 4, background: '#181425' } }).composite(L).png().toBuffer();
await sharp(b).resize(W * +sc, H * +sc, { kernel: 'nearest' }).toFile(out); console.log('wrote', out);
