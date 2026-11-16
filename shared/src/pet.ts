// The cat (step 9g-2): pure wander / sit / sleep / follow rules. The rng and the clock are passed in; the cat's place is NOT saved
// (only Player.pet = { name }). The client calls stepPet every frame and draws the cat (code-art box placeholder).

import { PET_FOLLOW_GAP, PET_FOLLOW_MS, PET_FOLLOW_SPEED, PET_NEXT, PET_PURR_MS, PET_SIT_MS, PET_SLEEP_MS, PET_SPEED, PET_WALK_MS, PET_WANDER_RADIUS } from './config.ts';
import { rngInt } from './rng.ts';
import type { Point, Rng } from './types.ts';

export type PetMode = 'sit' | 'walk' | 'sleep' | 'follow';

export interface PetBrain {
  x: number;
  y: number;
  mode: PetMode;
  /** The game clock (ms) at which the current mode ends. */
  untilMs: number;
  /** The walk target (mode 'walk'). */
  tx: number;
  ty: number;
  /** While nowMs is below this the cat purrs (the client shows a heart). */
  purrUntilMs: number;
  /** 1 faces right, -1 faces left (drawing only). */
  dir: 1 | -1;
}

export interface PetWorld {
  /** Where the player stands. */
  player: Point;
  /** The pet basket, if one is placed (the cat sleeps there). */
  basket: Point | null;
  /** True when the cat may stand on this world point (floor, not blocked). */
  free(p: Point): boolean;
}

/** The cat appears next to the basket (or the player when there is none). */
export function spawnPet(at: Point, nowMs: number): PetBrain {
  return { x: at.x, y: at.y, mode: 'sit', untilMs: nowMs + PET_SIT_MS[0], tx: at.x, ty: at.y, purrUntilMs: 0, dir: 1 };
}

const span = (rng: Rng, r: readonly [number, number]): number => rngInt(rng, r[0], r[1]);

/** The next thing the cat does after a rest. */
function pickNext(b: PetBrain, nowMs: number, rng: Rng, w: PetWorld): PetBrain {
  const roll = rng();
  if (w.basket && roll < PET_NEXT.sleep) return { ...b, mode: 'walk', tx: w.basket.x, ty: w.basket.y, untilMs: nowMs + 60_000 };
  if (roll < PET_NEXT.sleep + PET_NEXT.follow) return { ...b, mode: 'follow', untilMs: nowMs + span(rng, PET_FOLLOW_MS) };
  // Wander: a free spot within the radius (a few tries; else sit again).
  for (let k = 0; k < 6; k++) {
    const p = { x: Math.round(b.x + (rng() * 2 - 1) * PET_WANDER_RADIUS), y: Math.round(b.y + (rng() * 2 - 1) * PET_WANDER_RADIUS) };
    if (w.free(p)) return { ...b, mode: 'walk', tx: p.x, ty: p.y, untilMs: nowMs + span(rng, PET_WALK_MS) };
  }
  return { ...b, mode: 'sit', untilMs: nowMs + span(rng, PET_SIT_MS) };
}

/** Moves toward (tx, ty) by `step` px, only onto free ground. Returns the new brain and whether it arrived. */
function walk(b: PetBrain, tx: number, ty: number, step: number, w: PetWorld): { b: PetBrain; arrived: boolean } {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= step) return { b: { ...b, x: tx, y: ty }, arrived: true };
  const next = { x: b.x + (dx / dist) * step, y: b.y + (dy / dist) * step };
  if (!w.free(next)) return { b, arrived: true }; // blocked: stop here
  return { b: { ...b, x: next.x, y: next.y, dir: dx >= 0 ? 1 : -1 }, arrived: false };
}

/** One step of the cat's brain. dtMs is the frame time, nowMs the game clock. */
export function stepPet(brain: PetBrain, dtMs: number, nowMs: number, rng: Rng, w: PetWorld): PetBrain {
  const step = (dtMs / 1000) * PET_SPEED;
  switch (brain.mode) {
    case 'sit':
    case 'sleep':
      return nowMs >= brain.untilMs ? pickNext(brain, nowMs, rng, w) : brain;
    case 'walk': {
      const r = walk(brain, brain.tx, brain.ty, step, w);
      if (!r.arrived && nowMs < brain.untilMs) return r.b;
      // Arrived at the basket: sleep; anywhere else: sit.
      const atBasket = w.basket !== null && Math.hypot(r.b.x - w.basket.x, r.b.y - w.basket.y) < 4;
      return atBasket
        ? { ...r.b, mode: 'sleep', untilMs: nowMs + span(rng, PET_SLEEP_MS) }
        : { ...r.b, mode: 'sit', untilMs: nowMs + span(rng, PET_SIT_MS) };
    }
    case 'follow': {
      if (nowMs >= brain.untilMs) return { ...brain, mode: 'sit', untilMs: nowMs + span(rng, PET_SIT_MS) };
      if (Math.hypot(w.player.x - brain.x, w.player.y - brain.y) <= PET_FOLLOW_GAP) return brain;
      return walk(brain, w.player.x, w.player.y, (dtMs / 1000) * PET_FOLLOW_SPEED, w).b;
    }
  }
}

/** A tap on the cat: it wakes, sits and purrs (a heart for PET_PURR_MS). */
export function petTap(brain: PetBrain, nowMs: number, rng: Rng): PetBrain {
  return { ...brain, mode: 'sit', untilMs: nowMs + span(rng, PET_SIT_MS), purrUntilMs: nowMs + PET_PURR_MS };
}

export function isPurring(brain: PetBrain, nowMs: number): boolean {
  return nowMs < brain.purrUntilMs;
}
