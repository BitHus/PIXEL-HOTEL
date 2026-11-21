// Ground drops (OB-8, docs/PLAN-OB-REWORK.md section 2): loot that pops out of a broken block, a kill or a chest on a
// short arc, lies still, and flies to the avatar once it is close (the magnet), after a short delay so the pop is seen.
// On contact it goes into the bag through the caller's `take` (the run bag or the ledger: nothing in the economy changes,
// only the route). Pure: no Math.random and no clock. The landing spot comes from a hash of the drop id (not from the
// run's rng), so spawning drops never shifts a seeded run's later rolls (parity: the same totals as before).

import {
  DROP_CAP_PER_ROOM,
  DROP_MAGNET_ACCEL,
  DROP_MAGNET_CURVE,
  DROP_MAGNET_FAST_PX,
  DROP_MAGNET_MAX_SPEED,
  DROP_MAGNET_PX,
  DROP_MAGNET_SPEED,
  DROP_PICKUP_DELAY_MS,
  DROP_POP_HEIGHT_PX,
  DROP_POP_MS,
  DROP_SCATTER_MAX_PX,
  DROP_SCATTER_MIN_PX,
  DROP_TOUCH_PX,
} from './config.ts';
import { rankOf } from './ranks.ts';
import type { Point, Rank } from './types.ts';

/** 'pop' = flying out on the arc, 'rest' = lying still, 'magnet' = flying to the avatar. */
export type DropState = 'pop' | 'rest' | 'magnet';

export interface Drop {
  id: number;
  /** 'gold', 'gem', a material id or a furniture type id (as in Loot). */
  item: string;
  qty: number;
  rank: Rank;
  /** Ground position (world px; during the pop the arc height is popHeight, not part of y). */
  x: number;
  y: number;
  /** px/s: the pop velocity, then the magnet velocity. */
  vx: number;
  vy: number;
  ageMs: number;
  state: DropState;
  /** True once the bag could not take it; it stops flying and waits until walked over again. */
  full?: boolean;
  /** Filler (stone, dirt): never counts as lost; a sweep that cannot fit it just leaves it. */
  soft?: boolean;
}

/** What spawns a drop: an item, a count and (optionally) a rolled rank; missing = the item's own rank. */
export interface DropItem {
  item: string;
  qty: number;
  rank?: Rank;
}

export interface DropsStep {
  drops: Drop[];
  /** Taken into the bag this step (each drop once, in list order). */
  picked: Drop[];
  /** Became `full` this step (for a "Bag full" toast, once per drop). */
  full: Drop[];
}

/** Gold and gems fly from farther, faster and on a curve. */
export function fastMagnet(item: string): boolean {
  return item === 'gold' || item === 'gem';
}

/** A small integer hash (deterministic, no rng). */
function hash(n: number): number {
  let h = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 0x100000000;
}

/**
 * The pop velocity of drop i of n (px/s): n drops spread evenly round a circle with a small turn per id, each landing
 * DROP_SCATTER_MIN_PX..MAX_PX from the source after DROP_POP_MS. The same id, i and n always give the same arc.
 */
export function scatterArc(id: number, i: number, n: number): { vx: number; vy: number } {
  const turn = hash(id) * Math.PI * 2;
  const angle = turn + ((i + 0.5) / Math.max(1, n)) * Math.PI * 2;
  const dist = DROP_SCATTER_MIN_PX + hash(id * 31 + 7) * (DROP_SCATTER_MAX_PX - DROP_SCATTER_MIN_PX);
  const speed = (dist * 1000) / DROP_POP_MS;
  return { vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed };
}

/** The drop's height above the ground (display px): a parabola during the pop, 0 after. */
export function popHeight(d: Pick<Drop, 'state' | 'ageMs'>): number {
  if (d.state !== 'pop') return 0;
  const k = Math.min(1, Math.max(0, d.ageMs / DROP_POP_MS));
  return 4 * DROP_POP_HEIGHT_PX * k * (1 - k);
}

/** The next free drop id: above every drop in the list and above `base`. */
export function nextDropId(drops: readonly Drop[], base = 0): number {
  return drops.reduce((m, d) => Math.max(m, d.id), base) + 1;
}

/**
 * New drops at a point, ids from `firstId` up. Items with qty under 1 are skipped. At most `room` drops are made
 * (DROP_CAP_PER_ROOM minus what lies there); the rest comes back in `overflow` for the caller to put in the bag at once.
 */
