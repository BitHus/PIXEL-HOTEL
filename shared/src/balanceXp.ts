// SK-2 (docs/PLAN-SKILLTREE.md 2.1): the xp of an hour by SOURCE, the maths the level curve (levels.json 13..30) is tuned against. Uses the same activity
// model as balance.ts (focused rates per activity; a MIXED hour gives every open activity an equal share and the tavern runs alongside at TAVERN_ATTENTION).
// The ASSUMPTIONS below (book finds, claims, mine digs, splices per hour) are in one place. Gates: balance.test.ts (XP section).

import { DUNGEON_ROUNDS, ENEMIES, MIMIC_XP, RANK_WEIGHTS } from './config.ts';
import { activities, guestGoldPerHour, poursPerHour, runsPerHour, TAVERN_ATTENTION_BY_STAGE, type Stage } from './balance.ts';
import { RANKS } from './ranks.ts';
import type { Rank } from './types.ts';
import { XP_TABLE } from './xp.ts';

export type XpStage = 'new' | 'level12' | 'level20';
export const XP_STAGES: readonly XpStage[] = ['new', 'level12', 'level20'];
export const XP_STAGE_NAMES: Record<XpStage, string> = { new: 'new player (level 1)', level12: 'level 12', level20: 'level 20+' };
/** The gold/gem model stage each xp stage plays like (a level 12+ player plays the level 8 world: round 2 crypt, the mine, every recipe). */
const MODEL: Record<XpStage, Stage> = { new: 'new', level12: 'level8', level20: 'level8' };
/** Mixed-hour xp the curve is built for (docs/PLAN-SKILLTREE.md 2.1: about 110 / 210 / 300). */
export const XP_HOUR_TARGET: Record<XpStage, number> = { new: 110, level12: 210, level20: 300 };

export type XpSourceId = 'tavern' | 'crypt' | 'mine' | 'farm' | 'lake' | 'book' | 'claims' | 'splice';
export interface XpSource {
  id: XpSourceId;
  /** Xp per hour when the player does ONLY this (the tavern: at full attention). */
  focused: number;
  /** Xp per hour of a mixed hour. */
  mixed: number;
}

/** ASSUMPTIONS per stage, per hour of play: new Book entries, quest/achievement rewards taken, first-time splice results; and per FOCUSED dig-mine hour: ore dug, rare blocks, exits. */
export const XP_ASSUME: Record<XpStage, { bookPerHour: number; claimsPerHour: number; splicesPerHour: number; ore: number; rare: number; exits: number }> = {
  new: { bookPerHour: 12, claimsPerHour: 1, splicesPerHour: 0, ore: 0, rare: 0, exits: 0 },
  level12: { bookPerHour: 5, claimsPerHour: 1, splicesPerHour: 0.5, ore: 70, rare: 5, exits: 5 },
  level20: { bookPerHour: 3, claimsPerHour: 1, splicesPerHour: 0.5, ore: 90, rare: 7, exits: 6 },
};

type Mix = readonly (readonly [Rank, number])[];
const avg = (mix: Mix, table: Record<Rank, number>): number => {
  const total = mix.reduce((a, [, w]) => a + w, 0);
  return mix.reduce((a, [r, w]) => a + (w / total) * table[r], 0);
};
const ROLLED: Mix = RANKS.map((k) => [k, RANK_WEIGHTS[k]] as const);

/** Crypt xp of a FOCUSED hour: the kills of balance.ts activities (by enemy) plus an exit per floor of each run. */
function cryptXp(stage: Stage): number {
  const crypt = activities(stage).find((a) => a.id === 'crypt')!;
  const kills = crypt.lines.reduce((sum, l) => {
    if (l.note.startsWith('slime')) return sum + l.perHour * ENEMIES.slime.xp;
    if (l.note.startsWith('skeleton')) return sum + l.perHour * ENEMIES.skeleton.xp;
    if (l.source === 'mimic') return sum + l.perHour * MIMIC_XP;
    if (l.source === 'boss') return sum + l.perHour * ENEMIES.bone_king.xp;
    return sum;
  }, 0);
  const floors = stage === 'level8' ? DUNGEON_ROUNDS[2].maxFloors : DUNGEON_ROUNDS[1].maxFloors;
  return kills + runsPerHour(stage) * floors * XP_TABLE.floorExit;
}

