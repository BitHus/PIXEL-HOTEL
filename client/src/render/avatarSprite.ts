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
  GESTURE_MS,
  WALK_BOB_MS,
  WALK_BOB_PX,
  type Avatar,
  type AvatarLook,
  type Facing,
  type FurnitureType,
} from '@pixel-hotel/shared';
import { DARK_WARM } from './bareStyles.ts';
import { lyingRects } from './lieArt.ts';
import { SIT_DROP, avatarParts, sitParts, type Part } from './avatarParts.ts';

/** Draws boxes with a 1 px dark warm outline; `shadow` adds the soft shadow under the feet. */
function drawParts(ps: Part[], shadow: boolean): Graphics {
  const g = new Graphics();
  if (shadow) g.ellipse(0, 0, 9, 3).fill({ color: DARK_WARM, alpha: 0.35 });
  for (const [x, y, w, h] of ps) g.rect(x - 1, y - 1, w + 2, h + 2).fill(DARK_WARM);
  for (const [x, y, w, h, c] of ps) g.rect(x, y, w, h).fill(c);
  return g;
}

type View = 'down' | 'up' | 'right' | 'sit-down' | 'sit-up' | 'sit-right';

function drawViews(look: AvatarLook, shadow: boolean): Record<View, Graphics> {
  return {
    down: drawParts(avatarParts(look, 'down'), shadow),
    up: drawParts(avatarParts(look, 'up'), shadow),
    right: drawParts(avatarParts(look, 'right'), shadow),
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
  /** The held-item layer (section 8; step 9d): what the avatar carries, in its hands. */
  private readonly held = new Container();
  private shiftPx = 0;
  private bobPx = 0;
  /** A short move (step 9d): reach toward the facing, nod, or the shopkeeper's hand-over. */
  private gestureNow: { kind: Gesture; startMs: number } | null = null;
  private lastTimeMs = 0;

  /** `shadow` false: the room draws the shadow itself, under everything (atmosphere step). */
  constructor(
    look: AvatarLook,
    private readonly shadow = true,
  ) {
    this.look = look;
    this.views = this.draw(look);
    this.container.addChild(this.body, this.held);
  }

  /** What the avatar holds (drawn in its hands; null = nothing). The display object is kept. */
  setHeld(item: Container | null): void {
    this.held.removeChildren().forEach((c) => c.destroy({ children: true }));
    if (item) this.held.addChild(item);
    this.place();
  }

  /** The hands, relative to the feet (where a held item sits, its bottom middle). */
  handOffset(): { x: number; y: number } {
    const sit = this.last.state === 'sit' ? SIT_DROP : 0;
    const side = this.last.facing === 'right' ? 4 : this.last.facing === 'left' ? -4 : 0;
    return { x: side, y: HAND_Y + sit };
  }

  /** Starts a short gesture now (timeMs: the same clock as update). */
  gesture(kind: Gesture, timeMs = this.lastTimeMs): void {
    this.gestureNow = { kind, startMs: timeMs };
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
    const views = drawViews(look, this.shadow);
    this.body.addChild(...Object.values(views));
    return views;
  }

  /** Shows the avatar's position, facing, pose and walk bob. timeMs drives the bob. */
  update(avatar: Avatar, timeMs: number): void {
    this.lastTimeMs = timeMs;
    this.container.position.set(Math.round(avatar.x), Math.round(avatar.y));
    this.show(avatar);
    const up = avatar.state === 'walk' && Math.floor(timeMs / WALK_BOB_MS) % 2 === 1;
    this.bobPx = up ? -WALK_BOB_PX : 0;
    if (this.gestureNow && timeMs - this.gestureNow.startMs >= GESTURE_MS) this.gestureNow = null;
    this.place();
  }

  /** A small sideways shift of the body in whole px (idle customers; 0 = none). */
  setShift(px: number): void {
    this.shiftPx = px;
    this.place();
  }

  /** Puts the body (shift, bob, gesture) and the held item in place. */
  private place(): void {
    const g = gestureOffset(this.gestureNow, this.lastTimeMs, this.last.facing);
    this.body.position.set(this.shiftPx + g.body.x, this.bobPx + g.body.y);
    const hand = this.handOffset();
    this.held.position.set(hand.x + this.shiftPx + g.hand.x, hand.y + this.bobPx + g.hand.y);
    // Seen from behind, the item is in front of the avatar, so the body hides it.
    this.container.setChildIndex(this.held, this.last.facing === 'up' ? 0 : this.container.children.length - 1);
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

/** Held items sit with their bottom here, relative to the feet (just above the hands). */
const HAND_Y = -24;

export type Gesture = 'reach' | 'nod' | 'hand';

const FACING_STEP: Record<Facing, { x: number; y: number }> = {
  down: { x: 0, y: 1 },
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  left: { x: -1, y: 0 },
};

/**
 * Whole-px offsets of the body and the hands for a gesture (pure). reach: the body leans 1 px and
 * the hands 3 px toward the facing, then back. hand: the hands go 3 px forward and back (handing
 * over). nod: the body dips 1 px twice.
 */
export function gestureOffset(g: { kind: Gesture; startMs: number } | null, timeMs: number, facing: Facing): { body: { x: number; y: number }; hand: { x: number; y: number } } {
  const none = { body: { x: 0, y: 0 }, hand: { x: 0, y: 0 } };
  if (!g) return none;
  const k = (timeMs - g.startMs) / GESTURE_MS;
  if (k < 0 || k >= 1) return none;
  const d = FACING_STEP[facing];
  // Out and back: 0 -> 1 -> 0 in whole steps.
  const out = k < 0.25 || k >= 0.85 ? 1 : 2;
  if (g.kind === 'nod') return { body: { x: 0, y: (k < 0.3 || (k >= 0.55 && k < 0.85)) ? 1 : 0 }, hand: { x: 0, y: 0 } };
  if (g.kind === 'reach') return { body: { x: d.x * (out - 1), y: d.y * (out - 1) }, hand: { x: d.x * (out + 1), y: d.y * (out + 1) } };
  return { body: { x: 0, y: 0 }, hand: { x: d.x * (out + 1), y: d.y * (out + 1) } };
}
