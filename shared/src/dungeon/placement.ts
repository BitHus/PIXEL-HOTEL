// OA-9: where a prop may stand. Pure, on the block grid (floor or wall).
//   campfire: only on an open block, all 8 neighbours floor (it never touches or hides in a wall).
//   cobweb: only in a corner, a wall to the north and a wall to the west or east (the web hangs in that corner).
//   wall torch: never above a chest block (the torch burns on the wall front of the block, the chest sits in front of it).

import type { Cell } from './pacing.ts';
import type { DungeonMap } from './run.ts';

type FloorAt = (c: number, r: number) => boolean;

export function floorFn(map: Pick<DungeonMap, 'cols' | 'rows' | 'blocks'>): FloorAt {
  return (c, r) => c >= 0 && r >= 0 && c < map.cols && r < map.rows && map.blocks[r * map.cols + c] === 'floor';
}

/** True when the block and all 8 neighbours are floor. */
export function isOpenBlock(floor: FloorAt, p: Cell): boolean {
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!floor(p.c + dc, p.r + dr)) return false;
  return true;
}

/** 'w' or 'e' when the block is a corner (wall north and wall on that side), else null. */
export function cobwebCorner(floor: FloorAt, p: Cell): 'w' | 'e' | null {
  if (floor(p.c, p.r - 1)) return null;
  if (!floor(p.c - 1, p.r)) return 'w';
  if (!floor(p.c + 1, p.r)) return 'e';
  return null;
}

/** May this prop kind stand on this block? Kinds without a rule always may. */
export function propSpotOk(kind: string, floor: FloorAt, p: Cell): boolean {
  if (kind === 'campfire') return isOpenBlock(floor, p);
  if (kind === 'cobweb') return cobwebCorner(floor, p) !== null;
  return true;
}

/** A wall torch burns on a wall block with floor below it (about 1 in 8 by `hash`), never when that floor block holds a chest. */
export function torchAllowed(blockBelow: Cell, chestBlocks: readonly Cell[]): boolean {
  return !chestBlocks.some((b) => b.c === blockBelow.c && b.r === blockBelow.r);
}
