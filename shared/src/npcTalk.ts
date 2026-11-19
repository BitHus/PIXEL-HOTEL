// What the tavern's guests say (step 9d, kept by 9t and S1): short lines from shared/data/npcLines.json, by moment. Pure:
// the rng is passed in. A line is never the same as the last line said for that moment
// (TavernState.lastLines keeps the index per moment). Not every guest talks every time: the
// chance per moment is in config TALK_CHANCE, more for chatty customers, less for hurried ones.

import linesData from '../data/npcLines.json';
import { CHATTY_TALK, HURRIED_TALK, TALK_CHANCE } from './config.ts';
import type { GameState } from './gameState.ts';
import type { Reaction, Rng } from './types.ts';

export type NpcMoment = keyof typeof linesData;
export type CustomerKind = 'hurried' | 'browser' | 'chatty';
/** The kinds of moment with their own talk chance (the reaction moments share one). */
export type TalkMoment = keyof typeof TALK_CHANCE;

export const NPC_LINES: Readonly<Record<NpcMoment, readonly string[]>> = linesData;
export const NPC_MOMENTS = Object.keys(linesData) as NpcMoment[];

/** The line moment for a reaction face. */
export function reactionMoment(r: Reaction): NpcMoment {
  return r === 'big_smile' ? 'cheap' : r === 'smile' ? 'fair' : r === 'shrug' ? 'high' : 'too_high';
}

/** The index of a line for the moment, never `last` (when there is more than one line). */
export function pickLine(moment: NpcMoment, rng: Rng, last: number | undefined): number {
  const n = NPC_LINES[moment].length;
  if (n <= 1 || last === undefined || last < 0 || last >= n) return Math.floor(rng() * n) % n;
  // Pick among the other n - 1 lines.
  const k = Math.floor(rng() * (n - 1)) % (n - 1);
  return k >= last ? k + 1 : k;
}

/** The chance that a customer of this kind talks at this moment (0..1). */
export function talkChance(moment: TalkMoment, kind: CustomerKind): number {
  const base = TALK_CHANCE[moment];
  const k = kind === 'chatty' ? CHATTY_TALK : kind === 'hurried' ? HURRIED_TALK : 1;
  return Math.min(1, base * k);
}

/**
 * Maybe a line: rolls the talk chance (skipped when `always`), then picks the line. Returns the
 * text and the new lastLines, or null when the customer stays quiet.
 */
export function maybeSay(
  lastLines: Readonly<Partial<Record<NpcMoment, number>>>,
  moment: NpcMoment,
  chance: number,
  rng: Rng,
): { text: string; lastLines: Partial<Record<NpcMoment, number>> } | null {
  if (rng() >= chance) return null;
  const i = pickLine(moment, rng, lastLines[moment]);
  return { text: NPC_LINES[moment][i] ?? '', lastLines: { ...lastLines, [moment]: i } };
}

/** The ambient moments a guest at a table may talk about: the crowd, the group, or a low-chance gag (3g). */
export const GAG_MOMENTS = ['gag_water', 'gag_cat', 'gag_barrel', 'gag_regular', 'rare_joke'] as const satisfies readonly NpcMoment[];

/**
 * Like maybeSay, but on a GameState: keeps the no-repeat memory in TavernState.lastLines. Null = silent (the state is not changed).
 */
export function sayFrom(state: GameState, moment: NpcMoment, chance: number, rng: Rng): { state: GameState; text: string } | null {
  const r = maybeSay(state.tavern.lastLines, moment, chance, rng);
  if (!r) return null;
  return { state: { ...state, tavern: { ...state.tavern, lastLines: r.lastLines } }, text: r.text };
}
