// TUT-2 part 3 (OA-15): daily quests, event quests and achievements.
// Progress is COUNTED from the ledger (entries with a reason, at >= the start of the day / event / ever), so no counters are saved:
// GameState.quests.claimed holds only what was paid. Dailies: dailyCount picked by a pure seeded rule from the date passed in; no streaks,
// no penalty, no countdown, nothing to buy (CLAUDE.md 13). Rewards are small gold through applyChange reason 'quest'.

import questData from '../data/quests.json';
import { HINTS } from './config.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { entryDead, entryMade } from './ledgerFold.ts';

export type QuestMeasure = 'count' | 'made';
export interface QuestDef {
  id: string;
  text: string;
  reasons: string[];
  /** 'count' (default) = ledger entries; 'made' = entries that put something in the bag (a collected batch). */
  measure?: QuestMeasure;
  target: number;
  gold: number;
  area?: string;
  minLevel?: number;
  /** A run that ended in death or an Abandon does not count (only 'left' runs). */
  notDead?: boolean;
}
export interface EventDef {
  id: string;
  name: string;
  /** 'MM-DD' (local); `to` before `from` = the period wraps over New Year. */
  from: string;
  to: string;
  blurb: string;
  twist: string;
  quests: QuestDef[];
}
export interface QuestData {
  dailyCount: number;
  dailyGoldMax: number;
  daily: QuestDef[];
  events: EventDef[];
  achievements: QuestDef[];
}
export const QUEST_DATA = questData as QuestData;