export function spawnDrops(at: Point, items: readonly DropItem[], firstId: number, room = DROP_CAP_PER_ROOM): { drops: Drop[]; overflow: DropItem[] } {
  const real = items.filter((l) => l.qty >= 1);
  const n = Math.min(real.length, Math.max(0, room));
  const drops: Drop[] = [];
  for (let i = 0; i < n; i++) {
    const l = real[i]!;
    const id = firstId + i;
    const v = scatterArc(id, i, n);
    drops.push({ id, item: l.item, qty: l.qty, rank: l.rank ?? rankOf(l.item), x: at.x, y: at.y, vx: v.vx, vy: v.vy, ageMs: 0, state: 'pop' });
  }
  return { drops, overflow: real.slice(n) };
}

/** True when the avatar pulls this drop now (after the delay, inside its radius, not waiting as full). */
export function inMagnet(d: Drop, avatar: Point): boolean {
  if (d.full || d.state === 'pop' || d.ageMs < DROP_PICKUP_DELAY_MS) return false;
  if (d.state === 'magnet') return true;
  return Math.hypot(avatar.x - d.x, avatar.y - d.y) <= (fastMagnet(d.item) ? DROP_MAGNET_FAST_PX : DROP_MAGNET_PX);
}

/**
 * Moves a magnet drop toward the avatar for dtMs: it speeds up to DROP_MAGNET_MAX_SPEED and never overshoots (a step
 * longer than the distance lands on the avatar). Gold and gems curve in (sideways at first, straight near the end).
 */
export function magnetStep(d: Drop, avatar: Point, dtMs: number): Drop {
  const dt = dtMs / 1000;
  const dx = avatar.x - d.x;
  const dy = avatar.y - d.y;
  const dist = Math.hypot(dx, dy);
  const was = Math.hypot(d.vx, d.vy);
  const speed = Math.min(DROP_MAGNET_MAX_SPEED, d.state === 'magnet' ? Math.max(DROP_MAGNET_SPEED, was) + DROP_MAGNET_ACCEL * dt : DROP_MAGNET_SPEED);
  const move = speed * dt;
  if (dist <= move || dist === 0) return { ...d, x: avatar.x, y: avatar.y, vx: 0, vy: 0, state: 'magnet', ageMs: d.ageMs + dtMs };
  const ux = dx / dist;
  const uy = dy / dist;
  const side = fastMagnet(d.item) ? DROP_MAGNET_CURVE * Math.min(1, dist / DROP_MAGNET_FAST_PX) : 0;
  // The sideways part turns the path; the step along the line to the avatar keeps its full length, so it always arrives.
  const sx = -uy * side;
  const sy = ux * side;
  return { ...d, x: d.x + (ux + sx) * move, y: d.y + (uy + sy) * move, vx: (ux + sx) * speed, vy: (uy + sy) * speed, state: 'magnet', ageMs: d.ageMs + dtMs };
}

/**
 * One step of every drop: pops land, drops in reach fly in, and a drop within DROP_TOUCH_PX is offered to `take`
 * (true = it went into the bag; the drop is gone). A drop the bag refuses lies still and is marked full (reported once in
 * `full`); walking onto it later offers it again. Each drop is picked at most once.
 */
export function stepDrops(drops: readonly Drop[], avatar: Point, dtMs: number, take: (d: Drop) => boolean): DropsStep {
  const out: Drop[] = [];
  const picked: Drop[] = [];
  const full: Drop[] = [];
  for (const d0 of drops) {
    let d: Drop;
    if (d0.state === 'pop') {
      const fly = Math.min(dtMs, Math.max(0, DROP_POP_MS - d0.ageMs));
      const x = d0.x + (d0.vx * fly) / 1000;
      const y = d0.y + (d0.vy * fly) / 1000;
      const ageMs = d0.ageMs + dtMs;
      d = ageMs >= DROP_POP_MS ? { ...d0, x, y, vx: 0, vy: 0, ageMs, state: 'rest' } : { ...d0, x, y, ageMs };
    } else if (inMagnet(d0, avatar)) {
      d = magnetStep(d0, avatar, dtMs);
    } else {
      d = { ...d0, ageMs: d0.ageMs + dtMs };
    }
    const touching = d.state !== 'pop' && d.ageMs >= DROP_PICKUP_DELAY_MS && Math.hypot(avatar.x - d.x, avatar.y - d.y) <= DROP_TOUCH_PX;
    if (touching) {
      if (take(d)) {
        picked.push(d);
        continue;
      }
      if (!d.full) full.push(d);
      d = { ...d, vx: 0, vy: 0, state: 'rest', full: true };
    }
    out.push(d);
  }
  return { drops: out, picked, full };
}

/** The drops as loot (an exit sweep or a death puts them in a bag). */
export function dropsLoot(drops: readonly Drop[]): (DropItem & { rank: Rank })[] {
  return drops.map((d) => ({ item: d.item, qty: d.qty, rank: d.rank }));
}
