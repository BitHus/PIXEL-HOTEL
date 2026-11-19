// Usage: node tools/icon-zoom.mjs <in.png> <out.png> [zoom=5]  nearest-neighbour preview on grey
import fs from 'fs'; import { PNG } from 'pngjs';
const [i, o2, z] = process.argv.slice(2); const Z = +(z || 5); const s = PNG.sync.read(fs.readFileSync(i)); const o = new PNG({ width: s.width * Z, height: s.height * Z });
for (let y = 0; y < o.height; y++) for (let x = 0; x < o.width; x++) { const a = ((y / Z | 0) * s.width + (x / Z | 0)) * 4, j = (y * o.width + x) * 4, al = s.data[a + 3] / 255; for (let k = 0; k < 3; k++) o.data[j + k] = s.data[a + k] * al + 90 * (1 - al); o.data[j + 3] = 255; }
fs.writeFileSync(o2, PNG.sync.write(o));
