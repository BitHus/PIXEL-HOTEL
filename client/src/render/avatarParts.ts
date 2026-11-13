// The placeholder avatar as boxes (brief section 8): a slim figure with normal proportions (head
// about a quarter of the height) on a 32x64 canvas, feet at (0, 0). Down, up and right are drawn;
// left is right mirrored. This shape is the approved base: clothing styles (step 7b,
// clothing.json) only change the hair, top and bottoms boxes, never the body's size.
// Pure data (no Pixi): the room sprite, the lying drawing and the HTML previews all use it.

import { PALETTE, type AvatarLook } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';

/** A box relative to the feet (0, 0); y grows down, so the figure has negative y. */
export type Part = [x: number, y: number, w: number, h: number, color: string];
export type Facing3 = 'down' | 'up' | 'right';

function color(i: number): string {
  return PALETTE[i] ?? PALETTE[0];
}

/** The shirt under a vest. */
const UNDERSHIRT = PALETTE[2];

/** The boxes of one facing in three groups (back to front within each). */
export interface AvatarBoxes {
  /** Legs, shoes and the bottoms (standing). */
  legs: Part[];
  /** Arms (down/up), torso, neck, head, hair, eyes. */
  upper: Part[];
  /** Down/up: empty. Right: the near arm and hand, drawn last. */
  arm: Part[];
}

function bottomsBoxes(look: AvatarLook, facing: Facing3): Part[] {
  const legs = color(look.legs);
  const skin = color(look.skin);
  const shoes = color(look.shoes);
  const style = look.bottoms;
  if (facing === 'right') {
    const back = shade(legs, 0.8);
    const w = style === 'baggy' ? 5 : 4;
    const leg = (x: number, c: string): Part[] =>
      style === 'shorts'
        ? [[x, -26, w, 10, c], [x, -16, w, 12, shade(skin, c === legs ? 1 : 0.8)]]
        : style === 'skirt'
          ? [[x, -26, w, 22, shade(skin, c === legs ? 1 : 0.8)]]
          : [[x, -26, w, 22, c]];
    const out: Part[] = [...leg(-3, back), [-3, -4, 5, 4, shade(shoes, 0.8)], ...leg(-1, legs), [-1, -4, 6, 4, shoes]];
    if (style === 'skirt') out.push([-5, -26, 11, 11, legs]);
    return out;
  }
  const w = style === 'baggy' ? 5 : 4;
  const xs = style === 'baggy' ? [-6, 1] : [-5, 1];
  const out: Part[] = [];
  for (const x of xs) {
    if (style === 'shorts') out.push([x, -26, w, 10, legs], [x, -16, w, 12, skin]);
    else if (style === 'skirt') out.push([x, -26, w, 22, skin]);
    else out.push([x, -26, w, 22, legs]);
  }
  out.push([-6, -4, 5, 4, shoes], [1, -4, 5, 4, shoes]);
  if (style === 'skirt') out.push([-7, -26, 14, 11, legs]);
  return out;
}

function hairBoxes(look: AvatarLook, facing: Facing3): Part[] {
  const hair = color(look.hair);
  const eye = DARK_WARM;
  const style = look.hairStyle;
  if (facing === 'right') {
    if (style === 'buzz') return [[-5, -61, 10, 3, hair], [-5, -58, 4, 3, hair], [3, -53, 1, 2, eye]];
    if (style === 'mohawk') return [[-4, -63, 8, 4, hair], [3, -53, 1, 2, eye]];
    const out: Part[] = [[-6, -61, 10, 6, hair], [-6, -56, 5, style === 'long' ? 14 : 8, hair], [3, -53, 1, 2, eye]];
    if (style === 'ponytail') out.push([-9, -55, 3, 10, hair]);
    return out;
  }
  const back = facing === 'up';
  if (style === 'buzz') {
    return back ? [[-6, -61, 12, 4, hair], [-6, -57, 12, 3, hair]] : [[-6, -61, 12, 3, hair], [-3, -53, 1, 2, eye], [2, -53, 1, 2, eye]];
  }
  if (style === 'mohawk') return back ? [[-2, -63, 4, 9, hair]] : [[-2, -63, 4, 5, hair], [-3, -53, 1, 2, eye], [2, -53, 1, 2, eye]];
  const out: Part[] = [[-7, -61, 14, 6, hair]];
  if (back) {
    out.push([-7, -56, 14, style === 'long' ? 14 : 8, hair]);
    if (style === 'ponytail') out.push([-2, -50, 4, 10, hair]);
  } else {
    const side = style === 'long' ? 12 : 5;
    out.push([-7, -56, 2, side, hair], [5, -56, 2, side, hair], [-3, -53, 1, 2, eye], [2, -53, 1, 2, eye]);
  }
  return out;
}

/** The arm from the shoulder down (x, width), in the top's style, with the hand. */
function armBoxes(look: AvatarLook, x: number, w: number, dim: number): Part[] {
  const shirt = color(look.shirt);
  const skin = color(look.skin);
  const sleeve = shade(look.top === 'vest' ? UNDERSHIRT : shirt, dim);
  if (look.top === 't_shirt') return [[x, -43, w, 7, sleeve], [x, -36, w, 8, skin], [x, -28, w, 3, skin]];
  return [[x, -43, w, 15, sleeve], [x, -28, w, 3, skin]];
}

