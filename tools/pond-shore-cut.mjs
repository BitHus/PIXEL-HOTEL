// POND (A3): makes tiles_grass_sand_cut.png from tiles_grass_sand.png: the same 4 x 4 sheet with the GRASS pixels made
// transparent, so the lakeside's own grass floor shows around the pond (the tile grass is darker than the floor grass and
// would show square seams). Sand, the earth rim and its outline stay. No scaling, no new colours.
// Run: node tools/pond-shore-cut.mjs [--preview <out.png>]  (the preview lays the pond on the floor grass, 1x).
import fs from 'node:fs';
import { PNG } from 'pngjs';

const DIR = 'client/src/assets/sprites/lake';
const GRASS = new Set(['3e8948', '63c74d', '265c42', '193c3e', 'feae34', 'ffffff']);
const src = PNG.sync.read(fs.readFileSync(`${DIR}/tiles_grass_sand.png`));
const out = new PNG({ width: src.width, height: src.height });
src.data.copy(out.data);
const hex = (d, i) => [d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('');
const clear = new Uint8Array(src.width * src.height);
for (let i = 0; i < clear.length; i++) if (src.data[i * 4 + 3] < 128 || GRASS.has(hex(src.data, i * 4))) clear[i] = 1;
// Sand-coloured specks inside the grass (6 or more of the 8 neighbours in the same tile are grass) go too.
const next = clear.slice();
for (let y = 0; y < src.height; y++) {
  for (let x = 0; x < src.width; x++) {
    const i = y * src.width + x;
    if (clear[i]) continue;
    let n = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const xx = x + dx, yy = y + dy;
      const same = Math.floor(xx / 32) === Math.floor(x / 32) && Math.floor(yy / 32) === Math.floor(y / 32);
      if (!same || xx < 0 || yy < 0 || xx >= src.width || yy >= src.height) continue;
      if (clear[yy * src.width + xx]) n++;
    }
    if (n >= 6) next[i] = 1;
  }
}
for (let i = 0; i < next.length; i++) if (next[i]) out.data[i * 4 + 3] = 0;
fs.writeFileSync(`${DIR}/tiles_grass_sand_cut.png`, PNG.sync.write(out));
console.log('wrote', `${DIR}/tiles_grass_sand_cut.png`);
