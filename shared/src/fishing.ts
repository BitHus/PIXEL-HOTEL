// Fishing on the lakeside (brief section 10d, step 9f). A session is advanced by one pure function,
// step(session, inputs, dtMs, rng), in fixed FISH_TICK_MS ticks (like the dungeon), so it is
// deterministic and the server can run the same code later.
//
//   cast -> 'wait': the bobber floats 2 to 8 s (rng), then it dips and a "!" shows
//   -> 'bite': the "!" stays for the rank's window (700 ms for common, shorter for rarer fish): tap in time to hook
//   -> 'reel': a bar with a fish swimming back and forth and a green catch box (like Stardew
//      Valley's): holding (or tapping) pushes the box right, it falls back left by itself; keep the
//      box on the fish to fill the catch bar, lose the fish and it drains
//   -> 'done' (outcome 'caught' | 'escaped' | 'missed' | 'cancelled').
//
// The catch (a fish or a fished-up thing) is rolled when the line is cast: its rank sets the
// strength (config FISH_BITE_MS, FISH_REEL), RANK_WEIGHTS the odds, and a better rod shifts the odds
// and gives a bigger catch box that falls slower (gear.ts RodType). Missing loses nothing. A
// caught fish goes into the bag through the ledger (reason 'fish'), and its size into
// Player.biggest if it is a record.

import {
  FISH_BAR,
  FISH_BITE_MS,
  FISH_BOX_BASE,
  FISH_BOX_BOUNCE,
  FISH_BOX_DRAG,
  FISH_BOX_MAX_SPEED,
  FISH_GRAVITY,
  FISH_REEL,
  FISH_REEL_FULL,
  FISH_REEL_MAX_MS,
  FISH_REEL_START,
  FISH_TAP_KICK,
  FISH_THRUST,
  FISH_TICK_MS,
  FISH_WAIT_MAX_MS,
  FISH_WAIT_MIN_MS,
} from './config.ts';
import { CATCH_TYPES, getCatchType, type CatchType } from './fish.ts';
import type { GameState } from './gameState.ts';
import { ownedRod } from './gear.ts';
import { applyChange } from './ledger.ts';
import { gemDrop } from './gems.ts';
import { RANKS, rollRank } from './ranks.ts';
import { rngInt } from './rng.ts';
import type { MaterialId, Rank, Rng } from './types.ts';

export type FishPhase = 'wait' | 'bite' | 'reel' | 'done';
export type FishOutcome = 'caught' | 'escaped' | 'missed' | 'cancelled';

export type FishEvent =
  /** The bobber dipped: the "!" shows. */
  | { t: 'bite' }
  /** Hooked in time: the reel starts. */
  | { t: 'hooked' }
  | { t: 'caught'; id: string; rank: Rank; cm: number | null }
  | { t: 'escaped' }
  | { t: 'missed' }
  | { t: 'cancelled' };

export interface FishSession {
  phase: FishPhase;
  outcome: FishOutcome | null;
  /** What is on the line (rolled at the cast; the player only sees it when it is caught). */
  catchId: string;
  rank: Rank;
  /** The size in cm (fish only; null for a thing). */
  cm: number | null;
  /** 'wait': ms until the bite. */
  waitMs: number;
  /** 'bite': ms left to tap. */
  biteMs: number;
  // ---- the reel (positions in bar units, 0 to FISH_BAR) ----
  /** The catch bar, 0 to FISH_REEL_FULL. */
  fill: number;
  /** Where the fish is, where it swims to, ms until it picks a new direction, and 1 or 2.4 (a dart). */
  fishPos: number;
  fishTarget: number;
  fishTurnMs: number;
  fishSpeedMul: number;
  /** The catch box: its middle, its speed, its width and how hard it falls (from the rod), and whether it is held. */
  boxPos: number;
  boxVel: number;
  boxSize: number;
  gravityScale: number;
  held: boolean;
  /** ms in the reel (a reel over FISH_REEL_MAX_MS is lost). */
  reelMs: number;
  timeMs: number;
  /** The rest of a tick that did not fit yet (like DungeonRun.carryMs). */
  carryMs: number;
  events: FishEvent[];
}

/** press / release: the hold (a button, the bar, Space); tap: one kick to the right (and hooks at the bite). */
export type FishInput = { t: 'tap' } | { t: 'press' } | { t: 'release' } | { t: 'cancel' };

/** The catches of a rank, for rolling (fish weigh 3, things 1; see fish.json). */
export function catchesOfRank(rank: Rank): CatchType[] {
  return CATCH_TYPES.filter((c) => c.rank === rank);
}

