// Placeholder avatar drawn from boxes (brief section 8): a slim figure with normal
// proportions (head about a quarter of the height), on a 32x64 canvas with the feet at the
// bottom center. Down, up and right are drawn; left is right mirrored. While walking the
// sprite bobs WALK_BOB_PX up and down (no walk frames yet).
// Step 5b poses: sit (the same boxes with the upper body lowered SIT_DROP px onto a seat about
// 10 px high, the legs bent; down, up and right drawn, left mirrored) and lie (lieArt.ts: only the
// head and shoulders on the pillow with the bed's blanket over them, drawn inside the bed:
// setLying).

import { Container, Graphics } from 'pixi.js';
import {
  PALETTE,
  WALK_BOB_MS,
  WALK_BOB_PX,
  type Avatar,
  type AvatarLook,
  type Facing,
  type FurnitureType,
} from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';
import { lyingRects } from './lieArt.ts';

/** A box relative to the feet (0, 0); y grows down, so the figure has negative y. */
export type Part = [x: number, y: number, w: number, h: number, color: string];

function color(i: number): string {
  return PALETTE[i] ?? PALETTE[0];
}

/** Boxes for one facing, back to front. */
export function avatarParts(look: AvatarLook, facing: 'down' | 'up' | 'right'): Part[] {
  const skin = color(look.skin);
  const hair = color(look.hair);
  const shirt = color(look.shirt);
  const legs = color(look.legs);
  const shoes = color(look.shoes);
  const eye = DARK_WARM;
  if (facing === 'right') {
    return [
      [-3, -26, 4, 22, shade(legs, 0.8)], // back leg
      [-3, -4, 5, 4, shade(shoes, 0.8)],
      [-1, -26, 4, 22, legs], // front leg
      [-1, -4, 6, 4, shoes],
      [-5, -44, 10, 20, shirt], // torso
      [-2, -46, 4, 2, skin], // neck
      [-5, -60, 11, 14, skin], // head
      [-6, -61, 10, 6, hair], // hair top
      [-6, -56, 5, 8, hair], // hair back
      [3, -53, 1, 2, eye],
      [-2, -43, 4, 15, shade(shirt, 0.8)], // arm
      [-2, -28, 4, 3, skin], // hand
    ];
  }
  const back = facing === 'up';
  const out: Part[] = [
    [-5, -26, 4, 22, legs],
    [1, -26, 4, 22, legs],
    [-6, -4, 5, 4, shoes],
    [1, -4, 5, 4, shoes],
    [-10, -43, 3, 15, shade(shirt, 0.8)], // arms
    [7, -43, 3, 15, shade(shirt, 0.8)],
    [-10, -28, 3, 3, skin], // hands
    [7, -28, 3, 3, skin],
    [-7, -44, 14, 20, shirt], // torso
    [-2, -46, 4, 2, skin], // neck
    [-6, -60, 12, 14, skin], // head
    [-7, -61, 14, 6, hair], // hair top
  ];
  if (back) out.push([-7, -56, 14, 8, hair]);
  else out.push([-7, -56, 2, 5, hair], [5, -56, 2, 5, hair], [-3, -53, 1, 2, eye], [2, -53, 1, 2, eye]);
  return out;
}

/** Sitting lowers the upper body this many px (the hips come down to the seat). */
const SIT_DROP = 14;

const lower = (ps: Part[], dy: number): Part[] => ps.map(([x, y, w, h, c]) => [x, y + dy, w, h, c]);

/** Sitting boxes: the standing upper body lowered, with bent legs (none seen from the back). */
function sitParts(look: AvatarLook, facing: 'down' | 'up' | 'right'): Part[] {
  const legs = color(look.legs);
  const shoes = color(look.shoes);
  // The standing boxes without the legs and shoes (the first 4 boxes in every facing).
  const upper = lower(avatarParts(look, facing).slice(4), SIT_DROP);
  if (facing === 'up') return upper;
  if (facing === 'right') {
    const legParts: Part[] = [
      [-3, -13, 9, 4, shade(legs, 0.8)], // back thigh
      [3, -10, 4, 10, shade(legs, 0.8)], // back shin
      [3, -4, 5, 4, shade(shoes, 0.8)],
      [-2, -12, 10, 4, legs], // front thigh
      [5, -9, 4, 9, legs], // front shin
      [5, -4, 6, 4, shoes],
    ];
    // Torso first, then the legs in front of it, then the arm and hand on top.
    return [...upper.slice(0, -2), ...legParts, ...upper.slice(-2)];
  }
  const legParts: Part[] = [
    [-5, -2, 4, 7, shade(legs, 0.75)], // shins, in the shade under the knees
    [1, -2, 4, 7, shade(legs, 0.75)],
    [-6, 3, 5, 4, shoes],
    [1, 3, 5, 4, shoes],
    [-6, -11, 5, 9, shade(legs, 1.2)], // thighs, toward the viewer (lit from above)
    [1, -11, 5, 9, shade(legs, 1.2)],
  ];
  return [...legParts, ...upper];
}

