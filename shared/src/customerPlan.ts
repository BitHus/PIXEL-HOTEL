// What a shop visitor does (owner, after 9d): no fixed route. Every visitor gets a short plan of
// small behaviours picked by rng with weights, different per customer kind. Pure: the rng is
// passed in. Also the customers' own nav grid: the staff zone behind the counter is blocked for
// them, so an NPC never walks or stands where the player serves.
//
// Behaviours: 'wander' (walk to a random free spot and stand a moment), 'decor' (look at a random
// decoration), 'goods' (look at a table, shelf or case with stock), 'talk' (stop at another
// customer and chat, 2 to 3 bubbles back and forth), 'remark' (say something to nobody), 'sit'
// (sit on a free seat for a moment). A buyer's plan ends with 'goods': that last look is the one
// they decide at. A window-shopper's plan has no decision: they do their things and leave.

import { ACT_KIND_BONUS, ACT_WEIGHTS, BUYER_ACTS, WINDOW_ACTS } from './config.ts';
import { getFurnitureType, staffZone } from './furniture.ts';
import { cellAt, cellCenter, cellRect, findPath, isCellFree, nearestFreeCell, reachableCells, type NavGrid } from './nav.ts';
import type { CustomerKind } from './npcTalk.ts';
import { rectsOverlap } from './room.ts';
import { rngInt } from './rng.ts';
import type { FurnitureItem, Point, Rect, Rng } from './types.ts';

export type Behaviour = keyof typeof ACT_WEIGHTS;
export const BEHAVIOURS = Object.keys(ACT_WEIGHTS) as Behaviour[];

/** The weight of a behaviour for a customer kind. */
export function actWeight(act: Behaviour, kind: CustomerKind): number {
  const bonus: Partial<Record<Behaviour, number>> = ACT_KIND_BONUS[kind];
  return ACT_WEIGHTS[act] * (bonus[act] ?? 1);
}

/** One behaviour by weight for this kind, never one of `not`. Null when nothing is left. */
export function pickBehaviour(rng: Rng, kind: CustomerKind, not: readonly Behaviour[] = []): Behaviour | null {
  const options = BEHAVIOURS.filter((b) => !not.includes(b) && actWeight(b, kind) > 0);
  const total = options.reduce((a, b) => a + actWeight(b, kind), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const b of options) {
    r -= actWeight(b, kind);
    if (r < 0) return b;
  }
  return options[options.length - 1] ?? null;
}

/** A plan as one string (ShopState.lastPlan: the next visitor never gets the same one). */
export function planKey(plan: readonly Behaviour[]): string {
  return plan.join('>');
}

/**
 * A visitor's plan. A buyer does 0 to 3 small things (by kind) and then goes to the goods; a
 * window-shopper does 1 to 4 and leaves. The same behaviour never comes twice in a row, and the
 * plan is never the same as `last` (the plan of the visitor before; a few new rolls, then one
 * behaviour is swapped).
 */
export function planVisit(rng: Rng, kind: CustomerKind, buys: boolean, last: string | undefined): Behaviour[] {
  const roll = (): Behaviour[] => {
    const [lo, hi] = (buys ? BUYER_ACTS : WINDOW_ACTS)[kind];
    const n = rngInt(rng, lo, hi);
    const plan: Behaviour[] = [];
    for (let i = 0; i < n; i++) {
      const not: Behaviour[] = [];
      const before = plan[plan.length - 1];
      if (before) not.push(before);
      // A buyer's last small thing is not the goods: the goods come right after it.
      if (buys && i === n - 1) not.push('goods');
      const b = pickBehaviour(rng, kind, not);
      if (b) plan.push(b);
    }
    if (buys) plan.push('goods');
    return plan;
  };
  let plan = roll();
  for (let tries = 0; tries < 4 && planKey(plan) === last; tries++) plan = roll();
  if (planKey(plan) === last) {
    // Still the same (a hurried buyer has few plans): put another small thing in front.
    const b = pickBehaviour(rng, kind, ['goods', ...(plan[0] ? [plan[0]] : [])]);
    if (b) plan = [b, ...plan];
  }
  return plan;
}

/** The staff zones of a room: behind every item that is served from behind (the counter). */
export function staffZones(items: readonly FurnitureItem[], roomId: number): Rect[] {
  return items.flatMap((i) => {
    if (i.roomId !== roomId || i.onItemUid !== null) return [];
    const type = getFurnitureType(i.typeId);
    return type.servedFromBehind ? [staffZone(i, type)] : [];
  });
}

/** True if a point is in a staff zone (edges count). */
export function inStaffZone(zones: readonly Rect[], p: Point): boolean {
  return zones.some((z) => p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h);
}

const NPC_GRIDS = new WeakMap<NavGrid, { key: string; grid: NavGrid }>();

/**
 * The nav grid for customers: the room's grid with every cell that touches a staff zone blocked.
 * Cached per grid (the room's grid is rebuilt when furniture changes).
 */
export function npcGrid(grid: NavGrid, zones: readonly Rect[]): NavGrid {
  const key = zones.map((z) => `${z.x},${z.y},${z.w},${z.h}`).join(';');
  const cached = NPC_GRIDS.get(grid);
  if (cached && cached.key === key) return cached.grid;
  const blocked = grid.blocked.slice();
  for (let i = 0; i < blocked.length; i++) {
    if (blocked[i]) continue;
    const c = i % grid.cols;
    const rect = cellRect(grid, c, (i - c) / grid.cols);
    if (zones.some((z) => rectsOverlap(rect, z))) blocked[i] = true;
  }
  const out = { ...grid, blocked };
  NPC_GRIDS.set(grid, { key, grid: out });
  return out;
}

/**
 * A customer's way to a point (without the start). If the point is blocked or cannot be reached
 * (staff only, furniture), it ends at the nearest free cell they can reach: in front of a
 * decoration behind the counter, on the customer side. Empty when there is no way at all.
 */
export function npcPath(grid: NavGrid, from: Point, to: Point): Point[] {
  const direct = findPath(grid, from, to);
  if (direct) return direct.slice(1);
  const sc = cellAt(grid, from);
  const start = isCellFree(grid, sc.c, sc.r) ? sc.r * grid.cols + sc.c : nearestFreeCell(grid, from);
  if (start === null) return [];
  const reach = reachableCells(grid, start);
  const goal = nearestFreeCell(grid, to, (i) => reach[i] === true);
  if (goal === null) return [];
  const c = goal % grid.cols;
  const p = findPath(grid, from, cellCenter(grid, c, (goal - c) / grid.cols));
  return p ? p.slice(1) : [];
}

const REACH = new WeakMap<NavGrid, Map<number, number[]>>();

/** The free cells (indices) a customer can reach from a point, cached per grid and start cell. */
export function reachableFrom(grid: NavGrid, from: Point): number[] {
  const c = cellAt(grid, from);
  if (!isCellFree(grid, c.c, c.r)) return [];
  const start = c.r * grid.cols + c.c;
  let per = REACH.get(grid);
  if (!per) REACH.set(grid, (per = new Map()));
  let cells = per.get(start);
  if (!cells) {
    const reach = reachableCells(grid, start);
    cells = [];
    for (let i = 0; i < reach.length; i++) if (reach[i]) cells.push(i);
    per.set(start, cells);
  }
  return cells;
}
