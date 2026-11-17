// Hold to repeat (step BG5b): a pure helper. The client only feeds pointer events into it:
// press -> holdStart, every frame -> holdTick, release / pan / second finger -> holdStop.
// Time is passed in (no Date.now here). Used for blocks, plants, rocks and trees; NOT for the
// dungeon fight (one hit per tap) and NOT for fishing.

import { TAP_MAX_MOVE_PX, TAP_MAX_MS } from './config.ts';

export interface HoldState {
  active: boolean;
  /** When the last hit happened (ms on the caller's clock); null = none yet, so the first tick hits. */
  lastHitAt: number | null;
}

export const HOLD_IDLE: HoldState = { active: false, lastHitAt: null };

/** A press went down on something that can be hit: the first hit comes on the very next tick. */
export function holdStart(): HoldState {
  return { active: true, lastHitAt: null };
}

/** The press ended, panned or was cancelled. */
export function holdStop(): HoldState {
  return HOLD_IDLE;
}

/** The pointer moved this far (screen px) from where it went down: past the tap limit it is a pan, so the hold stops. */
export function holdMoved(state: HoldState, distancePx: number): HoldState {
  return distancePx >= TAP_MAX_MOVE_PX ? holdStop() : state;
}

/**
 * One frame. Hits when the hold is active and the cooldown has passed since the last hit (the first
 * tick after holdStart always hits). At most ONE hit per call, however long the frame was, and the
 * next hit is always a full cooldown after this one (never earlier, so the API's own cooldown never
 * refuses it).
 */
export function holdTick(state: HoldState, nowMs: number, cooldownMs: number): { state: HoldState; hit: boolean } {
  if (!state.active) return { state, hit: false };
  if (state.lastHitAt !== null && nowMs - state.lastHitAt < cooldownMs) return { state, hit: false };
  return { state: { active: true, lastHitAt: nowMs }, hit: true };
}

/**
 * OA-1: hold to walk starts AT ONCE on a press on free floor (no wait). What a press that is already walking does next:
 * 'walk' = still (under the tap move limit): keep walking; 'steer' = moved after the tap time (a hold): the walk follows the pointer, nothing pans;
 * 'pan' = moved within the tap time (a quick drag): in a room it pans, so the early walk is cancelled.
 */
export function earlyWalkNext(heldMs: number, movedPx: number): 'walk' | 'steer' | 'pan' {
  if (movedPx < TAP_MAX_MOVE_PX) return 'walk';
  return heldMs >= TAP_MAX_MS ? 'steer' : 'pan';
}

/**
 * The cells a pointer passed over between two cells (both included, from a to b, one step per cell,
 * 4-connected so a fast drag leaves no gaps in a line of blocks).
 */
export function cellsBetween(a: { c: number; r: number }, b: { c: number; r: number }): { c: number; r: number }[] {
  const out = [{ c: a.c, r: a.r }];
  let { c, r } = a;
  while (c !== b.c || r !== b.r) {
    const dc = Math.abs(b.c - c);
    const dr = Math.abs(b.r - r);
    // Step along the longer axis first so the line stays straight-ish.
    if (dc >= dr) c += Math.sign(b.c - c);
    else r += Math.sign(b.r - r);
    out.push({ c, r });
  }
  return out;
}

/**
 * Hold to walk / steering (dungeon): the walk is re-pathed only when the pointer moves to another cell.
 * Returns the new cell key when it changed (or on the first call, prev = null), else null.
 */
export function steerCellChange(prev: string | null, p: { x: number; y: number }, cellPx: number): string | null {
  const key = `${Math.floor(p.x / cellPx)},${Math.floor(p.y / cellPx)}`;
  return key === prev ? null : key;
}