function torsoBoxes(look: AvatarLook, facing: Facing3): Part[] {
  const shirt = color(look.shirt);
  const long = look.top === 'tunic' ? 6 : 0;
  if (facing === 'right') {
    const t: Part[] = [[-5, -44, 10, 20 + long, shirt]];
    if (look.top === 'vest') t.push([3, -44, 2, 20, UNDERSHIRT]);
    return t;
  }
  const t: Part[] = [[-7, -44, 14, 20 + long, shirt]];
  if (look.top === 'vest' && facing === 'down') t.push([-1, -44, 2, 20, UNDERSHIRT]);
  return t;
}

export function avatarBoxes(look: AvatarLook, facing: Facing3): AvatarBoxes {
  const skin = color(look.skin);
  const legs = bottomsBoxes(look, facing);
  const head: Part[] = facing === 'right' ? [[-2, -46, 4, 2, skin], [-5, -60, 11, 14, skin]] : [[-2, -46, 4, 2, skin], [-6, -60, 12, 14, skin]];
  if (facing === 'right') {
    return { legs, upper: [...torsoBoxes(look, facing), ...head, ...hairBoxes(look, facing)], arm: armBoxes(look, -2, 4, 0.8) };
  }
  const arms = [...armBoxes(look, -10, 3, 0.8), ...armBoxes(look, 7, 3, 0.8)];
  return { legs, upper: [...arms, ...torsoBoxes(look, facing), ...head, ...hairBoxes(look, facing)], arm: [] };
}

/** All boxes for one facing, back to front. */
export function avatarParts(look: AvatarLook, facing: Facing3): Part[] {
  const b = avatarBoxes(look, facing);
  return [...b.legs, ...b.upper, ...b.arm];
}

/** Sitting lowers the upper body this many px (the hips come down to the seat). */
export const SIT_DROP = 14;

export const lower = (ps: Part[], dy: number): Part[] => ps.map(([x, y, w, h, c]) => [x, y + dy, w, h, c]);

/** Sitting boxes: the standing upper body lowered, with bent legs (none seen from the back). */
export function sitParts(look: AvatarLook, facing: Facing3): Part[] {
  const b = avatarBoxes(look, facing);
  const upper = lower(b.upper, SIT_DROP);
  const arm = lower(b.arm, SIT_DROP);
  if (facing === 'up') return upper;
  const legs = color(look.legs);
  const shoes = color(look.shoes);
  const skin = color(look.skin);
  // Shorts and skirts show skin below the knee.
  const shin = look.bottoms === 'shorts' || look.bottoms === 'skirt' ? skin : legs;
  if (facing === 'right') {
    const legParts: Part[] = [
      [-3, -13, 9, 4, shade(legs, 0.8)], // back thigh
      [3, -10, 4, 10, shade(shin, 0.8)], // back shin
      [3, -4, 5, 4, shade(shoes, 0.8)],
      [-2, -12, 10, 4, legs], // front thigh
      [5, -9, 4, 9, shin], // front shin
      [5, -4, 6, 4, shoes],
    ];
    return [...upper, ...legParts, ...arm];
  }
  const legParts: Part[] = [
    [-5, -2, 4, 7, shade(shin, 0.75)], // shins, in the shade under the knees
    [1, -2, 4, 7, shade(shin, 0.75)],
    [-6, 3, 5, 4, shoes],
    [1, 3, 5, 4, shoes],
    [-6, -11, 5, 9, shade(legs, 1.2)], // thighs, toward the viewer (lit from above)
    [1, -11, 5, 9, shade(legs, 1.2)],
  ];
  if (look.bottoms === 'skirt') legParts.push([-7, -11, 14, 9, shade(legs, 1.2)]);
  return [...legParts, ...upper];
}

/** Bounds of the drawn boxes with the 1 px outline: [minX, minY, maxX, maxY]. */
export function partBounds(ps: readonly Part[]): [number, number, number, number] {
  return [
    Math.min(...ps.map((p) => p[0] - 1)),
    Math.min(...ps.map((p) => p[1] - 1)),
    Math.max(...ps.map((p) => p[0] + p[2] + 1)),
    Math.max(...ps.map((p) => p[1] + p[3] + 1)),
  ];
}

/**
 * Draws the standing avatar on a 2D canvas (HTML previews: character creation, the Avatar panel),
 * `scale` canvas px per art px, the feet at the bottom middle. 'left' is 'right' mirrored.
 */
export function drawAvatarOnCanvas(canvas: HTMLCanvasElement, look: AvatarLook, facing: Facing3 | 'left', scale: number): void {
  const w = 32;
  const h = 66;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  const ps = avatarParts(look, facing === 'left' ? 'right' : facing);
  const mirror = facing === 'left' ? -1 : 1;
  const ox = w / 2;
  const oy = h - 1;
  const rect = (x: number, y: number, rw: number, rh: number, c: string): void => {
    const x0 = mirror === 1 ? x : -(x + rw);
    ctx.fillStyle = c;
    ctx.fillRect((ox + x0) * scale, (oy + y) * scale, rw * scale, rh * scale);
  };
  for (const [x, y, rw, rh] of ps) rect(x - 1, y - 1, rw + 2, rh + 2, DARK_WARM);
  for (const [x, y, rw, rh, c] of ps) rect(x, y, rw, rh, c);
}
