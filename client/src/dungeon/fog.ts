// Simple fog (step 9): blocks whose middle is within DUNGEON_LIGHT_PX of the player are lit; a
// block that was ever lit stays "seen" (drawn dim); the rest is black. Enemies only show on lit
// blocks. Pure helpers, so they are tested.

import { DUNGEON_BLOCK, DUNGEON_LIGHT_PX, type DungeonMap, type Point } from '@pixel-hotel/shared';

/** Indices (row-major) of the blocks lit from p. */
export function litBlocks(map: DungeonMap, p: Point, radius = DUNGEON_LIGHT_PX): Set<number> {
  const out = new Set<number>();
  const r = Math.ceil(radius / DUNGEON_BLOCK);
  const pc = Math.floor(p.x / DUNGEON_BLOCK);
  const pr = Math.floor(p.y / DUNGEON_BLOCK);
  for (let row = pr - r; row <= pr + r; row++) {
    for (let col = pc - r; col <= pc + r; col++) {
      if (col < 0 || row < 0 || col >= map.cols || row >= map.rows) continue;
      const cx = (col + 0.5) * DUNGEON_BLOCK;
      const cy = (row + 0.5) * DUNGEON_BLOCK;
      if (Math.hypot(cx - p.x, cy - p.y) <= radius) out.add(row * map.cols + col);
    }
  }
  return out;
}

/** The block index of a world point (or -1 outside the map). */
export function blockIndex(map: DungeonMap, p: Point): number {
  const c = Math.floor(p.x / DUNGEON_BLOCK);
  const r = Math.floor(p.y / DUNGEON_BLOCK);
  return c < 0 || r < 0 || c >= map.cols || r >= map.rows ? -1 : r * map.cols + c;
}

/** Keeps what the player has seen on this floor. */
export class FogMemory {
  lit = new Set<number>();
  readonly seen = new Set<number>();
  private lastBlock = -2;

  /** A new floor: nothing seen yet. */
  reset(): void {
    this.lit = new Set();
    this.seen.clear();
    this.lastBlock = -2;
  }

  /** Updates from the player's position; true when the lit set changed (redraw). */
  update(map: DungeonMap, p: Point): boolean {
    const b = blockIndex(map, p);
    if (b === this.lastBlock) return false;
    this.lastBlock = b;
    this.lit = litBlocks(map, p);
    for (const i of this.lit) this.seen.add(i);
    return true;
  }

  isLit(map: DungeonMap, p: Point): boolean {
    return this.lit.has(blockIndex(map, p));
  }

  isSeen(map: DungeonMap, p: Point): boolean {
    return this.seen.has(blockIndex(map, p));
  }
}
