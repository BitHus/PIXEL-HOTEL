// The tavern's walled kitchen, drawn as timber-framed wall pieces (owner 18 Nov). Each wall cell is its own Container in the
// depth-sorted object layer (key y = the cell's bottom edge), so avatars walk behind the wall top and in front of the near wall.
// The doorway cell is an open frame (two posts, a lintel beam, a tied-back curtain, a small lantern), keyed at the cell's middle
// so an avatar walking through passes under the lintel. Rendering only; geometry comes from shared kitchenWall().

import { Container, Graphics, Sprite } from 'pixi.js';
import { BUILD_CELL, PALETTE, type KitchenWall, type Rect } from '@pixel-hotel/shared';
import type { DepthKey } from './depthOrder.ts';
import { spriteTexture } from './spriteStore.ts';

/** How far the wall stands up above its cell (px): the cap is drawn this much above the footprint. */
export const KITCHEN_WALL_RAISE = 8;

export interface WallCellLook {
  /** A wall piece (or the doorway) is next to this cell on that side: the outline and seam there are left out. */
  n: boolean;
  e: boolean;
  s: boolean;
  w: boolean;
}

const key = (x: number, y: number): string => `${x},${y}`;

/** For each wall cell (and the doorway) which sides touch another piece of the ring. Pure. */
export function wallCellLooks(kw: KitchenWall): { rect: Rect; look: WallCellLook; door: boolean }[] {
  const all = [...kw.walls, ...(kw.door ? [kw.door] : [])];
  const set = new Set(all.map((r) => key(r.x, r.y)));
  const has = (r: Rect, dx: number, dy: number): boolean => set.has(key(r.x + dx * BUILD_CELL, r.y + dy * BUILD_CELL));
  return all.map((rect) => ({
    rect,
    door: kw.door !== null && rect.x === kw.door.x && rect.y === kw.door.y,
    look: { n: has(rect, 0, -1), e: has(rect, 1, 0), s: has(rect, 0, 1), w: has(rect, -1, 0) },
  }));
}

function drawWallCell(g: Graphics, c: Rect, l: WallCellLook): void {
  const R = KITCHEN_WALL_RAISE;
  const B = c.y + c.h; // bottom edge
  const top = c.y - R;
  const frontTop = l.s ? B - R : top + 16; // with a wall to the south the cap runs on down to the next piece
  const x0 = c.x;
  const x1 = c.x + c.w;
  // cap (the top of the wall): oak with a light top-left edge
  g.rect(x0, top, c.w, frontTop - top).fill(PALETTE[6]);
  g.rect(x0 + (l.w ? 0 : 1), top + (l.n ? 0 : 1), c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), frontTop - top - (l.n ? 0 : 1) - (l.s ? 0 : 0)).fill(PALETTE[5]);
  if (!l.n) g.rect(x0 + (l.w ? 0 : 1), top + 1, c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), 2).fill(PALETTE[4]);
  if (!l.w) g.rect(x0 + 1, top + 1, 2, frontTop - top - 1).fill(PALETTE[4]);
  if (l.s) return;
  // front face: upper half plaster between beams (timber frame), lower half darker plank
  const fh = B - frontTop;
  const half = Math.floor(fh / 2);
  g.rect(x0, frontTop, c.w, fh).fill(PALETTE[6]);
  g.rect(x0 + (l.w ? 0 : 1), frontTop, c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), half).fill(PALETTE[2]); // plaster
  g.rect(x0 + (l.w ? 0 : 1), frontTop, c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), 2).fill(PALETTE[5]); // top beam
  g.rect(x0 + (l.w ? 0 : 1), frontTop + half - 2, c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), 2).fill(PALETTE[5]); // mid beam
  if (!l.w) g.rect(x0 + 1, frontTop, 3, half).fill(PALETTE[5]); // end posts
  if (!l.e) g.rect(x1 - 4, frontTop, 3, half).fill(PALETTE[5]);
  g.rect(x0 + c.w / 2 - 1, frontTop + 2, 2, half - 4).fill(PALETTE[5]); // stud
  g.rect(x0 + (l.w ? 0 : 1), frontTop + half, c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), fh - half - 1).fill(PALETTE[5]); // dark planks
  for (const sx of [x0 + 8, x0 + 16, x0 + 24]) g.rect(sx, frontTop + half + 1, 1, fh - half - 2).fill(PALETTE[6]);
  g.rect(x0 + (l.w ? 0 : 1), frontTop + half, c.w - (l.w ? 0 : 1) - (l.e ? 0 : 1), 1).fill(PALETTE[4]); // plank top light line
}

function drawDoorFrame(g: Graphics, c: Rect): void {
  const R = KITCHEN_WALL_RAISE;
  const B = c.y + c.h;
  const top = c.y - R;
  const x0 = c.x;
  const post = 5;
  // posts down both sides (outline, oak, light edge)
  for (const px of [x0, x0 + c.w - post]) {
    g.rect(px, top, post, B - top).fill(PALETTE[6]);
    g.rect(px + 1, top + 1, post - 2, B - top - 1).fill(PALETTE[5]);
  }
  g.rect(x0 + 1, top + 1, 1, B - top - 1).fill(PALETTE[4]);
  // lintel: a cap-high beam across the top with a beam under it
  g.rect(x0, top, c.w, 14).fill(PALETTE[6]);
  g.rect(x0 + 1, top + 1, c.w - 2, 11).fill(PALETTE[4]);
  g.rect(x0 + 1, top + 1, c.w - 2, 2).fill(PALETTE[3]);
  g.rect(x0 + post, top + 14, c.w - post * 2, 3).fill(PALETTE[6]);
  // tied-back curtain on the right post: a red drape that tapers, with a gold tie
  g.rect(x0 + c.w - post - 5, top + 17, 5, 14).fill(PALETTE[7]);
  g.rect(x0 + c.w - post - 4, top + 17, 2, 11).fill(PALETTE[8]);
  g.rect(x0 + c.w - post - 3, top + 31, 3, 4).fill(PALETTE[7]);
  g.rect(x0 + c.w - post - 5, top + 24, 5, 2).fill(PALETTE[10]);
  // a small lantern on the left post: warm light spills down
  g.rect(x0 + post, top + 17, 1, 3).fill(PALETTE[6]);
  g.rect(x0 + post + 1, top + 19, 5, 6).fill(PALETTE[6]);
  g.rect(x0 + post + 2, top + 20, 3, 4).fill(PALETTE[11]);
  g.rect(x0 + post + 3, top + 21, 1, 2).fill(PALETTE[19]);
}

/** One piece of the ring: its Container and where it sorts among avatars and furniture. */
export function drawKitchenWallPiece(c: Rect, look: WallCellLook, door: boolean, uid: number): { root: Container; key: DepthKey } {
  const root = new Container({ eventMode: 'none' });
  root.label = door ? 'kitchen-door' : 'kitchen-wall';
  const g = new Graphics();
  const tex = door ? spriteTexture('doors', 'door_kitchen') : null;
  if (door && tex) {
    // the artist's doorway (96 x 64, anchor bottom centre) over the 2-cell opening of the partition
    const sp = new Sprite(tex);
    sp.position.set(c.x + c.w / 2 - 48, c.y + c.h - 64);
    root.addChild(sp);
  } else if (door) drawDoorFrame(g, c);
  else drawWallCell(g, c, look);
  root.addChild(g);
  const y = door ? c.y + c.h / 2 : c.y + c.h;
  return { root, key: { y, x: c.x + c.w / 2, uid } };
}
