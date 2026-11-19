// The lakeside's life (outdoors rework C15), pure part: where decor stands, the bird state machine, butterfly paths,
// fish shadows that flee a cast, falling leaves. No Pixi, no Date.now, no Math.random: the clock and an rng/seed are passed in.

import {
  LAKE_BIRD_FLEE_PX,
  LAKE_BIRD_RETURN_MAX_MS,
  LAKE_BIRD_RETURN_MIN_MS,
  LAKE_BIRD_SPEED,
  LAKE_BUSHES,
  LAKE_DECOR_BUSH_PX,
  LAKE_DECOR_COUNT,
  LAKE_DECOR_DOOR_PAD_PX,
  LAKE_DECOR_GAP_PX,
  LAKE_DECOR_GRASS_EDGE_PX,
  LAKE_DECOR_PIER_PX,
  LAKE_DECOR_START_PX,
  LAKE_DECOR_TREE_PX,
  LAKE_FISH_FLEE_MS,
  LAKE_FISH_FLEE_PX,
  LAKE_FISH_FLEE_SPEED,
  LAKE_FISH_SPEED,
  LAKE_LEAF_FALL_MS,
  LAKE_LEAF_FALL_PX,
  LAKE_LEAF_GAP_MS,
  LAKE_PIER,
  LAKE_TREES,
  LAKE_POND_DECOR,
  distToWater,
  isPierCell,
  isWaterCell,
  waterRects,
  terrainAt,
  LAKE_CELL,
  type Point,
  type Rect,
} from '@pixel-hotel/shared';
import { hash01 } from '../fx/shake.ts';

// ---------- Decor spots ----------

export type DecorKind = 'reeds' | 'cattail' | 'flower' | 'stone' | 'mushroom' | 'tuft' | 'lily';

export interface DecorSpot {
  kind: DecorKind;
  x: number;
  y: number;
  /** Picks the variant (petal colour, blade count, size) inside the art function. */
  variant: number;
}

export interface DecorOptions {
  /** Room size, px. */
  w: number;
  h: number;
  /** The door zone (kept free, padded) and the avatar start (kept free), when the room has them. */
  doorZone?: Rect | null;
  start?: Point | null;
}

/** Distance from a point to a rectangle (0 inside it). */
export function distToRect(p: Point, r: Rect): number {
  const dx = Math.max(r.x - p.x, 0, p.x - (r.x + r.w));
  const dy = Math.max(r.y - p.y, 0, p.y - (r.y + r.h));
  return Math.hypot(dx, dy);
}

/**
 * Decor for a seed: reeds and cattails just outside the water, lily pads inside it, flowers, stones, mushrooms and tufts on the grass.
 * Never on the pier, a tree trunk, a bush, the door zone or the avatar start; the grass kinds stay clear of the water; spots keep a gap.
 * Deterministic: the same seed and options give the same list. Positions are whole 2 px.
 */
