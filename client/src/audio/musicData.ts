// Music as pure data (AU-2): original chiptune loops. A voice is a string of tokens "NOTE:len" (len in steps, default 1);
// NOTE is a pitch like D5, F#4, Bb3, or "-" for a rest; on a noise voice the tokens are drums: k (kick), s (snare), h (hat).
// Every voice of a track must add up to exactly track.bars * track.stepsPerBar steps (sequencer.test.ts checks it).

export type TrackId = 'tavern' | 'title' | 'dungeon' | 'mine' | 'lakeside' | 'farm';
export type VoiceWave = 'square' | 'triangle' | 'sine' | 'sawtooth' | 'noise';

/** What a voice is: it picks the synth (filter, detune, sub, vibrato), the sends and the humanising. */
export type VoiceRole = 'lead' | 'bass' | 'drums' | 'bell' | 'drone' | 'pad' | 'arp';
export type DrumKit = 'jig' | 'tom' | 'shaker';

export interface Voice {
  role: VoiceRole;
  wave: VoiceWave;
  /** 0 to 1, relative to the music bus (kept low: a pad under a lead). */
  gain: number;
  pattern: string;
}

export interface Track {
  id: TrackId;
  /** Beats per minute; a beat = stepsPerBeat steps. */
  bpm: number;
  stepsPerBeat: number;
  stepsPerBar: number;
  bars: number;
  voices: readonly Voice[];
  /** One chord per bar, space separated; "D+A" = two chords in one bar (OB-9). Drives the pad and the arp. */
  chords: string;
  /** Pad level 0 to 1 (the pad is generated from the chords). */
  pad: number;
  /** Plucked arpeggio generated from the chords (none = no arp). */
  arp?: { style: 'repeat' | 'cycle'; every: number; octave: number; gain: number };
  /** Drum sounds for the noise voice. */
  kit?: DrumKit;
  /** Reverb: tail seconds, damping 0..1 (higher = darker), wet scale. */
  reverb: { seconds: number; damp: number; mix: number };
  /** Late second eighth, fraction of a step (straight-eighth tracks only). */
  swing?: number;
}

/** The string repeated n times, space separated. */
const rep = (s: string, n: number): string => Array<string>(n).fill(s).join(' ');
const bars = (...b: string[]): string => b.join(' ');

// TAVERN: a cosy folk jig in D, 6/8 (one step = an eighth, a beat = a dotted quarter), 100 bpm, 16 bars (two 8-bar tunes).
const tavern: Track = {
  id: 'tavern',
  bpm: 100,
  stepsPerBeat: 3,
  stepsPerBar: 6,
  bars: 16,
  chords: 'D G D A D G D+A D+A Bm D G A Bm A A D',
  pad: 0.8,
  arp: { style: 'repeat', every: 1, octave: 4, gain: 0.5 },
  kit: 'jig',
  reverb: { seconds: 1.0, damp: 0.8, mix: 1 },
  voices: [
    {
      role: 'lead', wave: 'square',
      gain: 0.5,
      pattern: bars(
        'D5:2 A4 F#4:2 A4', 'B4:2 G4 B4:3', 'A4 B4 A4 F#4 A4 D5', 'E5:3 A4:3',
        'D5:2 A4 F#4:2 A4', 'G4 B4 D5 B4 G4 B4', 'A4 F#4 D4 E4 F#4 G4', 'A4:4 -:2',
        'B4:2 F#4 B4:2 D5', 'A4:2 F#4 A4:3', 'G4:2 B4 D5:2 B4', 'A4:3 F#4:3',
        'B4:2 F#4 B4:2 D5', 'E5:2 D5 B4:3', 'A4 B4 A4 F#4 E4 F#4', 'D4:5 -:1',
      ),
    },
    {
      role: 'bass', wave: 'triangle',
      gain: 0.9,
      pattern: bars(
        'D3:3 A3:3', 'G2:3 D3:3', 'D3:3 A3:3', 'A2:3 E3:3',
        'D3:3 A3:3', 'G2:3 D3:3', 'D3:3 A2:3', 'D3:3 A2:3',
        'B2:3 F#3:3', 'D3:3 A3:3', 'G2:3 D3:3', 'A2:3 E3:3',
        'B2:3 F#3:3', 'A2:3 E3:3', 'A2:3 A2:3', 'D3:5 -:1',
      ),
    },
    { role: 'drums', wave: 'noise', gain: 0.35, pattern: rep('k -:1 h s -:1 h', 16) },
  ],
};

// TITLE / HOTEL: warm and slow, C major, 80 bpm, 4/4 in eighths.
const title: Track = {
  id: 'title',
  bpm: 80,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  bars: 8,
  chords: 'C Am F G C Am F G',
  pad: 1,
  arp: { style: 'cycle', every: 2, octave: 4, gain: 0.35 },
  reverb: { seconds: 1.8, damp: 0.6, mix: 1.1 },
  swing: 0.1,
  voices: [
    {
      role: 'lead', wave: 'square',
      gain: 0.4,
      pattern: bars('E5:2 G5:2 E5:2 C5:2', 'E5:2 A5:2 E5:2 C5:2', 'F5:2 A5:2 F5:2 C5:2', 'D5:2 G5:2 B5:2 G5:2', 'E5:2 G5:2 C6:4', 'B5:2 A5:2 E5:4', 'A5:2 G5:2 F5:2 E5:2', 'D5:6 -:2'),
    },
    { role: 'bass', wave: 'triangle', gain: 0.9, pattern: bars('C3:4 G3:4', 'A2:4 E3:4', 'F2:4 C3:4', 'G2:4 D3:4', 'C3:4 G3:4', 'A2:4 E3:4', 'F2:4 C3:4', 'G2:4 D3:4') },
  ],
};

