// Usage: node tools/pixellab-icon-fetch.mjs <name>=<objectId> ...   (PixelLab 32x32 icon objects)
// Downloads rotations/unknown.png to art-src/pixellab/icons/<name>.raw.png, hard-snaps to Endesga 32 (alpha>127), writes art-src/pixellab/icons/<name>.png (32x32, no scaling).
import fs from 'fs'; import { PNG } from 'pngjs';
const B = 'https://backblaze.pixellab.ai/file/pixellab-characters/objects/21db99c7-0afe-483b-9a44-0bfda5106b53/';
const pal = [...new Set([...fs.readFileSync('shared/src/palette.ts', 'utf8').matchAll(/#([0-9a-fA-F]{6})/g)].map((m) => m[1].toLowerCase()))].map((h) => [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)));
const snap = (r, g, b) => { let best = 0, bd = 1e9; pal.forEach((p, i) => { const d = (p[0] - r) ** 2 + (p[1] - g) ** 2 + (p[2] - b) ** 2; if (d < bd) { bd = d; best = i; } }); return pal[best]; };
for (const a of process.argv.slice(2)) {
  const [name, id] = a.split('=');
  const buf = Buffer.from(await (await fetch(`${B}${id}/rotations/unknown.png`)).arrayBuffer());
  fs.writeFileSync(`art-src/pixellab/icons/${name}.raw.png`, buf);
  const s = PNG.sync.read(buf); const o = new PNG({ width: s.width, height: s.height });
  for (let i = 0; i < s.width * s.height; i++) if (s.data[i * 4 + 3] > 127) { const c = snap(s.data[i * 4], s.data[i * 4 + 1], s.data[i * 4 + 2]); o.data[i * 4] = c[0]; o.data[i * 4 + 1] = c[1]; o.data[i * 4 + 2] = c[2]; o.data[i * 4 + 3] = 255; }
  fs.writeFileSync(`art-src/pixellab/icons/${name}.png`, PNG.sync.write(o)); console.log(name, s.width + 'x' + s.height);
}
