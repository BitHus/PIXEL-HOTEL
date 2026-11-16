// A26 contact sheet. Run: copy to client/src/a26-sheet.ts, add client/a26-sheet.html (a script type=module src=/src/a26-sheet.ts), `npx vite` in client/,
// open /a26-sheet.html (screenshot with headless Chrome); delete both afterwards. Bakes the avatar layer PNGs the way C18 will
// (key colours -> ramps, composite in slot order, one 1 px outline pass) for down, up and right: walk frames, sit, hood + coif, long hair, apron, at zoom 3 and zoom 1.
window.addEventListener('unhandledrejection', (e) => { document.body.insertAdjacentText('beforeend', String(e.reason)); });
window.addEventListener('error', (e) => { document.body.insertAdjacentText('beforeend', e.message); });
import { PALETTE, PALETTE_NAMES, KEY_RAMPS, rampFor, type PaletteName } from '@pixel-hotel/shared';

const W = 1500;
const H = 1130;
const cv = document.createElement('canvas');
cv.width = W;
cv.height = H;
document.body.style.margin = '0';
document.body.style.background = '#c28569';
document.body.appendChild(cv);
const ctx = cv.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const hex = (n: PaletteName): string => PALETTE[PALETTE_NAMES.indexOf(n)]!;
const rgb = (h: string): [number, number, number] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const load = (url: string): Promise<HTMLImageElement | null> => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });
const base = new URL('./assets/sprites/avatar', import.meta.url).href;
type Facing = 'down' | 'up' | 'right';
type Slot = 'body' | 'shoes' | 'legs' | 'torso' | 'outer' | 'hair_back' | 'face' | 'hair_front' | 'hat';
const BODY: readonly Slot[] = ['body', 'shoes', 'legs', 'torso', 'outer'];
const cache = new Map<string, HTMLImageElement | null>();
async function img(slot: Slot, item: string, anim: string, f: Facing): Promise<HTMLImageElement | null> {
  const key = `${slot}_${item}_${anim}_${f}`;
  if (!cache.has(key)) cache.set(key, await load(`${base}/${key}.png`));
  return cache.get(key)!;
}

interface Look { skin: PaletteName; hair: PaletteName; top: PaletteName; legs: PaletteName; shoes: PaletteName; outer?: PaletteName; hairItem: 'short' | 'long'; legItem: 'trousers' | 'hose'; hat?: string }

function recolour(d: ImageData, slot: Slot, look: Look): void {
  const map = new Map<string, string>();
  const add = (keys: readonly PaletteName[], c: PaletteName): void => { const r = rampFor(c); if (r) keys.forEach((k, i) => map.set(hex(k), hex(r[i]!))); };
  if (slot === 'body') add(KEY_RAMPS.KS, look.skin);
  if (slot === 'torso') { add(KEY_RAMPS.K1, look.top); add(KEY_RAMPS.KS, look.skin); }
  if (slot === 'legs') add(KEY_RAMPS.K1, look.legs);
  if (slot === 'shoes') add(KEY_RAMPS.K1, look.shoes);
  if (slot === 'hair_back' || slot === 'hair_front') add(KEY_RAMPS.K1, look.hair);
  if (slot === 'outer' && look.outer) add(KEY_RAMPS.K1, look.outer);
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] === 0) continue;
    const to = map.get('#' + [d.data[i]!, d.data[i + 1]!, d.data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join(''));
    if (to) { const [r, g, b] = rgb(to); d.data[i] = r; d.data[i + 1] = g; d.data[i + 2] = b; }
  }
}

