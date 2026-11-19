// Pure music logic (AU-2): parsing the data tables, loop maths, a lookahead window and the crossfade plan. No Web Audio here.

import { TRACKS, type Track, type TrackId } from './musicData.ts';

export interface NoteEvent {
  /** Step of the loop where it starts. */
  step: number;
  /** Length in steps. */
  len: number;
  /** Pitch name (D5) or a drum letter (k, s, h). */
  note: string;
}

const SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Frequency of a pitch name like A4, F#3, Bb2 (A4 = 440 Hz); null for rests, drums and bad names. */
export function noteHz(name: string): number | null {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) return null;
  const semis = SEMITONE[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

/** Parses a voice pattern; rests are dropped from the list but still take their steps. Throws on a bad token. */
export function parsePattern(pattern: string): { events: NoteEvent[]; steps: number } {
  const events: NoteEvent[] = [];
  let step = 0;
  for (const tok of pattern.split(/\s+/).filter(Boolean)) {
    const [note, lenText] = tok.split(':');
    const len = lenText === undefined ? 1 : Number(lenText);
    if (!note || !Number.isInteger(len) || len < 1) throw new Error(`bad music token "${tok}"`);
    if (note !== '-') events.push({ step, len, note });
    step += len;
  }
  return { events, steps: step };
}

export function loopSteps(track: Track): number {
  return track.bars * track.stepsPerBar;
}

export function stepSeconds(track: Track): number {
  return 60 / track.bpm / track.stepsPerBeat;
}

export function loopSeconds(track: Track): number {
  return loopSteps(track) * stepSeconds(track);
}

/** Events that start in the absolute steps [from, to) of a looping voice (the loop repeats forever). */
export function eventsBetween(events: readonly NoteEvent[], loopLen: number, from: number, to: number): { event: NoteEvent; at: number }[] {
  const out: { event: NoteEvent; at: number }[] = [];
  for (let loop = Math.floor(from / loopLen); loop * loopLen < to; loop++) {
    for (const event of events) {
      const at = loop * loopLen + event.step;
      if (at >= from && at < to) out.push({ event, at });
    }
  }
  return out;
}

/** Which music a place plays: a room kind, or 'dungeon' / 'mine' / 'title'. */
export function trackFor(place: string | null): TrackId | null {
  switch (place) {
    case 'shop':
    case 'kitchen':
    case 'cellar':
    case 'tavern':
      return 'tavern';
    case 'hotel':
    case 'title':
      return 'title';
    case 'dungeon':
      return 'dungeon';
    case 'mine':
      return 'mine';
    case 'lakeside':
      return 'lakeside';
    case 'farm':
      return 'farm';
    default:
      return null;
  }
}

/** Equal-power crossfade: gains of the old and the new track at progress p (0 to 1). */
export function crossfadeGains(p: number): { out: number; in: number } {
  const c = Math.max(0, Math.min(1, p));
  return { out: Math.cos((c * Math.PI) / 2), in: Math.sin((c * Math.PI) / 2) };
}

export type FadeAction = 'none' | 'start' | 'stop' | 'crossfade';

/** What a change of music needs: nothing when it is the same, start from silence, stop, or a crossfade. */
export function fadePlan(current: TrackId | null, next: TrackId | null): FadeAction {
  if (current === next) return 'none';
  if (current === null) return 'start';
  if (next === null) return 'stop';
  return 'crossfade';
}

/** The squared slider curve used for both volumes (even to the ear). */
export function volumeGain(enabled: boolean, volume: number): number {
  const v = Math.max(0, Math.min(1, volume));
  return enabled ? v * v : 0;
}

export interface ParsedVoice {
  wave: string;
  gain: number;
  events: NoteEvent[];
}

export function parseTrack(id: TrackId): { track: Track; voices: ParsedVoice[] } {
  const track = TRACKS[id];
  return { track, voices: track.voices.map((v) => ({ wave: v.wave, gain: v.gain, events: parsePattern(v.pattern).events })) };
}
