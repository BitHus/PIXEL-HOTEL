// Usage: node tools/icon-contact.mjs <out.png> <zoom> <dir/name.png>...   32px cells on dark grey, nearest zoom, 8 per row
import fs from 'fs'; import { PNG } from 'pngjs';
const [out, z, ...fl] = process.argv.slice(2); const Z = +z, C = 36, cols = 8, rows = Math.ceil(fl.length / cols);
const o = new PNG({ width: cols * C * Z, height: rows * C * Z }); for (let i = 0; i < o.data.length; i += 4) { o.data[i] = 50; o.data[i + 1] = 46; o.data[i + 2] = 54; o.data[i + 3] = 255; }
fl.forEach((f, n) => { const s = PNG.sync.read(fs.readFileSync(f)); const ox = (n % cols) * C + 2, oy = Math.floor(n / cols) * C + 2;
  for (let y = 0; y < s.height * Z; y++) for (let x = 0; x < s.width * Z; x++) { const a = ((y / Z | 0) * s.width + (x / Z | 0)) * 4; if (s.data[a + 3] < 128) continue; const j = ((oy * Z + y) * o.width + ox * Z + x) * 4; for (let k = 0; k < 3; k++) o.data[j + k] = s.data[a + k]; } });
fs.writeFileSync(out, PNG.sync.write(o));
