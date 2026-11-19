// Mock tavern corner from the real PNGs, to judge floor / wall / stool candidates together (no game build).
// usage: node tools/mock-tavern.mjs out.png [floor=png[,png2,png3]] [wall=png] [stool=dir-or-prefix] [scale=3] [light=1]
// floor with 3 files = variants picked per 64 px tile by a hash; stool=prefix uses <prefix>.png, <prefix>_right.png, <prefix>_up.png.
import sharp from 'sharp';
const args = Object.fromEntries(process.argv.slice(3).map((a) => a.split('=')));
const out = process.argv[2];
const F = 'client/src/assets/sprites/furniture/';
const floors = (args.floor ?? 'client/src/assets/sprites/floors/bare.png').split(',');
const wall = args.wall ?? 'client/src/assets/sprites/walls/bare.png';
const stool = args.stool ?? F + 'bar_stool';
const scale = Number(args.scale ?? 3), light = args.light !== '0';
const W = 352, H = 288, WALL = 64;
const layers = [];
const meta = async (p) => (await sharp(p).metadata());
for (let y = WALL; y < H; y += 64) for (let x = 0; x < W; x += 64) {
  const h = ((x * 73856093) ^ (y * 19349663)) >>> 0;
  const pick = floors.length > 1 ? (h % 5 < 3 ? 0 : 1 + (h % 2)) % floors.length : 0;
  layers.push({ input: floors[pick], left: x, top: y });
}
for (let x = 0; x < W; x += 64) layers.push({ input: wall, left: x, top: 0 });
// items: [file, anchorX (bottom centre), anchorY, lift]
const items = [
  [F + 'brewing_barrel.png', 300, 112], [F + 'stove.png', 240, 112],
  [F + 'bar_hendl.png', 112, 176], [F + 'bar_hmid.png', 144, 176], [F + 'bar_hmid.png', 176, 176], [F + 'bar_hmid.png', 208, 176], [F + 'bar_hendr.png', 240, 176],
  [F + 'register.png', 112, 176.5], [F + 'tap_stand.png', 176, 176.5],
  [stool + '.png', 144, 208], [stool + '.png', 176, 208], [stool + '_right.png', 80, 176], [stool + '_up.png', 208, 208],
  [F + 'chair_right.png', 64, 272], [F + 'table.png', 112, 272], [F + 'chair.png', 112, 288], [F + 'plant.png', 320, 272],
];
items.sort((a, b) => a[2] - b[2]);
for (const [file, ax, ay] of items) {
  try {
    const m = await meta(file);
    let top = ay - m.height;
    if (file.includes('register') || file.includes('tap_stand')) top = Math.round(ay) - 26 - m.height;
    layers.push({ input: file, left: Math.round(ax - m.width / 2), top });
  } catch { console.log('missing', file); }
}
const door = 'client/src/assets/sprites/doors/door_tavern.png';
try { const m = await meta(door); layers.push({ input: door, left: 40, top: WALL - m.height }); } catch {}
let img = sharp({ create: { width: W, height: H, channels: 4, background: '#181425' } }).composite(layers);
let buf = await img.raw().toBuffer();
if (light) { // rough game look: dim ambient, warm pools at the bar and stove
  const pools = [[176, 170, 110], [240, 100, 80]];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let l = 0.78; for (const [px, py, r] of pools) { const d = Math.hypot(x - px, y - py) / r; if (d < 1) l += 0.28 * (1 - d) ** 1.5; }
    const i = (y * W + x) * 4;
    buf[i] = Math.min(255, buf[i] * l * 1.04); buf[i + 1] = Math.min(255, buf[i + 1] * l); buf[i + 2] = Math.min(255, buf[i + 2] * l * 0.92);
  }
}
await sharp(buf, { raw: { width: W, height: H, channels: 4 } }).resize(W * scale, H * scale, { kernel: 'nearest' }).png().toFile(out);
console.log('wrote', out);