/** Rolls what bites: a rank by RANK_WEIGHTS times the rod's multiplier, then one catch of that rank by weight. */
export function rollCatch(rng: Rng, multiplier: Partial<Record<Rank, number>> = {}): { type: CatchType; rank: Rank } {
  const rank = rollRank(rng, multiplier, RANKS.filter((r) => catchesOfRank(r).length > 0));
  const options = catchesOfRank(rank);
  const total = options.reduce((a, c) => a + c.weight, 0);
  let r = rng() * total;
  let pick = options[options.length - 1]!;
  for (const c of options) {
    if (r < c.weight) {
      pick = c;
      break;
    }
    r -= c.weight;
  }
  return { type: pick, rank };
}

/** A new session: the line is cast. The rod comes from the player's gear (`gear`). */
export function newFishSession(rng: Rng, gear: readonly string[] = []): FishSession {
  const rod = ownedRod(gear as never);
  const { type, rank } = rollCatch(rng, rod?.rankMultiplier ?? {});
  const cm = type.kind === 'fish' ? rngInt(rng, type.minCm ?? 10, type.maxCm ?? 30) : null;
  const boxSize = FISH_BOX_BASE + (rod?.boxBonus ?? 0);
  return {
    phase: 'wait',
    outcome: null,
    catchId: type.id,
    rank,
    cm,
    waitMs: rngInt(rng, FISH_WAIT_MIN_MS, FISH_WAIT_MAX_MS),
    biteMs: 0,
    fill: 0,
    fishPos: FISH_BAR / 2,
    fishTarget: FISH_BAR / 2,
    fishTurnMs: 0,
    fishSpeedMul: 1,
    boxPos: boxSize / 2,
    boxVel: 0,
    boxSize,
    gravityScale: rod?.gravityScale ?? 1,
    held: false,
    reelMs: 0,
    timeMs: 0,
    carryMs: 0,
    events: [],
  };
}

function cloneSession(s: FishSession): FishSession {
  return { ...s, events: [] };
}

function finish(s: FishSession, outcome: FishOutcome, event: FishEvent): void {
  s.phase = 'done';
  s.outcome = outcome;
  s.events.push(event);
}

/** The fish is hooked: the reel starts with the fish in the middle and the box at the left. */
function hook(s: FishSession): void {
  s.phase = 'reel';
  s.fill = FISH_REEL_START;
  s.fishPos = FISH_BAR * 0.6;
  s.fishTarget = s.fishPos;
  s.fishTurnMs = 600;
  s.fishSpeedMul = 1;
  s.boxPos = s.boxSize / 2;
  s.boxVel = 0;
  s.reelMs = 0;
  s.events.push({ t: 'hooked' });
}

function applyInput(s: FishSession, input: FishInput): void {
  if (s.phase === 'done') return;
  if (input.t === 'cancel') {
    finish(s, 'cancelled', { t: 'cancelled' });
    return;
  }
  if (input.t === 'release') {
    s.held = false;
    return;
  }
  // A press or a tap: in the bite it hooks the fish; in the reel it pushes the box right.
  if (s.phase === 'bite') {
    hook(s);
    if (input.t === 'press') s.held = true;
  } else if (s.phase === 'reel') {
    if (input.t === 'press') s.held = true;
    else s.boxVel = Math.min(FISH_BOX_MAX_SPEED, s.boxVel + FISH_TAP_KICK);
  } else if (input.t === 'press') {
    // While the bobber floats a hold does nothing (but it is remembered, like a held finger).
    s.held = true;
  }
}

/** The half width of the box and the room it moves in. */
const lo = (s: FishSession): number => s.boxSize / 2;
const hi = (s: FishSession): number => FISH_BAR - s.boxSize / 2;

function swim(s: FishSession, rng: Rng, dtS: number): void {
  const r = FISH_REEL[s.rank];
  s.fishTurnMs -= FISH_TICK_MS;
  if (s.fishTurnMs <= 0 || Math.abs(s.fishTarget - s.fishPos) < 1) {
    // A new direction: anywhere in the bar (the far ends are a little rare), sometimes a sudden dart.
    s.fishTarget = 6 + rng() * (FISH_BAR - 12);
    s.fishTurnMs = rngInt(rng, r.turnMin, r.turnMax);
    s.fishSpeedMul = rng() < r.dart ? 2.4 : 1;
  }
  const step = r.speed * s.fishSpeedMul * dtS;
  const d = s.fishTarget - s.fishPos;
  s.fishPos += Math.abs(d) <= step ? d : Math.sign(d) * step;
}

