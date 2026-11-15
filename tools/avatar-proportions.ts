// B7: avatar proportion sheet (docs/PLAN-CHARACTERS.md section 2). Three boxy figures on a 32 x 64 canvas, feet bottom centre:
// A slim (the current box avatar proportions), B cosy three-head (the recommendation), C chibi two-head. Each is shown at
// zoom 3, as a black silhouette, with three outfits (tunic, apron, cloak) and next to a chair, the bar and a door at zoom 2 and 1.
// It does NOT touch avatarParts.ts. To run it: copy this file to client/src/avatar-proportions.ts, add client/avatar-proportions.html
// with <script type="module" src="/src/avatar-proportions.ts"></script>, run `npx vite` in client/ and screenshot the page
// (headless Chrome). Delete both copies afterwards.
import { PALETTE } from '@pixel-hotel/shared';

type Box = [x: number, y: number, w: number, h: number, color: string];
const P = (i: number): string => PALETTE[i]!;
const OUT = P(6);
const SKIN = P(30);
const SKIN_DARK = P(31);

type Opt = 'A' | 'B' | 'C';
type Outfit = 'tunic' | 'apron' | 'cloak';
type Hat = 'none' | 'straw' | 'cook';

/** The boxes of one figure facing down, feet at (0, 0), y up is negative. */
function figure(opt: Opt, outfit: Outfit, hat: Hat): Box[] {
  const b: Box[] = [];
  const hair = P(5);
  const tunic = P(7);
  const sleeve = outfit === 'cloak' ? P(27) : tunic;
  const body = outfit === 'cloak' ? P(8) : tunic;
  if (opt === 'A') {
    // Slim, 63 px: head 14, torso 12 wide, legs 22 long.
    if (outfit === 'cloak') b.push([-9, -48, 18, 40, P(27)]);
    b.push([-5, -4, 5, 4, P(5)], [1, -4, 5, 4, P(5)], [-5, -26, 4, 22, P(23)], [1, -26, 4, 22, P(23)]);
    b.push([-9, -47, 3, 20, sleeve], [6, -47, 3, 20, sleeve], [-9, -28, 3, 3, SKIN], [6, -28, 3, 3, SKIN]);
    b.push([-6, -49, 12, 24, body], [-6, -27, 12, 2, P(5)]);
    if (outfit === 'apron') b.push([-5, -44, 10, 20, P(2)]);
    b.push([-3, -52, 6, 3, SKIN_DARK]);
    b.push([-7, -63, 14, 12, SKIN], [-7, -63, 14, 3, hair], [-7, -60, 2, 5, hair], [5, -60, 2, 5, hair]);
    b.push([-4, -57, 1, 1, OUT], [3, -57, 1, 1, OUT]);
    if (hat === 'straw') b.push([-11, -64, 22, 2, P(11)], [-6, -69, 12, 5, P(10)], [-6, -65, 12, 1, P(0)]);
    if (hat === 'cook') b.push([-6, -75, 12, 12, P(19)]);
  } else if (opt === 'B') {
    // Cosy three-head, 54 px + hat zone (spec of PLAN-CHARACTERS section 2).
    if (outfit === 'cloak') b.push([-10, -34, 20, 32, P(27)]);
    b.push([-6, -6, 5, 6, P(5)], [1, -6, 5, 6, P(5)], [-5, -19, 4, 13, P(23)], [1, -19, 4, 13, P(23)]);
    b.push([-10, -33, 3, 13, sleeve], [7, -33, 3, 13, sleeve], [-10, -22, 3, 3, SKIN], [7, -22, 3, 3, SKIN]);
    b.push([-7, -34, 14, 15, body], [-7, -22, 14, 2, P(5)], [-1, -22, 2, 2, P(10)]);
    if (outfit === 'apron') b.push([-6, -31, 12, 12, P(2)], [-6, -31, 2, 6, P(2)], [4, -31, 2, 6, P(2)]);
    b.push([-8, -52, 16, 17, SKIN], [-8, -52, 16, 4, hair], [-9, -50, 2, 7, hair], [7, -50, 2, 7, hair]);
    b.push([-4, -45, 1, 2, OUT], [3, -45, 1, 2, OUT], [-5, -42, 2, 1, P(29)], [3, -42, 2, 1, P(29)]);
    if (hat === 'straw') b.push([-13, -54, 26, 3, P(11)], [-7, -61, 14, 7, P(10)], [-7, -55, 14, 1, P(0)]);
    if (hat === 'cook') b.push([-8, -64, 16, 12, P(19)], [-8, -53, 16, 2, P(20)]);
  } else {
    // Chibi two-head, 42 px: head 20 of 42.
    if (outfit === 'cloak') b.push([-8, -21, 16, 18, P(27)]);
    b.push([-4, -3, 4, 3, P(5)], [1, -3, 4, 3, P(5)], [-4, -10, 3, 7, P(23)], [1, -10, 3, 7, P(23)]);
    b.push([-8, -20, 2, 9, sleeve], [6, -20, 2, 9, sleeve]);
    b.push([-6, -22, 12, 12, body], [-6, -13, 12, 2, P(5)]);
    if (outfit === 'apron') b.push([-5, -19, 10, 8, P(2)]);
    b.push([-10, -42, 20, 20, SKIN], [-10, -42, 20, 5, hair], [-11, -40, 2, 8, hair], [9, -40, 2, 8, hair]);
    b.push([-6, -32, 2, 3, OUT], [4, -32, 2, 3, OUT], [-8, -28, 2, 1, P(29)], [6, -28, 2, 1, P(29)]);
    if (hat === 'straw') b.push([-15, -44, 30, 3, P(11)], [-9, -51, 18, 7, P(10)], [-9, -45, 18, 1, P(0)]);
    if (hat === 'cook') b.push([-10, -54, 20, 12, P(19)], [-10, -43, 20, 2, P(20)]);
  }
  return b;
}

