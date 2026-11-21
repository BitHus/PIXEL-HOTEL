// FISH-2: a bot that plays the reel, to measure the win rate by rank, rod and skills (tests and
// tools/simulate-fishing.ts). Pure: seeded rng only. The bot looks at the bar every `everyMs` (its
// reaction time) and holds the box while the box (aimed `lead` seconds ahead) is left of the fish.

import { FISH_BITE_MS, FISH_TICK_MS } from './config.ts';
import { catchesOfRank, fishDone, fishPowerOf, newFishSession, step, type FishInput, type FishSession } from './fishing.ts';
import { seededRng } from './rng.ts';
import type { Bonuses } from './stats.ts';
import type { Rank } from './types.ts';
import { rngInt } from './rng.ts';

export interface FishBot {
  everyMs: number;
  lead: number;
}

/** Three players: casual (looks every 0.4 s), average (0.25 s, aims a little ahead), sharp (0.1 s). */
export const FISH_BOTS = {
  casual: { everyMs: 400, lead: 0 },
  average: { everyMs: 250, lead: 0.1 },
  sharp: { everyMs: 100, lead: 0.15 },
} as const satisfies Record<string, FishBot>;

/** The fishing branch maxed (skills.json: Wide box 3, Reel master 2, Sharp eye 2). */
export const FISH_SKILLS_MAX: Bonuses = { boxSizePct: 12, tensionRisePct: -16, strikeWindowMs: 120 };

/** A hooked-at-the-bite session of a fixed rank: a fish of that rank with a size rolled in its range. */
export function botSession(rank: Rank, seed: number, gear: readonly string[] = [], skill?: Bonuses): FishSession {
  const rng = seededRng(seed);
  const base = newFishSession(rng, gear, skill);
  const fish = catchesOfRank(rank).filter((c) => c.kind === 'fish');
  const type = fish[seed % fish.length]!;
  const cm = rngInt(rng, type.minCm ?? 10, type.maxCm ?? 30);
  return { ...base, rank, catchId: type.id, cm, fishPower: fishPowerOf(type, cm), phase: 'bite', biteMs: FISH_BITE_MS[rank] };
}

/** Plays one session to the end (taps at the bite, then reels). */
export function botPlay(start: FishSession, bot: FishBot, rngSeed: number, maxMs = 70_000): FishSession {
  const rng = seededRng(rngSeed);
  let s = start;
  let since = 0;
  let held = false;
  let first = true;
  for (let t = 0; t < maxMs && !fishDone(s); t += FISH_TICK_MS) {
    const inputs: FishInput[] = [];
    if (first && s.phase === 'bite') {
      inputs.push({ t: 'tap' });
      first = false;
    }
    since += FISH_TICK_MS;
    if (s.phase === 'reel' && since >= bot.everyMs) {
      since = 0;
      const want = s.boxPos + s.boxVel * bot.lead < s.fishPos;
      if (want !== held) {
        held = want;
        inputs.push({ t: want ? 'press' : 'release' });
      }
    }
    s = step(s, inputs, FISH_TICK_MS, rng);
  }
  return s;
}

/** The share of `n` hooked fish of a rank that the bot lands with this gear and these skills. */
export function botWinRate(rank: Rank, bot: FishBot, gear: readonly string[] = [], skill?: Bonuses, n = 80): number {
  let caught = 0;
  for (let seed = 1; seed <= n; seed++) if (botPlay(botSession(rank, seed, gear, skill), bot, seed * 7 + 3).outcome === 'caught') caught++;
  return caught / n;
}

/** J10: the share of n casts a player HOOKS who taps reactionMs after the bobber goes under (+- jitterMs, seeded), or, with
 *  tapEveryMs, a player who just taps fast from the cast on (always early: fast tapping never hooks). Real step, real waits and nibbles. */
export function botHookRate(rank: Rank, reactionMs: number, opts: { jitterMs?: number; tapEveryMs?: number; skill?: Bonuses; n?: number } = {}): number {
  const n = opts.n ?? 200;
  let hooked = 0;
  for (let seed = 1; seed <= n; seed++) {
    const rng = seededRng(seed * 13 + 5);
    let s: FishSession = { ...newFishSession(rng, [], opts.skill), rank };
    const jitter = opts.jitterMs ?? 0;
    const react = Math.max(0, reactionMs + Math.round((rng() * 2 - 1) * jitter));
    let underFor = -1;
    for (let t = 0; t < 20_000 && s.phase !== 'reel' && !fishDone(s); t += FISH_TICK_MS) {
      const tap = opts.tapEveryMs ? t % opts.tapEveryMs === 0 : underFor >= 0 && underFor >= react;
      s = step(s, tap ? [{ t: 'tap' }] : [], FISH_TICK_MS, rng);
      if (s.phase === 'bite') underFor = underFor < 0 ? 0 : underFor + FISH_TICK_MS;
    }
    if (s.phase === 'reel') hooked++;
  }
  return hooked / n;
}