export function decorSpots(seed: number, opts: DecorOptions): DecorSpot[] {
  const out: DecorSpot[] = [];
  const pier: Rect = LAKE_PIER;
  const door = opts.doorZone
    ? { x: opts.doorZone.x - LAKE_DECOR_DOOR_PAD_PX, y: opts.doorZone.y - LAKE_DECOR_DOOR_PAD_PX, w: opts.doorZone.w + LAKE_DECOR_DOOR_PAD_PX * 2, h: opts.doorZone.h + LAKE_DECOR_DOOR_PAD_PX * 2 }
    : null;
  const GRASS: DecorKind[] = ['flower', 'flower', 'tuft', 'tuft', 'stone', 'mushroom'];
  for (let i = 0; i < LAKE_DECOR_COUNT * 12 && out.length < LAKE_DECOR_COUNT; i++) {
    const x = 2 * Math.floor((12 + hash01(seed, i * 5) * (opts.w - 24)) / 2);
    const y = 2 * Math.floor((24 + hash01(seed, i * 5 + 1) * (opts.h - 32)) / 2);
    const p = { x, y };
    const water = distToWater(p);
    const wanted = hash01(seed, i * 5 + 2);
    // Which kind this attempt wants, and whether the place suits it.
    let kind: DecorKind;
    if (wanted < 0.22) {
      kind = wanted < 0.12 ? 'reeds' : 'cattail';
      if (water < 2 || water > 10) continue;
    } else if (wanted < 0.3) {
      kind = 'lily';
      if (!(isInsideWater(p, 14))) continue;
    } else {
      kind = GRASS[Math.floor(hash01(seed, i * 5 + 3) * GRASS.length)]!;
      if (water < LAKE_DECOR_GRASS_EDGE_PX || terrainAt(p) > 0.25) continue; // A3: grass decor stays off the sand
    }
    if (distToRect(p, pier) < LAKE_DECOR_PIER_PX) continue;
    if (LAKE_POND_DECOR.some((d) => Math.hypot(d.x - x, d.y - 12 - y) < (d.kind === 'rowboat' ? 40 : LAKE_DECOR_GAP_PX))) continue;
    if (LAKE_TREES.some((t) => Math.hypot(t.x - x, t.y - y) < LAKE_DECOR_TREE_PX)) continue;
    if (LAKE_BUSHES.some((b) => Math.hypot(b.x - x, b.y - y) < LAKE_DECOR_BUSH_PX)) continue;
    if (door && distToRect(p, door) === 0) continue;
    if (opts.start && Math.hypot(opts.start.x - x, opts.start.y - y) < LAKE_DECOR_START_PX) continue;
    if (out.some((o) => Math.hypot(o.x - x, o.y - y) < LAKE_DECOR_GAP_PX)) continue;
    out.push({ kind, x, y, variant: Math.floor(hash01(seed, i * 5 + 4) * 6) });
  }
  return out;
}

/** A3: open water at a world point (a water cell of the pond, not under the pier). */
function openWaterAt(x: number, y: number): boolean {
  const c = Math.floor(x / LAKE_CELL);
  const r = Math.floor(y / LAKE_CELL);
  return isWaterCell(c, r) && !isPierCell(c, r);
}

/** True if p is in open water with at least `inset` px of it on every side (and diagonally): lily pads float there. */
export function isInsideWater(p: Point, inset: number): boolean {
  for (const dx of [-inset, 0, inset]) for (const dy of [-inset, 0, inset]) if (!openWaterAt(p.x + dx, p.y + dy)) return false;
  return true;
}

// ---------- Birds ----------

export type BirdMode = 'perch' | 'flee' | 'away' | 'return';

export interface Bird {
  mode: BirdMode;
  x: number;
  y: number;
  /** Which perch is this bird's. */
  perch: number;
  /** In 'away': ms until it may return. */
  waitMs: number;
  /** A counter for the rng, so every wait differs. */
  rolls: number;
  /** Faces right when true. */
  right: boolean;
}

/** Where a bird can perch: the top rail of the pier at its two ends. */
export const BIRD_PERCHES: readonly Point[] = [
  { x: LAKE_PIER.x + 10, y: LAKE_PIER.y + 6 },
  { x: LAKE_PIER.x + LAKE_PIER.w - 34, y: LAKE_PIER.y + 6 },
];

/** A new bird sitting on perch `i`. */
export function newBird(i: number): Bird {
  const p = BIRD_PERCHES[i % BIRD_PERCHES.length]!;
  return { mode: 'perch', x: p.x, y: p.y, perch: i % BIRD_PERCHES.length, waitMs: 0, rolls: 0, right: i % 2 === 0 };
}

function moveToward(b: Bird, to: Point, step: number): boolean {
  const dx = to.x - b.x;
  const dy = to.y - b.y;
  const d = Math.hypot(dx, dy);
  if (d <= step) {
    b.x = to.x;
    b.y = to.y;
    return true;
  }
  b.x += (dx / d) * step;
  b.y += (dy / d) * step;
  b.right = dx >= 0;
  return false;
}