// DUNGEON: dark and sparse, A minor, 70 bpm, a low drone and a heartbeat.
const dungeon: Track = {
  id: 'dungeon',
  bpm: 70,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  bars: 8,
  chords: 'Am Am F Em Am F Dm Em',
  pad: 0.7,
  kit: 'tom',
  reverb: { seconds: 2.6, damp: 0.7, mix: 1.3 },
  voices: [
    { role: 'lead', wave: 'triangle', gain: 0.5, pattern: bars('A4:3 -:5', 'C5:2 B4:2 -:4', 'E4:4 -:4', '-:8', 'A4:3 -:1 G4:2 -:2', 'F4:2 E4:6', 'D4:4 -:4', 'E4:2 -:6') },
    { role: 'drone', wave: 'square', gain: 0.3, pattern: bars('A1:8', 'A1:8', 'F1:8', 'E1:8', 'A1:8', 'F1:8', 'D1:8', 'E1:8') },
    { role: 'drums', wave: 'noise', gain: 0.3, pattern: rep('k -:3 k -:3', 8) },
  ],
};

// MINE: dripping and low, E minor, 60 bpm.
const mine: Track = {
  id: 'mine',
  bpm: 60,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  bars: 8,
  chords: 'Em Em C D Em C Bm Bm',
  pad: 0.8,
  reverb: { seconds: 3.0, damp: 0.75, mix: 1.4 },
  voices: [
    { role: 'bell', wave: 'sine', gain: 0.6, pattern: bars('E6:1 -:7', '-:3 B5:1 -:4', 'G5:1 -:3 E5:1 -:3', '-:8', 'B5:1 -:5 G5:1 -:1', '-:2 E6:1 -:5', 'D6:1 -:3 B5:1 -:3', '-:8') },
    { role: 'bass', wave: 'triangle', gain: 0.9, pattern: bars('E2:8', 'E2:8', 'C2:8', 'D2:8', 'E2:8', 'C2:8', 'B1:8', 'B1:8') },
  ],
};

// LAKESIDE: calm, G major, 72 bpm.
const lakeside: Track = {
  id: 'lakeside',
  bpm: 72,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  bars: 8,
  chords: 'G Em C D G C D G',
  pad: 0.9,
  arp: { style: 'cycle', every: 2, octave: 4, gain: 0.35 },
  reverb: { seconds: 2.2, damp: 0.55, mix: 1.2 },
  swing: 0.08,
  voices: [
    { role: 'lead', wave: 'triangle', gain: 0.7, pattern: bars('B4:2 D5:2 G5:4', 'E5:2 D5:2 B4:4', 'C5:2 E5:2 A5:4', 'G5:4 D5:4', 'B4:2 D5:2 G5:2 B5:2', 'A5:2 G5:2 E5:4', 'D5:2 C5:2 A4:2 C5:2', 'G4:8') },
    { role: 'bass', wave: 'sine', gain: 0.8, pattern: bars('G2:4 D3:4', 'E2:4 B2:4', 'C3:4 G3:4', 'D3:4 A2:4', 'G2:4 D3:4', 'C3:4 G3:4', 'D3:4 A2:4', 'G2:8') },
  ],
};

// FARM: light and pastoral, C major, 96 bpm.
const farm: Track = {
  id: 'farm',
  bpm: 96,
  stepsPerBeat: 2,
  stepsPerBar: 8,
  bars: 8,
  chords: 'C Dm C G C F C+G G',
  pad: 0.6,
  arp: { style: 'cycle', every: 2, octave: 4, gain: 0.3 },
  kit: 'shaker',
  reverb: { seconds: 1.4, damp: 0.6, mix: 1 },
  swing: 0.12,
  voices: [
    {
      role: 'lead', wave: 'square',
      gain: 0.4,
      pattern: bars('C5 E5 G5:2 E5:2 C5:2', 'D5 F5 A5:2 F5:2 D5:2', 'E5 G5 C6:2 G5:2 E5:2', 'G5:2 F5:2 D5:4', 'C5 E5 G5:2 A5:2 G5:2', 'F5 A5 C6:2 A5:2 F5:2', 'E5:2 D5:2 C5:2 E5:2', 'D5:2 B4:2 C5:4'),
    },
    {
      role: 'bass', wave: 'triangle',
      gain: 0.9,
      pattern: bars('C3:2 G3:2 C3:2 G3:2', 'D3:2 A3:2 D3:2 A3:2', 'C3:2 G3:2 C3:2 G3:2', 'G2:2 D3:2 G2:2 D3:2', 'C3:2 G3:2 C3:2 G3:2', 'F2:2 C3:2 F2:2 C3:2', 'C3:2 G3:2 G2:2 D3:2', 'G2:2 D3:2 G2:4'),
    },
    { role: 'drums', wave: 'noise', gain: 0.2, pattern: rep('-:1 h -:1 h -:1 h -:1 h', 8) },
  ],
};

export const TRACKS: Record<TrackId, Track> = { tavern, title, dungeon, mine, lakeside, farm };