/** Draws boxes with a 1 px dark warm outline; `shadow` adds the soft shadow under the feet. */
function drawParts(ps: Part[], shadow: boolean): Graphics {
  const g = new Graphics();
  if (shadow) g.ellipse(0, 0, 9, 3).fill({ color: DARK_WARM, alpha: 0.35 });
  for (const [x, y, w, h] of ps) g.rect(x - 1, y - 1, w + 2, h + 2).fill(DARK_WARM);
  for (const [x, y, w, h, c] of ps) g.rect(x, y, w, h).fill(c);
  return g;
}

type View = 'down' | 'up' | 'right' | 'sit-down' | 'sit-up' | 'sit-right';

function drawViews(look: AvatarLook): Record<View, Graphics> {
  return {
    down: drawParts(avatarParts(look, 'down'), true),
    up: drawParts(avatarParts(look, 'up'), true),
    right: drawParts(avatarParts(look, 'right'), true),
    'sit-down': drawParts(sitParts(look, 'down'), false),
    'sit-up': drawParts(sitParts(look, 'up'), false),
    'sit-right': drawParts(sitParts(look, 'right'), false),
  };
}

export class AvatarSprite {
  /** Positioned at the feet (lying: the middle of the body), in world px. */
  readonly container = new Container();
  private readonly body = new Container();
  private views: Record<View, Graphics>;
  private look: AvatarLook;
  /** The lying drawing (head on the pillow, blanket over it), or null when not lying. */
  private lying: { g: Graphics; bed: FurnitureType; facing: Facing; dx: number; dy: number } | null = null;
  private last: Pick<Avatar, 'facing' | 'state'> = { facing: 'down', state: 'idle' };

  constructor(look: AvatarLook) {
    this.look = look;
    this.views = this.draw(look);
    this.container.addChild(this.body);
  }

  /** Redraws the avatar with new colours (the avatar panel). */
  setLook(look: AvatarLook): void {
    this.look = look;
    for (const v of Object.values(this.views)) v.destroy();
    this.views = this.draw(look);
    if (this.lying) this.setLying(this.lying.bed, this.lying.facing, this.lying.dx, this.lying.dy);
    this.show(this.last);
  }

  /**
   * Lying in a bed (null = not lying): the head on the pillow and the bed's blanket over it, all
   * inside the bed. (dx, dy) is the bed's anchor relative to the avatar's position.
   */
  setLying(bed: FurnitureType | null, facing: Facing = 'down', dx = 0, dy = 0): void {
    this.lying?.g.destroy();
    this.lying = null;
    if (!bed) return;
    const g = new Graphics();
    for (const [x, y, w, h, c] of lyingRects(this.look, bed, facing)) g.rect(x, y, w, h).fill(c);
    g.position.set(dx, dy);
    this.container.addChild(g);
    this.lying = { g, bed, facing, dx, dy };
    this.show(this.last);
  }

  get isLying(): boolean {
    return this.lying !== null;
  }

  private draw(look: AvatarLook): Record<View, Graphics> {
    const views = drawViews(look);
    this.body.addChild(...Object.values(views));
    return views;
  }

  /** Shows the avatar's position, facing, pose and walk bob. timeMs drives the bob. */
  update(avatar: Avatar, timeMs: number): void {
    this.container.position.set(Math.round(avatar.x), Math.round(avatar.y));
    this.show(avatar);
    const up = avatar.state === 'walk' && Math.floor(timeMs / WALK_BOB_MS) % 2 === 1;
    this.body.y = up ? -WALK_BOB_PX : 0;
  }

  private show({ facing, state }: Pick<Avatar, 'facing' | 'state'>): void {
    this.last = { facing, state };
    const lying = state === 'lie' && this.lying !== null;
    const turned = facing === 'left' ? 'right' : facing;
    const view: View = state === 'sit' ? `sit-${turned}` : turned;
    for (const [k, v] of Object.entries(this.views)) v.visible = !lying && k === view;
    if (this.lying) this.lying.g.visible = lying;
    this.body.scale.x = facing === 'left' ? -1 : 1;
  }
}