/**
 * One step of a bird. perch -> flee (the avatar came within LAKE_BIRD_FLEE_PX) -> away (off the room, waits a while; only counts down
 * while the avatar is not near the perch) -> return (flies back in) -> perch. `rng` gives 0..1; `bounds` is the room size.
 * Returns a new bird; the input is not changed.
 */
export function stepBird(b0: Bird, dtMs: number, avatar: Point | null, rng: () => number, bounds: { w: number; h: number }): Bird {
  const b: Bird = { ...b0 };
  const perch = BIRD_PERCHES[b.perch]!;
  const near = avatar !== null && Math.hypot(avatar.x - perch.x, avatar.y - perch.y) < LAKE_BIRD_FLEE_PX;
  const step = (LAKE_BIRD_SPEED * dtMs) / 1000;
  switch (b.mode) {
    case 'perch':
      if (near) b.mode = 'flee';
      break;
    case 'flee': {
      // Up and away from the avatar, off the top or the side of the room.
      const away = avatar && avatar.x > b.x ? -1 : 1;
      const exit: Point = { x: away > 0 ? bounds.w + 24 : -24, y: -24 };
      if (moveToward(b, exit, step)) {
        b.mode = 'away';
        b.rolls++;
        b.waitMs = LAKE_BIRD_RETURN_MIN_MS + rng() * (LAKE_BIRD_RETURN_MAX_MS - LAKE_BIRD_RETURN_MIN_MS);
      }
      break;
    }
    case 'away':
      if (!near) b.waitMs -= dtMs;
      if (b.waitMs <= 0) {
        b.mode = 'return';
        b.x = rng() < 0.5 ? -24 : bounds.w + 24;
        b.y = -24;
      }
      break;
    case 'return':
      if (near) {
        // Someone is on the pier again: turn around and go.
        b.mode = 'flee';
      } else if (moveToward(b, perch, step)) b.mode = 'perch';
      break;
  }
  return b;
}

/** The wing pose to draw for a bird at a clock time: 'perch' while perched, else the two flight poses alternating every 120 ms. */
export function birdPose(b: Bird, clockMs: number): 'perch' | 'fly1' | 'fly2' {
  if (b.mode === 'perch') return 'perch';
  return Math.floor(clockMs / 120) % 2 === 0 ? 'fly1' : 'fly2';
}

/** Away birds are not drawn. */
export function birdVisible(b: Bird): boolean {
  return b.mode !== 'away';
}

// ---------- Butterflies ----------

/** Butterfly `i` flutters around a home point on a slow loop; whole px, a pure function of the clock. */
export function butterflyAt(i: number, clockMs: number, home: Point): Point & { frame: number } {
  const t = clockMs / 1000;
  const a = 0.5 + hash01(i, 1) * 0.5;
  const b = 0.7 + hash01(i, 2) * 0.6;
  const ph = hash01(i, 3) * Math.PI * 2;
  const x = home.x + Math.sin(t * a + ph) * 26 + Math.sin(t * 2.3 + ph) * 3;
  const y = home.y - 14 + Math.cos(t * b + ph * 2) * 14;
  return { x: Math.round(x), y: Math.round(y), frame: Math.floor(clockMs / 140 + i) % 2 };
}

// ---------- Fish shadows ----------

export interface FishShadow {
  /** Which FISH_WATER rect it lives in. */
  rect: number;
  x: number;
  y: number;
  /** Heading: -1 left, 1 right. */
  dir: number;
  size: number;
  fleeMs: number;
  /** Where it flees to along y (px per s), while scared. */
  vy: number;
}

/** A3: the open water rows the fish shadows swim in: runs of 3 or more water cells, not the pier's row. */
export const FISH_WATER: readonly Rect[] = waterRects().filter((r) => r.w >= 3 * LAKE_CELL && (r.y >= LAKE_PIER.y + LAKE_PIER.h || r.y + r.h <= LAKE_PIER.y));