/** The local day: its key 'YYYY-MM-DD' and the ms its midnight started. Pure: the time and the zone offset (Date.getTimezoneOffset, minutes) are passed in. */
export interface DayInfo {
  key: string;
  startMs: number;
}
export function dayInfo(nowMs: number, tzOffsetMinRaw: number): DayInfo {
  const tzOffsetMin = Math.max(-840, Math.min(720, Math.round(Number.isFinite(tzOffsetMinRaw) ? tzOffsetMinRaw : 0))); // real zones only
  const local = nowMs - tzOffsetMin * 60_000;
  const dayStartLocal = Math.floor(local / 86_400_000) * 86_400_000;
  return { key: new Date(dayStartLocal).toISOString().slice(0, 10), startMs: dayStartLocal + tzOffsetMin * 60_000 };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** The pool in a seeded order for one day key (a pure shuffle by hash). */
function shuffled(pool: readonly QuestDef[], key: string): QuestDef[] {
  return pool
    .map((q) => ({ q, k: hash(`${key}|${q.id}`) }))
    .sort((a, b) => a.k - b.k || (a.q.id < b.q.id ? -1 : 1))
    .map((x) => x.q);
}

/** Days are chained in blocks of this many: a block's first day has nothing to avoid, every later day avoids the two days before it (one rule, no hidden state). */
export const DAILY_BLOCK_DAYS = 30;
const dayIndex = (key: string): number => Math.floor(Date.parse(`${key}T00:00:00Z`) / 86_400_000);

function pickDay(pool: readonly QuestDef[], dayKey: string, recent: ReadonlySet<string>): QuestDef[] {
  const order = shuffled(pool, dayKey);
  const fresh = order.filter((q) => !recent.has(q.id));
  const picked: QuestDef[] = [];
  const areas = new Set<string>();
  const take = (list: QuestDef[], distinct: boolean): void => {
    for (const q of list) {
      if (picked.length >= QUEST_DATA.dailyCount) return;
      if (picked.includes(q) || (distinct && areas.has(q.area ?? q.id))) continue;
      areas.add(q.area ?? q.id);
      picked.push(q);
    }
  };
  // Fresh ones first (other areas, then any), only then what came on the last two days.
  take(fresh, true);
  take(fresh, false);
  take(order, true);
  take(order, false);
  return picked;
}

/**
 * The day's quests: the same date and level always give the same ones; each comes from another area; what was picked on the two days before
 * is left out (inside a DAILY_BLOCK_DAYS block). Pure: only the date and the level go in. Missing a day costs nothing.
 */
export function dailyQuests(dayKey: string, level: number): QuestDef[] {
  // The history chain uses the WHOLE pool (level-free), so a level-up never re-rolls the day; a quest the player cannot do yet is swapped at the end.
  const pool = QUEST_DATA.daily;
  const idx = dayIndex(dayKey);
  const start = idx - (((idx % DAILY_BLOCK_DAYS) + DAILY_BLOCK_DAYS) % DAILY_BLOCK_DAYS);
  const history: string[][] = [];
  let out: QuestDef[] = [];
  for (let d = start; d <= idx; d++) {
    const key = new Date(d * 86_400_000).toISOString().slice(0, 10);
    const recent = new Set([...(history[history.length - 1] ?? []), ...(history[history.length - 2] ?? [])]);
    out = pickDay(pool, key, recent);
    history.push(out.map((q) => q.id));
  }
  if (out.every((q) => (q.minLevel ?? 1) <= level)) return out;
  const spare = shuffled(pool, dayKey).filter((q) => (q.minLevel ?? 1) <= level && !out.includes(q));
  const result = out.map((q) => ((q.minLevel ?? 1) <= level ? q : null));
  for (let i = 0; i < result.length; i++) {
    if (result[i]) continue;
    const pick = spare.find((s) => !result.some((r) => r?.area === s.area)) ?? spare[0];
    if (pick) spare.splice(spare.indexOf(pick), 1);
    result[i] = pick ?? null;
  }
  return result.filter((q): q is QuestDef => q !== null);
}

/** The event running on a day key, with the key of the day this run of it began (claims are per run, so it can come back next year). */
export function activeEvent(dayKey: string): { event: EventDef; startKey: string } | null {
  const md = dayKey.slice(5);
  const year = Number(dayKey.slice(0, 4));
  for (const event of QUEST_DATA.events) {
    const wraps = event.to < event.from;
    const inside = wraps ? md >= event.from || md <= event.to : md >= event.from && md <= event.to;
    if (!inside) continue;
    const startYear = wraps && md <= event.to ? year - 1 : year;
    return { event, startKey: `${startYear}-${event.from}` };
  }
  return null;
}

/** How far a quest is: ledger entries since `sinceMs` with its reasons (the 'quest' and 'debug' reasons are never listed in the data). */
export function questProgress(state: GameState, q: QuestDef, sinceMs: number, untilMs = Number.POSITIVE_INFINITY): number {
  let n = 0;
  // Ever-counting quests (achievements) also take the counters of the entries folded out of the ledger.
  if (sinceMs <= 0) {
    for (const reason of q.reasons) {
      const f = state.quests.folded?.[reason];
      const dead = state.quests.folded?.[`${reason}:dead`];
      if (!f) continue;
      const one = q.measure === 'made' ? f.made - (q.notDead ? (dead?.made ?? 0) : 0) : f.n - (q.notDead ? (dead?.n ?? 0) : 0);
      n += Math.max(0, one);
    }
  }
  for (const e of state.ledger) {
    if (e.at < sinceMs || e.at >= untilMs || !q.reasons.includes(e.reason)) continue;
    if (q.measure === 'made' && !entryMade(e)) continue;
    if (q.notDead && entryDead(e)) continue;
    n++;
  }
  return Math.min(n, q.target);
}

export type QuestKind = 'daily' | 'event' | 'achievement';
export interface QuestRow {
  /** The id that goes in GameState.quests.claimed (dated for dailies and events). */
  claimId: string;
  kind: QuestKind;
  text: string;
  progress: number;
  target: number;
  gold: number;
  claimed: boolean;
  /** Done and not taken yet. */
  ready: boolean;
}
export interface QuestBoard {
  daily: QuestRow[];
  event: { id: string; name: string; blurb: string; twist: string; rows: QuestRow[] } | null;
  achievements: QuestRow[];
  /** Rows ready to take (the Quest button's dot). */
  ready: number;
}

const claimedOf = (state: GameState): string[] => state.quests?.claimed ?? [];

function row(state: GameState, kind: QuestKind, claimId: string, q: QuestDef, since: number, until = Number.POSITIVE_INFINITY): QuestRow {
  const claimed = claimedOf(state).includes(claimId);
  const progress = claimed ? q.target : questProgress(state, q, since, until);
  return { claimId, kind, text: q.text, progress, target: q.target, gold: q.gold, claimed, ready: !claimed && progress >= q.target };
}

/** The achievement for a first-run hint (HINTS): done when the hint is; the hint card paid it already, so never claimable (no save loss). */
function hintRows(state: GameState): QuestRow[] {
  return HINTS.map((text, i) => ({ claimId: `first_${i}`, kind: 'achievement' as const, text, progress: state.hintsDone > i ? 1 : 0, target: 1, gold: 0, claimed: state.hintsDone > i, ready: false }));
}

export function questBoard(state: GameState, day: DayInfo): QuestBoard {
  const level = state.player.level;
  const daily = dailyQuests(day.key, level).map((q) => row(state, 'daily', `daily:${day.key}:${q.id}`, q, day.startMs, day.startMs + 86_400_000));
  const active = activeEvent(day.key);
  const event = active
    ? {
        id: active.event.id,
        name: active.event.name,
        blurb: active.event.blurb,
        twist: active.event.twist,
        // The event counts from the local day it began; the zone is taken from today's start (day.startMs is local midnight).
        rows: active.event.quests.map((q) => row(state, 'event', `event:${active.event.id}:${active.startKey}:${q.id}`, q, eventStartMs(active.startKey, day))),
      }
    : null;
  const achievements = [...hintRows(state), ...QUEST_DATA.achievements.map((q) => row(state, 'achievement', `ach:${q.id}`, q, 0))];
  const ready = [...daily, ...(event?.rows ?? []), ...achievements].filter((r) => r.ready).length;
  return { daily, event, achievements, ready };
}

function eventStartMs(startKey: string, day: DayInfo): number {
  const days = Math.round((Date.parse(`${day.key}T00:00:00Z`) - Date.parse(`${startKey}T00:00:00Z`)) / 86_400_000);
  return day.startMs - days * 86_400_000;
}

/** Takes the reward of one ready row: gold through the ledger (reason 'quest'). Null when it is not ready, not on the board, or already taken. Old dated daily claims are dropped. */
export function claimQuest(state: GameState, claimId: string, day: DayInfo, at: number): GameState | null {
  const board = questBoard(state, day);
  const target = [...board.daily, ...(board.event?.rows ?? []), ...board.achievements].find((r) => r.claimId === claimId);
  if (!target || !target.ready) return null;
  const paid = applyChange(state, { reason: 'quest', gold: target.gold, note: claimId }, at);
  if (!paid) return null;
  // Only dated claims two or more days older than today are dropped (day indices; a clock or zone flip back to a recent day finds its claim kept).
  const today = dayIndex(day.key);
  const keep = (id: string): boolean => {
    const m = /^daily:(d{4}-d{2}-d{2}):/.exec(id);
    return !m || dayIndex(m[1]!) > today - 2;
  };
  return { ...paid, quests: { ...paid.quests, claimed: [...claimedOf(paid).filter(keep), claimId] } };
}