/** Tavern xp per hour at FULL attention: every order handed over (half of the drinks a perfect pour), every brew collected, every dish. */
function tavernXp(stage: Stage): number {
  const sold = guestGoldPerHour(stage).sold;
  const pours = poursPerHour(stage);
  const dishes = Math.max(0, sold - pours);
  const brews = pours / 7; // a brew gives about 7 mugs (root ale; the later drinks give 5 to 8)
  return sold * XP_TABLE.order + pours * 0.5 * XP_TABLE.perfectPour + brews * XP_TABLE.brew + dishes * XP_TABLE.cookPerDish;
}

/** Xp per hour by SOURCE for a stage: focused and mixed. */
export function xpBySource(xs: XpStage): XpSource[] {
  const stage = MODEL[xs];
  const acts = activities(stage);
  const share = 1 / acts.length;
  const a = XP_ASSUME[xs];
  const harvest = acts.find((x) => x.id === 'farm')!.lines[0]!;
  const lake = acts.find((x) => x.id === 'lake')!.lines;
  const chop = lake.find((l) => l.source === 'chop')!.perHour * XP_TABLE.tree;
  const fish = lake.find((l) => l.source === 'fish')!.perHour * avg(ROLLED, XP_TABLE.fish);
  const farm = harvest.perHour * avg(harvest.mix, XP_TABLE.harvest);
  const mineOpen = acts.some((x) => x.id === 'mine');
  const mine = mineOpen ? a.ore * XP_TABLE.ore + a.rare * XP_TABLE.rareBlock + a.exits * XP_TABLE.mineExit : 0;
  const tavern = tavernXp(stage);
  return [
    { id: 'tavern', focused: tavern, mixed: tavern * TAVERN_ATTENTION_BY_STAGE[stage] },
    { id: 'crypt', focused: cryptXp(stage), mixed: cryptXp(stage) * share },
    { id: 'mine', focused: mine, mixed: mine * share },
    { id: 'farm', focused: farm, mixed: farm * share },
    { id: 'lake', focused: chop + fish, mixed: (chop + fish) * share },
    { id: 'book', focused: a.bookPerHour * XP_TABLE.bookEntry, mixed: a.bookPerHour * XP_TABLE.bookEntry },
    { id: 'claims', focused: a.claimsPerHour * XP_TABLE.claim, mixed: a.claimsPerHour * XP_TABLE.claim },
    { id: 'splice', focused: a.splicesPerHour * XP_TABLE.spliceFirst, mixed: a.splicesPerHour * XP_TABLE.spliceFirst },
  ];
}

/** Xp of a mixed hour. */
export function mixedXpPerHour(xs: XpStage): number {
  return xpBySource(xs).reduce((s, r) => s + r.mixed, 0);
}

/** The biggest share (0 to 1) one source has of the mixed hour. */
export function biggestXpShare(xs: XpStage): { id: XpSourceId; share: number } {
  const rows = xpBySource(xs);
  const total = rows.reduce((s, r) => s + r.mixed, 0);
  const top = [...rows].sort((p, q) => q.mixed - p.mixed)[0]!;
  return { id: top.id, share: top.mixed / total };
}

/** Xp of a FOCUSED farm hour of 2-minute (common) crops only, plus what runs alongside every hour (book, claims): the farming exploit check. */
export function focusedCommonFarmXp(xs: XpStage): number {
  const stage = MODEL[xs];
  const harvest = activities(stage).find((x) => x.id === 'farm')!.lines[0]!;
  const a = XP_ASSUME[xs];
  return harvest.perHour * XP_TABLE.harvest.common + a.bookPerHour * XP_TABLE.bookEntry + a.claimsPerHour * XP_TABLE.claim;
}

/** The mixed-hour xp rate a player of a level earns: new -> level 12 -> level 20 linear in the level, level 20 and up flat. */
export function xpRateAt(level: number): number {
  const lerp = (a: number, b: number, t: number): number => a + (b - a) * Math.min(1, Math.max(0, t));
  if (level < 12) return lerp(mixedXpPerHour('new'), mixedXpPerHour('level12'), (level - 1) / 11);
  if (level < 20) return lerp(mixedXpPerHour('level12'), mixedXpPerHour('level20'), (level - 12) / 8);
  return mixedXpPerHour('level20');
}

/** Hours of mixed play from a new game to a level (each level's xp step at the rate of the level below it). */
export function hoursToLevel(level: number, totals: readonly number[]): number {
  let h = 0;
  for (let l = 2; l <= level; l++) h += ((totals[l - 1] ?? 0) - (totals[l - 2] ?? 0)) / xpRateAt(l - 1);
  return h;
}