function moveBox(s: FishSession, dtS: number): void {
  // Holding pushes right, gravity pulls left, the box slows down by itself.
  let a = -FISH_GRAVITY * s.gravityScale;
  if (s.held) a += FISH_THRUST;
  s.boxVel += a * dtS;
  s.boxVel *= Math.max(0, 1 - FISH_BOX_DRAG * dtS);
  s.boxVel = Math.max(-FISH_BOX_MAX_SPEED, Math.min(FISH_BOX_MAX_SPEED, s.boxVel));
  s.boxPos += s.boxVel * dtS;
  if (s.boxPos < lo(s)) {
    s.boxPos = lo(s);
    s.boxVel = Math.abs(s.boxVel) * FISH_BOX_BOUNCE;
  } else if (s.boxPos > hi(s)) {
    s.boxPos = hi(s);
    s.boxVel = -Math.abs(s.boxVel) * FISH_BOX_BOUNCE;
  }
}

/** True while the fish is inside the catch box. */
export function fishInBox(s: Pick<FishSession, 'fishPos' | 'boxPos' | 'boxSize'>): boolean {
  return Math.abs(s.fishPos - s.boxPos) <= s.boxSize / 2;
}

function tick(s: FishSession, rng: Rng): void {
  s.timeMs += FISH_TICK_MS;
  const dtS = FISH_TICK_MS / 1000;
  if (s.phase === 'wait') {
    s.waitMs -= FISH_TICK_MS;
    if (s.waitMs <= 0) {
      s.phase = 'bite';
      s.biteMs = FISH_BITE_MS[s.rank];
      s.events.push({ t: 'bite' });
    }
  } else if (s.phase === 'bite') {
    s.biteMs -= FISH_TICK_MS;
    if (s.biteMs <= 0) finish(s, 'missed', { t: 'missed' });
  } else if (s.phase === 'reel') {
    s.reelMs += FISH_TICK_MS;
    swim(s, rng, dtS);
    moveBox(s, dtS);
    const r = FISH_REEL[s.rank];
    s.fill += (fishInBox(s) ? r.gain : -r.drain) * dtS;
    if (s.fill >= FISH_REEL_FULL) {
      s.fill = FISH_REEL_FULL;
      finish(s, 'caught', { t: 'caught', id: s.catchId, rank: s.rank, cm: s.cm });
    } else if (s.fill <= 0) {
      s.fill = 0;
      finish(s, 'escaped', { t: 'escaped' });
    } else if (s.reelMs >= FISH_REEL_MAX_MS) {
      finish(s, 'escaped', { t: 'escaped' });
    }
  }
}

/**
 * Advances a session: the inputs first (at the exact time), then whole FISH_TICK_MS ticks; the
 * rest of the time waits in carryMs. Returns a new session (the old one is untouched) with this
 * call's events.
 */
export function step(session: FishSession, inputs: readonly FishInput[], dtMs: number, rng: Rng): FishSession {
  const s = cloneSession(session);
  for (const input of inputs) applyInput(s, input);
  if (fishDone(s)) {
    s.carryMs = 0;
    return s;
  }
  let left = s.carryMs + Math.max(0, dtMs);
  while (left >= FISH_TICK_MS && !fishDone(s)) {
    tick(s, rng);
    left -= FISH_TICK_MS;
  }
  s.carryMs = fishDone(s) ? 0 : left;
  return s;
}

/** The name outside this file (the dungeon has its own step). */
export const fishStep = step;

/** True once the session has ended. */
export function fishDone(s: FishSession): boolean {
  return s.phase === 'done';
}

/**
 * Banks a caught fish or thing: it goes into the bag through the ledger (reason 'fish'), and the
 * size goes into Player.biggest when it is a record. Null unless the session ended with a catch.
 */
export function bankCatch(state: GameState, s: FishSession, at: number, rng: Rng): GameState | null {
  if (s.outcome !== 'caught') return null;
  const type = getCatchType(s.catchId);
  // Gems (step BG4): by the rank of the catch.
  const gems = gemDrop('fish', s.rank, rng);
  const next = applyChange(state, { reason: 'fish', materials: { [type.id]: 1 } as Partial<Record<MaterialId, number>>, ...(gems > 0 ? { gems } : {}), note: `caught ${type.id}${s.cm ? ` ${s.cm} cm` : ''}` }, at);
  if (!next) return null;
  const biggest = { ...next.player.biggest };
  if (s.cm !== null && s.cm > (biggest[type.id] ?? 0)) biggest[type.id] = s.cm;
  return { ...next, player: { ...next.player, biggest } };
}
