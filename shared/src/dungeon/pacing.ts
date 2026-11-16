// Pacing of a crypt floor (DG1): the MAIN ROUTE is the shortest walk from the spawn to the exit;
// a BEAT (enemy, chest, prop, landmark) must lie within PACE_GAP_BLOCKS of every point of it.
// Pure helpers on blocks; layout.ts runs the fill pass with them.

import { isFloorBlock } from './grid.ts';
import type { DungeonMap } from './run.ts';

export interface Cell {
  c: number;
  r: number;
}

const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]] as const;

/** The shortest 4-direction walk over floor blocks, both ends included. [] if there is none. */
export function routeBetween(map: DungeonMap, from: Cell, to: Cell): Cell[] {
  const key = (p: Cell): number => p.r * map.cols + p.c;
  const prev = new Map<number, number>([[key(from), -1]]);
  const queue: Cell[] = [from];
  for (let k = 0; k < queue.length; k++) {
    const p = queue[k]!;
    if (p.c === to.c && p.r === to.r) break;
    for (const [dc, dr] of DIRS) {
      const n = { c: p.c + dc, r: p.r + dr };
      if (!isFloorBlock(map, n.c, n.r) || prev.has(key(n))) continue;
      prev.set(key(n), key(p));
      queue.push(n);
    }
  }
  if (!prev.has(key(to))) return [];
  const out: Cell[] = [];
  for (let i = key(to); i !== -1; i = prev.get(i)!) out.push({ c: i % map.cols, r: Math.floor(i / map.cols) });
  return out.reverse();
}

/** Blocks between two blocks, diagonals counted as 1. */
export function cheb(a: Cell, b: Cell): number {
  return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
}

/** The distance from a block to the nearest of some blocks (Infinity when there are none). */
export function nearest(p: Cell, list: readonly Cell[]): number {
  let best = Infinity;
  for (const q of list) best = Math.min(best, cheb(p, q));
  return best;
}

/** The largest distance from any route point to its nearest beat: pacing wants this at most PACE_GAP_BLOCKS. */
export function worstBeatDistance(route: readonly Cell[], beats: readonly Cell[]): number {
  let worst = 0;
  for (const p of route) worst = Math.max(worst, nearest(p, beats));
  return worst;
}

/** The longest stretch of route blocks (steps) in which no block has one of the points within `near` blocks. */
export function longestStretchWithout(route: readonly Cell[], points: readonly Cell[], near: number): number {
  let longest = 0;
  let start = 0;
  route.forEach((p, i) => {
    if (nearest(p, points) <= near) start = i;
    longest = Math.max(longest, i - start);
  });
  return longest;
}
