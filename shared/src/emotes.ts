// Emotes (step 9g-1): a short animation the avatar plays (wave, dance, laugh, cheer, sleep). Pure rules: the clock is passed in.
// An emote is transient (never saved); walking, sitting or starting another emote ends it. The poses are drawn by the client
// (render/emoteAnim.ts emotePose).

import { EMOTE_MS } from './config.ts';

export type EmoteKind = 'wave' | 'dance' | 'laugh' | 'cheer' | 'sleep';
export const EMOTE_KINDS: readonly EmoteKind[] = ['wave', 'dance', 'laugh', 'cheer', 'sleep'];

/** The emote now playing: the kind and the time (ms, the game clock) it ends. */
export interface ActiveEmote {
  kind: EmoteKind;
  untilMs: number;
}

export const EMOTE_LABELS: Record<EmoteKind, string> = { wave: 'Wave', dance: 'Dance', laugh: 'Laugh', cheer: 'Cheer', sleep: 'Sleep' };

export function isEmoteKind(v: unknown): v is EmoteKind {
  return typeof v === 'string' && (EMOTE_KINDS as readonly string[]).includes(v);
}

/** Starts an emote at `nowMs`; null for an unknown kind. */
export function startEmote(kind: string, nowMs: number): ActiveEmote | null {
  return isEmoteKind(kind) ? { kind, untilMs: nowMs + EMOTE_MS[kind] } : null;
}

/** The emote if it is still playing at `nowMs`, else null. */
export function emoteAt(e: ActiveEmote | null, nowMs: number): ActiveEmote | null {
  return e && nowMs < e.untilMs ? e : null;
}

/** An avatar that moves or sits stops emoting (state is the avatar's state). */
export function emoteAllowed(state: 'idle' | 'walk' | 'sit' | 'lie'): boolean {
  return state === 'idle';
}

/** After a state change: keep the emote only while the avatar stands still. */
export function emoteAfterState(e: ActiveEmote | null, state: 'idle' | 'walk' | 'sit' | 'lie'): ActiveEmote | null {
  return emoteAllowed(state) ? e : null;
}
