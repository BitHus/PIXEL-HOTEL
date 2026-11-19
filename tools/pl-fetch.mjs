// Usage: node tools/pl-fetch.mjs <name>=<objectId> ...  -> art-src/pixellab/v3/<name>.png (raw, no snapping)
import fs from 'fs';
const B = 'https://backblaze.pixellab.ai/file/pixellab-characters/objects/21db99c7-0afe-483b-9a44-0bfda5106b53/';
for (const a of process.argv.slice(2)) { const [n, id] = a.split('='); const r = await fetch(`${B}${id}/rotations/unknown.png`); if (!r.ok) { console.log(n, 'HTTP', r.status); continue; } fs.writeFileSync(`art-src/pixellab/v3/${n}.png`, Buffer.from(await r.arrayBuffer())); console.log(n, 'ok'); }