/** One 32 x 64 baked figure. pose 'walk' (frame 0..3) or 'sit'. */
async function bake(look: Look, pose: 'walk' | 'sit', f: Facing, frame: number): Promise<HTMLCanvasElement> {
  const out = document.createElement('canvas');
  out.width = 32; out.height = 64;
  const g = out.getContext('2d')!;
  const hidesAll = look.hat === 'hood_coif';
  const layers: [Slot, string][] = [['body', 'base'], ['shoes', 'boots'], ['legs', look.legItem], ['torso', 'tunic']];
  if (look.outer) layers.push(['outer', 'apron']);
  layers.push(['hair_back', 'long'], ['face', 'default'], ['hair_front', look.hairItem]);
  if (look.hat) layers.push(['hat', look.hat]);
  for (const [slot, item] of layers) {
    if ((slot === 'hair_back' && (look.hairItem !== 'long' || hidesAll)) || (slot === 'hair_front' && hidesAll)) continue;
    const isBody = BODY.includes(slot);
    const image = await img(slot, item, isBody ? pose : 'still', f);
    if (!image) continue;
    const c = document.createElement('canvas');
    c.width = 32; c.height = 64;
    const cg = c.getContext('2d')!;
    const sx = isBody && pose === 'walk' ? frame * 32 : 0;
    cg.drawImage(image, sx, 0, 32, 64, 0, 0, 32, 64);
    const d = cg.getImageData(0, 0, 32, 64);
    recolour(d, slot, look);
    cg.putImageData(d, 0, 0);
    // the head layers follow the body: a sit pose lowers the head by 8 px (rig sit head offset), walk frames 1 and 3 bob 1 px up
    const dy = !isBody && pose === 'sit' ? 8 : !isBody && pose === 'walk' && frame % 2 === 1 ? -1 : 0;
    g.drawImage(c, 0, dy);
  }
  const src = g.getImageData(0, 0, 32, 64);
  const dst = g.getImageData(0, 0, 32, 64);
  const o = rgb(hex('outline'));
  for (let y = 0; y < 64; y++) for (let x = 0; x < 32; x++) {
    const i = (y * 32 + x) * 4;
    if (src.data[i + 3] !== 0) continue;
    let near = false;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx > 31 || ny > 63) continue;
      if (src.data[(ny * 32 + nx) * 4 + 3] !== 0) near = true;
    }
    if (near) { dst.data[i] = o[0]; dst.data[i + 1] = o[1]; dst.data[i + 2] = o[2]; dst.data[i + 3] = 255; }
  }
  g.putImageData(dst, 0, 0);
  return out;
}

const A: Look = { skin: 'skin', hair: 'walnut', top: 'crimson', legs: 'dusk', shoes: 'walnut', hairItem: 'short', legItem: 'trousers' };
const B: Look = { skin: 'tan', hair: 'gold', top: 'green', legs: 'walnut', shoes: 'outline', outer: 'cream', hairItem: 'long', legItem: 'hose' };
const C: Look = { skin: 'oak', hair: 'night', top: 'navy', legs: 'night', shoes: 'walnut', hairItem: 'short', legItem: 'trousers', hat: 'hood_coif' };
const D: Look = { ...B, outer: undefined, hat: 'felt_cap' };
const FACINGS: Facing[] = ['down', 'up', 'right'];

const label = (t: string, x: number, y: number): void => { ctx.fillStyle = '#3e2731'; ctx.font = '15px monospace'; ctx.fillText(t, x, y); };
const draw = (c: HTMLCanvasElement, x: number, y: number, z: number): void => { ctx.drawImage(c, x, y, 32 * z, 64 * z); };
ctx.fillStyle = '#c28569';
ctx.fillRect(0, 0, W, H);

label('A26 walk (look A: short hair, tunic, trousers), zoom 3: down 1-4, up 1-4, right 1-4', 10, 20);
let x = 10;
for (const f of FACINGS) for (let i = 0; i < 4; i++) { draw(await bake(A, 'walk', f, i), x, 28, 3); x += 100; }
label('apron + long hair + hose (look B) walk, zoom 3', 10, 240);
x = 10;
for (const f of FACINGS) for (let i = 0; i < 4; i++) { draw(await bake(B, 'walk', f, i), x, 248, 3); x += 100; }
label('SIT zoom 3: A down/up/right, B (no apron sit frame yet), C hood+coif, D felt cap', 10, 462);
x = 10;
for (const lk of [A, { ...B, outer: undefined }, C, D]) for (const f of FACINGS) { draw(await bake(lk, 'sit', f, 0), x, 470, 3); x += 100; }
label('hood + coif stand (C) and long hair + apron (B) stand, zoom 3', 10, 700);
x = 10;
for (const f of FACINGS) { draw(await bake(C, 'walk', f, 0), x, 708, 3); x += 100; }
for (const f of FACINGS) { draw(await bake(B, 'walk', f, 0), x + 40, 708, 3); x += 100; }
// zoom 1 row (game size) on a floor line
const fy = 1090;
label('zoom 1: stand A/B/C, walk right A 1-4, sit A/B/C down, sit right A/C', 10, 940);
ctx.fillStyle = '#b86f50';
ctx.fillRect(0, fy, W, 2);
x = 10;
const row: [Look, 'walk' | 'sit', Facing, number][] = [[A, 'walk', 'down', 0], [B, 'walk', 'down', 0], [C, 'walk', 'down', 0], [A, 'walk', 'right', 0], [A, 'walk', 'right', 1], [A, 'walk', 'right', 2], [A, 'walk', 'right', 3], [A, 'sit', 'down', 0], [B, 'sit', 'down', 0], [C, 'sit', 'down', 0], [A, 'sit', 'right', 0], [C, 'sit', 'right', 0]];
for (const [lk, p, f, i] of row) { draw(await bake(lk, p, f, i), x, fy - 62, 1); x += 50; }
