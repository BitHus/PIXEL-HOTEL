// A lying avatar (step 5b fix): drawn inside the bed only. The head and a little of the shoulders
// lie on the pillow, turned so the top of the head points to the pillow end; the rest of the body
// is under the bed's own blanket ('cover' boxes), which is drawn again over it, so it looks tucked
// in. Draw order inside the avatar sprite: head and shoulders, then the blanket; the sprite sorts
// right after its bed, so the result is bed frame, head, blanket.
// Pure geometry (tested): rectangles relative to the bed's anchor, for every facing.

import type { AvatarLook, Facing, FurnitureType } from '@pixel-hotel/shared';
import { furnitureRects, type ArtRect } from './furnitureArt.ts';
import { avatarParts, type Part } from './avatarSprite.ts';
import { DARK_WARM } from './bareStyles.ts';

/** The middle of the standing head, from the feet (avatarParts 'down': head y -60..-46). */
const HEAD_MIDDLE_Y = -53;
/** Parts above this y (from the feet) are drawn: head, hair, neck and the top of the shoulders. */
const SHOULDERS_END_Y = -36;

/** Quarter turns that take 'up' (-y) to the head direction of a bed facing this way. */
const TURNS: Record<Facing, number> = { down: 0, right: 3, up: 2, left: 1 };

function turnPoint(x: number, y: number, turns: number): [number, number] {
  for (let i = 0; i < turns; i++) [x, y] = [-y, x];
  return [x + 0, y + 0];
}

/** Rectangles of a box turned by quarter turns around (0, 0). */
function turnRect([x, y, w, h, c]: ArtRect, turns: number): ArtRect {
  const [ax, ay] = turnPoint(x, y, turns);
  const [bx, by] = turnPoint(x + w, y + h, turns);
  return [Math.min(ax, bx), Math.min(ay, by), Math.abs(bx - ax), Math.abs(by - ay), c];
}

/** The bed drawing's rectangles for a facing, with 'left' mirrored (as on screen). */
export function bedRects(type: FurnitureType, facing: Facing, role?: 'pillow' | 'cover'): ArtRect[] {
  const rects = furnitureRects(type, facing, role);
  return facing === 'left' ? rects.map(([x, y, w, h, c]) => [-(x + w), y, w, h, c]) : rects;
}

/** Bounds of rectangles: [minX, minY, maxX, maxY]. */
export function rectBounds(rects: readonly ArtRect[]): [number, number, number, number] {
  return [
    Math.min(...rects.map((r) => r[0])),
    Math.min(...rects.map((r) => r[1])),
    Math.max(...rects.map((r) => r[0] + r[2])),
    Math.max(...rects.map((r) => r[1] + r[3])),
  ];
}

/** Where the middle of the head goes: the middle of the pillow's drawing (relative to the anchor). */
export function pillowMiddle(type: FurnitureType, facing: Facing): { x: number; y: number } {
  const [x0, y0, x1, y1] = rectBounds(bedRects(type, facing, 'pillow'));
  return { x: Math.round((x0 + x1) / 2), y: Math.round((y0 + y1) / 2) };
}

/**
 * The rectangles of an avatar lying in this bed, relative to the bed's anchor, in draw order:
 * outlines and fills of the head and shoulders, then the blanket over them.
 */
export function lyingRects(look: AvatarLook, type: FurnitureType, facing: Facing): ArtRect[] {
  const head = pillowMiddle(type, facing);
  const turns = TURNS[facing];
  const parts = avatarParts(look, 'down')
    .filter((p: Part) => p[1] < SHOULDERS_END_Y)
    .map(([x, y, w, h, c]): ArtRect => [x, y - HEAD_MIDDLE_Y, w, Math.min(h, SHOULDERS_END_Y - y), c])
    .map((r) => turnRect(r, turns))
    .map(([x, y, w, h, c]): ArtRect => [x + head.x, y + head.y, w, h, c]);
  const outline = parts.map(([x, y, w, h]): ArtRect => [x - 1, y - 1, w + 2, h + 2, DARK_WARM]);
  return [...outline, ...parts, ...bedRects(type, facing, 'cover')];
}