/** Fish shadow `i`: placed inside a water row (never near its ends) by hash. */
export function newFishShadow(i: number): FishShadow {
  const rect = i % FISH_WATER.length;
  const r = FISH_WATER[rect]!;
  return {
    rect,
    x: Math.round(r.x + 20 + hash01(i, 11) * (r.w - 40)),
    y: Math.round(r.y + 14 + hash01(i, 12) * Math.max(0, r.h - 28)),
    dir: hash01(i, 13) > 0.5 ? 1 : -1,
    size: i % 3,
    fleeMs: 0,
    vy: 0,
  };
}

/** Scares the shadows within LAKE_FISH_FLEE_PX of a cast: they dart away from it for LAKE_FISH_FLEE_MS. Returns new shadows. */
export function scareFish(fish: readonly FishShadow[], at: Point): FishShadow[] {
  return fish.map((f) => {
    const dx = f.x - at.x;
    const dy = f.y - at.y;
    const d = Math.hypot(dx, dy);
    if (d >= LAKE_FISH_FLEE_PX) return f;
    return { ...f, dir: dx >= 0 ? 1 : -1, fleeMs: LAKE_FISH_FLEE_MS, vy: d < 1 ? 0 : (dy / d) * LAKE_FISH_FLEE_SPEED * 0.4 };
  });
}

/** One step of a fish shadow: drifts along x, turns at the edge of its water rect (14 px in), darts when scared. Stays in its rect. */
export function stepFish(f0: FishShadow, dtMs: number): FishShadow {
  const f = { ...f0 };
  const r = FISH_WATER[f.rect]!;
  const speed = f.fleeMs > 0 ? LAKE_FISH_FLEE_SPEED : LAKE_FISH_SPEED;
  f.x += (f.dir * speed * dtMs) / 1000;
  if (f.fleeMs > 0) {
    f.y += (f.vy * dtMs) / 1000;
    f.fleeMs = Math.max(0, f.fleeMs - dtMs);
    if (f.fleeMs === 0) f.vy = 0;
  }
  const minX = r.x + 14;
  const maxX = r.x + r.w - 14;
  if (f.x < minX) {
    f.x = minX;
    f.dir = 1;
  } else if (f.x > maxX) {
    f.x = maxX;
    f.dir = -1;
  }
  f.y = Math.max(r.y + 8, Math.min(r.y + r.h - 8, f.y));
  return f;
}

// ---------- Falling leaves ----------

/**
 * Leaf `j` at a clock time: falls from the crown of one of the standing trees (`trees`, anchors), drifting sideways and tumbling,
 * then waits for a while. Null while it waits or when no tree stands. A pure function of j and the clock (no state to keep).
 */
export function leafAt(j: number, clockMs: number, trees: readonly Point[]): { x: number; y: number; turn: number; kind: number; alpha: number } | null {
  if (trees.length === 0) return null;
  const cycle = LAKE_LEAF_FALL_MS + LAKE_LEAF_GAP_MS * (0.5 + hash01(j, 1));
  const shift = hash01(j, 2) * cycle;
  const t = clockMs + shift;
  const n = Math.floor(t / cycle);
  const age = t - n * cycle;
  if (age >= LAKE_LEAF_FALL_MS) return null;
  const tree = trees[Math.floor(hash01(j * 31 + n, 3) * trees.length)]!;
  const k = age / LAKE_LEAF_FALL_MS;
  const x = tree.x + (hash01(j * 31 + n, 4) - 0.5) * 30 + Math.sin(k * 6 + j) * 8 + k * 6;
  const y = tree.y - 56 + k * LAKE_LEAF_FALL_PX;
  return { x: Math.round(x), y: Math.round(y), turn: Math.floor(age / 220) % 4, kind: j % 3, alpha: k > 0.85 ? (1 - k) / 0.15 : 1 };
}
