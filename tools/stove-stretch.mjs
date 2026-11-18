// Makes the fitted stove taller by repeating plain rows (chimney, top lip, firebox surround, brick base); run after pixellab-fit.
import fs from 'fs'; import { PNG } from 'pngjs';
const f = 'client/src/assets/sprites/furniture/stove.png'; const s = PNG.sync.read(fs.readFileSync(f));
const dup = new Map([[4, 2], [5, 2], [20, 1], [21, 1], [26, 1], [27, 1], [32, 1], [33, 1], [34, 1]]);
const rows = []; for (let y = 0; y < s.height; y++) { rows.push(y); for (let k = 0; k < (dup.get(y) || 0); k++) rows.push(y); }
const o = new PNG({ width: s.width, height: rows.length });
rows.forEach((sy, y) => s.data.copy(o.data, y * s.width * 4, sy * s.width * 4, (sy + 1) * s.width * 4));
fs.writeFileSync(f, PNG.sync.write(o)); console.log(s.height, '->', o.height);
