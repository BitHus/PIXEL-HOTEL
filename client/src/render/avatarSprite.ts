// Placeholder avatar drawn from boxes (brief section 8): a slim figure with normal
// proportions (head about a quarter of the height), on a 32x64 canvas with the feet at the
// bottom center. Down, up and right are drawn; left is right mirrored. While walking the
// sprite bobs WALK_BOB_PX up and down (no walk frames yet).

import { Container, Graphics } from 'pixi.js';
import { PALETTE, WALK_BOB_MS, WALK_BOB_PX, type Avatar, type AvatarLook, type Facing } from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { shade } from './colors.ts';

/** A box relative to the feet (0, 0); y grows down, so the figure has negative y. */
type Part = [x: number, y: number, w: number, h: number, color: string];

function color(i: number): string {
  return PALETTE[i] ?? PALETTE[0];
}

/** Boxes for one facing, back to front. */
function parts(look: AvatarLook, facing: 'down' | 'up' | 'right'): Part[] {
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

function drawFacing(look: AvatarLook, facing: 'down' | 'up' | 'right'): Graphics {
  const g = new Graphics();
  const ps = parts(look, facing);
  // Soft shadow under the feet, then a 1 px dark warm outline around the whole figure.
  g.ellipse(0, 0, 9, 3).fill({ color: DARK_WARM, alpha: 0.35 });
  for (const [x, y, w, h] of ps) g.rect(x - 1, y - 1, w + 2, h + 2).fill(DARK_WARM);
  for (const [x, y, w, h, c] of ps) g.rect(x, y, w, h).fill(c);
  return g;
}

export class AvatarSprite {
  /** Positioned at the feet, in world px. */
  readonly container = new Container();
  private readonly body = new Container();
  private views: Record<'down' | 'up' | 'right', Graphics>;
  private facing: Facing = 'down';

  constructor(look: AvatarLook) {
    this.views = this.draw(look);
    this.container.addChild(this.body);
  }

  /** Redraws the avatar with new colours (the avatar panel). */
  setLook(look: AvatarLook): void {
    for (const v of Object.values(this.views)) v.destroy();
    this.views = this.draw(look);
    this.setFacing(this.facing);
  }

  private draw(look: AvatarLook): Record<'down' | 'up' | 'right', Graphics> {
    const views = { down: drawFacing(look, 'down'), up: drawFacing(look, 'up'), right: drawFacing(look, 'right') };
    this.body.addChild(views.down, views.up, views.right);
    return views;
  }

  /** Shows the avatar's position, facing and walk bob. timeMs drives the bob. */
  update(avatar: Avatar, timeMs: number): void {
    this.container.position.set(Math.round(avatar.x), Math.round(avatar.y));
    this.setFacing(avatar.facing);
    const up = avatar.state === 'walk' && Math.floor(timeMs / WALK_BOB_MS) % 2 === 1;
    this.body.y = up ? -WALK_BOB_PX : 0;
  }

  private setFacing(facing: Facing): void {
    this.facing = facing;
    const drawn = facing === 'left' ? 'right' : facing;
    for (const [k, v] of Object.entries(this.views)) v.visible = k === drawn;
    this.body.scale.x = facing === 'left' ? -1 : 1;
  }
}