const W = 1320;
const H = 1230;
const cv = document.createElement('canvas');
cv.width = W;
cv.height = H;
document.body.style.margin = '0';
document.body.style.background = '#181425';
document.body.appendChild(cv);
const ctx = cv.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

function drawBoxes(boxes: Box[], ox: number, oy: number, z: number, sil = false): void {
  // A 1 px outline around the union: every box grown by 1 in the outline colour first.
  ctx.fillStyle = sil ? '#000000' : OUT;
  for (const [x, y, w, h] of boxes) ctx.fillRect(ox + (x - 1) * z, oy + (y - 1) * z, (w + 2) * z, (h + 2) * z);
  for (const [x, y, w, h, c] of boxes) {
    ctx.fillStyle = sil ? '#000000' : c;
    ctx.fillRect(ox + x * z, oy + y * z, w * z, h * z);
  }
}
const load = (url: string): Promise<HTMLImageElement> => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = url; });
const chair = await load(new URL('./assets/sprites/furniture/chair.png', import.meta.url).href);
const counter = await load(new URL('./assets/sprites/furniture/counter.png', import.meta.url).href);

function door(ox: number, oy: number, z: number): void {
  // A 2-cell door: 64 px wide, 96 px tall, an oak door with iron straps; its foot at (ox, oy).
  const boxes: Box[] = [[-32, -96, 64, 96, P(5)], [-28, -92, 56, 92, P(4)]];
  for (let i = 0; i < 4; i++) boxes.push([-28 + i * 14, -92, 1, 92, P(5)]);
  boxes.push([-28, -80, 56, 3, P(21)], [-28, -40, 56, 3, P(21)], [14, -52, 6, 6, P(10)]);
  drawBoxes(boxes, ox, oy, z);
}

function scene(opt: Opt, ox: number, oy: number, z: number, withHat: Hat): void {
  // Floor line at oy. Left to right: a figure beside a chair, the bar (3 cells) with an apron figure behind it, a door, a cloak figure.
  ctx.fillStyle = '#3a4466';
  ctx.fillRect(ox, oy, 300 * z, 2 * z);
  drawBoxes(figure(opt, 'tunic', withHat), ox + 24 * z, oy, z);
  ctx.drawImage(chair, 0, 0, 32, 76, ox + 50 * z, oy - 76 * z + 16 * z, 32 * z, 76 * z);
  drawBoxes(figure(opt, 'apron', 'none'), ox + 144 * z, oy - 16 * z, z);
  ctx.drawImage(counter, 0, 0, 96, 64, ox + 96 * z, oy - 64 * z + 20 * z, 96 * z, 64 * z);
  door(ox + 240 * z, oy, z);
  drawBoxes(figure(opt, 'cloak', 'none'), ox + 280 * z, oy, z);
}

const names: Record<Opt, string> = {
  A: 'A  slim (today), 63 px, head 14',
  B: 'B  cosy three-head (recommended), 54 px + hat zone, head 17',
  C: 'C  chibi two-head, 42 px, head 20',
};
ctx.font = '16px monospace';
let row = 0;
for (const opt of ['A', 'B', 'C'] as Opt[]) {
  const oy = 300 + row * 300;
  ctx.fillStyle = '#ead4aa';
  ctx.fillText(names[opt], 10, oy - 262);
  // close-ups at zoom 3: straw hat + tunic, cook cap + apron, cloak; then the same three as black silhouettes
  const outfits: [Outfit, Hat][] = [['tunic', 'straw'], ['apron', 'cook'], ['cloak', 'none']];
  outfits.forEach(([o, h], i) => drawBoxes(figure(opt, o, h), 70 + i * 100, oy - 20, 3));
  outfits.forEach(([o, h], i) => drawBoxes(figure(opt, o, h), 400 + i * 80, oy - 20, 3, true));
  scene(opt, 650, oy - 20, 2, 'straw');
  row++;
}
ctx.fillStyle = '#ead4aa';
ctx.fillText('zoom 1 (real size): A, B, C with the same hat, chair, bar and door', 10, H - 130);
(['A', 'B', 'C'] as Opt[]).forEach((opt, i) => scene(opt, 10 + i * 330, H - 20, 1, 'straw'));
