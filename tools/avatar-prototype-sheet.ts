// TEMPORARY contact sheet for A24 (deleted after the screenshot): bakes the prototype layers the way C18 will
window.addEventListener('unhandledrejection', (e) => { document.body.insertAdjacentText('beforeend', String(e.reason)); });
window.addEventListener('error', (e) => { document.body.insertAdjacentText('beforeend', e.message); });
// (key colours -> ramps, composite in order, one 1 px outline pass) and shows them at zoom 1 and 3 next to a chair.
import { PALETTE, PALETTE_NAMES, KEY_RAMPS, rampFor, type PaletteName } from '@pixel-hotel/shared';

const W = 1300;
const H = 760;
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
const load = (url: string): Promise<HTMLImageElement> => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('load ' + url)); i.src = url; });
const base = new URL('./assets/sprites/avatar', import.meta.url).href;
const files = {
  body: 'body_base_walk_down.png', shoes: 'shoes_boots_walk_down.png', legs: 'legs_trousers_walk_down.png', torso: 'torso_tunic_walk_down.png',
  hair: 'hair_front_short_still_down.png', face: 'face_default_still_down.png', hat: 'hat_straw_hat_still_down.png',
} as const;
const img: Record<string, HTMLImageElement> = {};
for (const [k, f] of Object.entries(files)) img[k] = await load(base + '/' + f);
const chair = await load(new URL('./assets/sprites/furniture/chair.png', import.meta.url).href);

interface Look { skin: PaletteName; hair: PaletteName; top: PaletteName; legs: PaletteName; shoes: PaletteName; hat: boolean }

/** A frame of one layer as ImageData, key colours swapped for the ramps. */
function layerData(name: keyof typeof files, frame: number, look: Look): ImageData {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  const g = c.getContext('2d')!;
  const wide = img[name]!.width > 32;
  g.drawImage(img[name]!, wide ? frame * 32 : 0, 0, 32, 64, 0, 0, 32, 64);
  const d = g.getImageData(0, 0, 32, 64);
  const map = new Map<string, string>();
  const add = (keys: readonly PaletteName[], ramp: readonly PaletteName[] | null): void => { if (ramp) keys.forEach((k, i) => map.set(hex(k), hex(ramp[i]!))); };
  if (name === 'body') add(KEY_RAMPS.KS, rampFor(look.skin));
  if (name === 'torso') { add(KEY_RAMPS.K1, rampFor(look.top)); add(KEY_RAMPS.KS, rampFor(look.skin)); }
  if (name === 'legs') add(KEY_RAMPS.K1, rampFor(look.legs));
  if (name === 'shoes') add(KEY_RAMPS.K1, rampFor(look.shoes));
  if (name === 'hair') add(KEY_RAMPS.K1, rampFor(look.hair));
  for (let i = 0; i < d.data.length; i += 4) {
    if (d.data[i + 3] === 0) continue;
    const h = '#' + [d.data[i]!, d.data[i + 1]!, d.data[i + 2]!].map((v) => v.toString(16).padStart(2, '0')).join('');
    const to = map.get(h);
    if (to) { const [r, gg, b] = rgb(to); d.data[i] = r; d.data[i + 1] = gg; d.data[i + 2] = b; }
  }
  return d;
}

/** Composites the layers in order and adds the 1 px outline; returns a 32 x 64 canvas. */
function bake(frame: number, look: Look): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = 32; out.height = 64;
  const g = out.getContext('2d')!;
  const order: (keyof typeof files)[] = ['body', 'shoes', 'legs', 'torso', 'face', 'hair', ...(look.hat ? (['hat'] as const) : [])];
  // face is drawn before hair_front (spec order: face, hair_front, hat); hair_front has the fringe over the forehead
  for (const n of order) {
    const t = document.createElement('canvas');
    t.width = 32; t.height = 64;
    t.getContext('2d')!.putImageData(layerData(n, frame, look), 0, 0);
    g.drawImage(t, 0, 0);
  }
  // outline pass: every transparent pixel next to an opaque one becomes the outline colour
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

const looks: Look[] = [
  { skin: 'skin', hair: 'walnut', top: 'crimson', legs: 'dusk', shoes: 'walnut', hat: true },
  { skin: 'tan', hair: 'gold', top: 'green', legs: 'walnut', shoes: 'outline', hat: false },
  { skin: 'oak', hair: 'night', top: 'navy', legs: 'night', shoes: 'walnut', hat: true },
];
function draw(c: HTMLCanvasElement, x: number, y: number, z: number): void { ctx.drawImage(c, x, y, 32 * z, 64 * z); }

ctx.fillStyle = '#3e2731';
ctx.font = '15px monospace';
ctx.fillStyle = '#c28569';
ctx.fillRect(0, 0, W, H);
ctx.fillStyle = '#3e2731';
ctx.fillText('A24 prototype (down): body, shoes, legs, tunic, hair, face, hat. Zoom 3: walk frames 1 to 4 (contact, pass, contact, pass) of three recolours', 10, 20);
for (let f = 0; f < 4; f++) draw(bake(f, looks[0]!), 10 + f * 110, 40, 3);
// rows: look 0 at zoom 3 across (frames), looks 1 and 2 at zoom 3 stand pose to the right
draw(bake(0, looks[1]!), 470, 40, 3);
draw(bake(0, looks[2]!), 580, 40, 3);
// next to the chair, bar height: zoom 3 and zoom 1
ctx.fillStyle = '#3e2731';
ctx.fillText('next to the chair, zoom 3 and zoom 1 (feet on one line)', 10, 255);
const floorY3 = 480;
ctx.fillStyle = '#b86f50';
ctx.fillRect(0, floorY3, 760, 4);
draw(bake(0, looks[0]!), 30, floorY3 - 64 * 3 + 6, 3);
ctx.drawImage(chair, 0, 0, 32, 76, 160, floorY3 - 76 * 3 + 16 * 3 + 3 * 0, 32 * 3, 76 * 3);
draw(bake(1, looks[1]!), 280, floorY3 - 64 * 3 + 6, 3);
const floorY1 = 700;
ctx.fillStyle = '#b86f50';
ctx.fillRect(0, floorY1, 760, 2);
for (let i = 0; i < 3; i++) draw(bake(i, looks[i]!), 30 + i * 70, floorY1 - 64 + 2, 1);
ctx.drawImage(chair, 0, 0, 32, 76, 260, floorY1 - 76 + 16 + 2, 32, 76);
draw(bake(0, looks[2]!), 300, floorY1 - 64 + 2, 1);
// the raw layers (key colours) for the lead: stand pose
ctx.fillStyle = '#3e2731';
ctx.fillText('raw layers (key colours), frame 1', 790, 255);
(['body', 'shoes', 'legs', 'torso', 'hair', 'face', 'hat'] as const).forEach((n, i) => {
  const c = document.createElement('canvas');
  c.width = 32; c.height = 64;
  c.getContext('2d')!.drawImage(img[n]!, 0, 0, 32, 64, 0, 0, 32, 64);
  ctx.fillStyle = '#b86f50';
  ctx.fillRect(790 + i * 70, 270, 66, 130);
  ctx.drawImage(c, 790 + i * 70 + 1, 270 + 1, 64, 128);
});
