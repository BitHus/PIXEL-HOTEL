// Pure music form (OB-9): chords, generated pad and arp, the 16-bar form (build-up, A/B variation) and the humanising of
// timing, level and pitch. No Web Audio here and no Math.random: the rng is passed in (mulberry32 below).

import type { Track, VoiceRole } from './musicData.ts';
import type { NoteEvent } from './sequencer.ts';

/** The form is always 16 bars: an 8-bar tune plays twice (A, A'), the 16-bar tavern jig once (A, B). */
export const FORM_BARS = 16;

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const QUALITY: Record<string, number[]> = { '': [0, 4, 7], m: [0, 3, 7], '7': [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], dim: [0, 3, 6] };

/** Tiny seeded rng (0 to 1). Audio timing is not a game rule, but a seed keeps tests and replays the same. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pitch names of a chord symbol (D, Bm, A7, Dm7, F, E7 ...) with the root in `octave`: root, third, fifth (and the seventh). */
export function chordNotes(chord: string, octave: number): string[] {
  const m = /^([A-G])([#b]?)(m7|maj7|m|7|dim|)$/.exec(chord);
  if (!m) throw new Error(`bad chord "${chord}"`);
  const root = PC[m[1]!]! + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  return QUALITY[m[3]!]!.map((iv) => {
    const abs = (octave + 1) * 12 + root + iv;
    return `${NAMES[((abs % 12) + 12) % 12]}${Math.floor(abs / 12) - 1}`;
  });
}

/** Chords per bar; "D+A" splits the bar in two halves. Throws when the count is not the track's bar count. */
export function parseChords(track: Track): string[][] {
  const bars = track.chords
    .split(/\s+/)
    .filter(Boolean)
    .map((b) => b.split('+'));
  if (bars.length !== track.bars) throw new Error(`${track.id}: ${bars.length} chords for ${track.bars} bars`);
  for (const b of bars) for (const c of b) chordNotes(c, 3);
  return bars;
}

/** The pad as events: note = chord symbol, covering the loop exactly. */
export function padEvents(track: Track): NoteEvent[] {
  const out: NoteEvent[] = [];
  parseChords(track).forEach((halves, bar) => {
    const len = track.stepsPerBar / halves.length;
    halves.forEach((c, i) => out.push({ step: bar * track.stepsPerBar + Math.round(i * len), len: Math.round(len), note: c }));
  });
  return out;
}

/** The arp as pitch events cycling the chord tones; empty when the track has none. */
export function arpEvents(track: Track): NoteEvent[] {
  const cfg = track.arp;
  if (!cfg) return [];
  const out: NoteEvent[] = [];
  for (const seg of padEvents(track)) {
    const t = chordNotes(seg.note, cfg.octave);
    const top = chordNotes(seg.note, cfg.octave + 1)[0]!;
    const tones = cfg.style === 'repeat' ? [t[0]!, t[2]!, t[1]!, top] : [t[0]!, t[1]!, t[2]!, top, t[2]!, t[1]!];
    for (let i = 0; i * cfg.every < seg.len; i++) {
      const idx = cfg.style === 'repeat' ? Math.floor(i / 3) % tones.length : i % tones.length;
      out.push({ step: seg.step + i * cfg.every, len: cfg.every, note: tones[idx]! });
    }
  }
  return out;
}

/** Which of the four 4-bar sections of the form a bar is in (0..3). */
export function sectionOf(absStep: number, stepsPerBar: number): number {
  return Math.floor((Math.floor(absStep / stepsPerBar) % FORM_BARS) / 4);
}

/** Dynamic arc: 0 pad + bass only (soft), 1 + lead, 2 + drums and arp, 3 everything. Returns the level 0..1 of a role in a section. */
export function arcLevel(role: VoiceRole, section: number): number {
  const sec = Math.max(0, Math.min(3, Math.floor(section)));
  const base = [0.6, 0.85, 1, 1][sec]!;
  if (role === 'pad' || role === 'bass' || role === 'drone') return base;
  if (role === 'lead' || role === 'bell') return sec >= 1 ? base : 0;
  return sec >= 2 ? base : 0; // drums, arp
}

/** Second time round the tune (odd loop) the lead goes an octave up. */
export function leadTranspose(loopIndex: number): number {
  return loopIndex % 2 === 1 ? 12 : 0;
}

/** Fills and dropouts: the kick skips beat 1 on every 4th bar, the bass is out on every 8th bar (the form's bars 8 and 16). */
export function dropout(role: VoiceRole, note: string, absStep: number, stepsPerBar: number): boolean {
  const formBar = Math.floor(absStep / stepsPerBar) % FORM_BARS;
  const inBar = absStep % stepsPerBar;
  if (role === 'drums' && note === 'k' && inBar === 0 && formBar % 4 === 3) return true;
  if (role === 'bass' && formBar % 8 === 7) return true;
  return false;
}

/** Accent 0..1 from the place in the bar: beat 1 = 1, other beats 0.9, upbeats 0.75. */
export function accentFor(stepInBar: number, stepsPerBeat: number): number {
  if (stepInBar === 0) return 1;
  return stepInBar % stepsPerBeat === 0 ? 0.9 : 0.75;
}

/** Timing jitter in ms (+/-): lead and arp 8, bass 4, drums 3 (the kick stays on the grid), pad and others 0. */
export function jitterMs(role: VoiceRole, note: string): number {
  if (role === 'lead' || role === 'arp') return 8;
  if (role === 'bass') return 4;
  if (role === 'drums') return note === 'k' ? 0 : 3;
  return 0;
}

export interface Human {
  /** Seconds to add to the start time (never accumulates: it is not added to the grid). */
  dt: number;
  /** Level multiplier 0..1 (accent, +/-8% random). */
  vel: number;
  /** Random detune in cents (+/-3 on the lead, 0 elsewhere). */
  cents: number;
}

export function humanize(rng: () => number, role: VoiceRole, note: string, accent: number): Human {
  const j = jitterMs(role, note);
  const vel = Math.min(1, (0.85 + 0.15 * accent) * (1 + (rng() * 2 - 1) * 0.08));
  return { dt: (rng() * 2 - 1) * j * 0.001, vel, cents: role === 'lead' ? (rng() * 2 - 1) * 3 : 0 };
}

/** Swing: delay in seconds of an event on an odd step of a straight-eighth track (stepsPerBeat 2); 0 otherwise. */
export function swingDelay(absStep: number, stepsPerBeat: number, swing: number | undefined, stepS: number): number {
  if (!swing || stepsPerBeat !== 2) return 0;
  return absStep % 2 === 1 ? swing * stepS : 0;
}

/** One dotted eighth in seconds at a bpm (the echo time). */
export function dottedEighth(bpm: number): number {
  return (60 / bpm) * 0.75;
}
