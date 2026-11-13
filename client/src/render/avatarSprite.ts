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
  WALK_BOB_MS,
  WALK_BOB_PX,
  type Avatar,
  type AvatarLook,
  type Facing,
  type FurnitureType,
} from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { lyingRects } from './lieArt.ts';
import { avatarParts, sitParts, type Part } from './avatarParts.ts';

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
