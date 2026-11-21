// MISCLICK-PROOF INTERACTION (owner 19 Nov: 'I often misclick on NPCs, taps, the stove; button on PC, big hitbox on phone').
// Pure helpers on plain data: which usable thing comes first when several overlap (priority), what its action is called (the hover name tag and
// the phone CONTEXT BUTTON), the nearest usable thing to the avatar (the E key and the context button), the Tab cycle, and whether a press that slid
// is still on its target (sliding off before release cancels). The client only feeds rectangles and states (client/src/game/interactAssist.ts).

import { INTERACT_PRIORITY } from './config.ts';
import { distanceToRect } from './tapPick.ts';
import type { Point, Rect } from './types.ts';

/** What a usable thing is, for its priority and its action label. */
export type InteractKind = 'guest' | 'pour' | 'taps' | 'stash' | 'stove' | 'barrel' | 'cask' | 'bar' | 'seat' | 'use';

export interface InteractState {
  kind: InteractKind;
  /** Ready or urgent: a guest with an open order, a stove or barrel with a ready batch, the taps while a pour waits, the bar while orders wait. */
  ready?: boolean;
}

/** Priority when things overlap (higher first): ready/urgent first, then machines, then seats, then the rest (the floor is no target). */
export function interactPriority(s: InteractState): number {
  if (s.kind === 'pour' || s.ready) return INTERACT_PRIORITY.urgent;
  switch (s.kind) {
    case 'stove':
    case 'barrel':
    case 'cask':
    case 'taps':
    case 'stash':
    case 'bar':
      return INTERACT_PRIORITY.machine;
    case 'seat':
      return INTERACT_PRIORITY.seat;
    default:
      return INTERACT_PRIORITY.other;
  }
}

/** The action word for the name tag and the context button. */
export function interactLabel(s: InteractState): string {
  switch (s.kind) {
    case 'guest':
      return s.ready ? 'Serve' : 'Talk';
    case 'pour':
      return 'Pour';
    case 'taps':
      return 'Taps';
    case 'stash':
      return 'Stash';
    case 'stove':
      return s.ready ? 'Collect' : 'Cook';
    case 'barrel':
      return s.ready ? 'Collect' : 'Brew';
    case 'cask':
      return 'Kegs';
    case 'bar':
      return s.ready ? 'Serve' : 'Menu';
    case 'seat':
      return 'Sit';
    default:
      return 'Use';
  }
}

/** A usable thing near the avatar: its footprint or body (world px) and its priority. */
export interface Reachable<T> {
  ref: T;
  area: Rect;
  priority: number;
}

/** The things within `reach` world px of `from`, best first: the higher priority, then the nearer, then the given order. */
export function interactOrder<T>(from: Point, list: readonly Reachable<T>[], reach: number): T[] {
  return list
    .map((r, i) => ({ r, i, d: distanceToRect(from, r.area) }))
    .filter((x) => x.d <= reach)
    .sort((a, b) => b.r.priority - a.r.priority || a.d - b.d || a.i - b.i)
    .map((x) => x.r.ref);
}

/** The best usable thing within reach of the avatar (the E key, the context button), or null. */
export function nearestInteract<T>(from: Point, list: readonly Reachable<T>[], reach: number): T | null {
  return interactOrder(from, list, reach)[0] ?? null;
}

/** Tab / Shift+Tab: the next index in a list of `n` (current -1 = none yet: Tab starts at the first, Shift+Tab at the last); -1 when the list is empty. */
export function cycleIndex(current: number, n: number, dir: 1 | -1): number {
  if (n <= 0) return -1;
  if (current < 0 || current >= n) return dir === 1 ? 0 : n - 1;
  return (current + dir + n) % n;
}

/** Touch: a press that slid is still on its target while the point stays within `tolerance` of its bounds (grown to `minSize`); off = cancelled. */
export function pressStaysOn(p: Point, bounds: Rect, opts: { tolerance: number; minSize: number }): boolean {
  const w = Math.max(bounds.w, opts.minSize);
  const h = Math.max(bounds.h, opts.minSize);
  const grown = { x: bounds.x - (w - bounds.w) / 2, y: bounds.y - (h - bounds.h) / 2, w, h };
  return distanceToRect(p, grown) <= opts.tolerance;
}

/** The Settings toggle 'Big tap targets': a stored choice wins; none stored = on for touch, off for a mouse. */
export function bigTapsOn(pref: boolean | null | undefined, touch: boolean): boolean {
  return typeof pref === 'boolean' ? pref : touch;
}
