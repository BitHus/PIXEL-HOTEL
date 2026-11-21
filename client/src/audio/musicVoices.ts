// Music voices (OB-9): the Web Audio synths for one note each. Every voice goes through its own small filter and envelope, uses
// detuned oscillator pairs and ends with setTargetAtTime releases (no clicks). Nothing here keeps state; the graph (buses, sends) is built in music.ts.

import type { DrumKit } from './musicData.ts';

export interface VoiceEnv {
  ctx: AudioContext;
  noise: AudioBuffer;
  /** 25% pulse wave for the reedy square voices. */
  pulse: PeriodicWave;
}

/** Peak gain of a note at voice gain 1 and velocity 1. */
export const NOTE_PEAK = 0.12;

function osc(e: VoiceEnv, wave: string, hz: number, detune: number, t: number): OscillatorNode {
  const o = e.ctx.createOscillator();
  if (wave === 'square') o.setPeriodicWave(e.pulse);
  else o.type = wave as OscillatorType;
  o.frequency.setValueAtTime(hz, t);
  o.detune.setValueAtTime(detune, t);
  return o;
}

function lowpass(e: VoiceEnv, hz: number, q = 0.7): BiquadFilterNode {
  const f = e.ctx.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = hz;
  f.Q.value = q;
  return f;
}

/** Folk fiddle / whistle: two detuned oscillators + a triangle octave up, a plucky filter fall, vibrato on long notes. */
export function playLead(e: VoiceEnv, out: AudioNode, wave: string, hz: number, t: number, dur: number, peak: number, cents: number): void {
  const hold = Math.max(0.08, dur * 0.95);
  const f = lowpass(e, 3200, 1.2);
  f.frequency.setValueAtTime(3200, t);
  f.frequency.setTargetAtTime(1400, t + 0.02, 0.12);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak * 0.85, t + 0.015);
  g.gain.setTargetAtTime(peak * 0.85 * 0.55, t + 0.015, 0.05);
  g.gain.setTargetAtTime(0.0001, t + hold, 0.06);
  f.connect(g).connect(out);
  const end = t + hold + 0.5;
  const a = osc(e, wave, hz, 7 + cents, t);
  const b = osc(e, wave, hz, -7 + cents, t);
  const c = osc(e, 'triangle', hz * 2, cents, t);
  const ga = e.ctx.createGain();
  ga.gain.value = 0.5;
  const gb = e.ctx.createGain();
  gb.gain.value = 0.5;
  const gc = e.ctx.createGain();
  gc.gain.value = 0.15;
  a.connect(ga).connect(f);
  b.connect(gb).connect(f);
  c.connect(gc).connect(f);
  for (const o of [a, b, c]) {
    o.start(t);
    o.stop(end);
  }
  if (dur > 0.3) {
    const lfo = e.ctx.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = e.ctx.createGain();
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + 0.2);
    depth.gain.linearRampToValueAtTime(8, t + 0.45);
    lfo.connect(depth);
    depth.connect(a.detune);
    depth.connect(b.detune);
    lfo.start(t);
    lfo.stop(end);
  }
}

/** Upright bass: triangle + a sine an octave below (when audible), lowpass 600 Hz, staccato. */
export function playBass(e: VoiceEnv, out: AudioNode, hz: number, t: number, dur: number, peak: number): void {
  const hold = Math.max(0.06, dur * 0.7);
  const f = lowpass(e, 600);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.008);
  g.gain.setTargetAtTime(peak * 0.6, t + 0.008, 0.06);
  g.gain.setTargetAtTime(0.0001, t + hold, 0.035);
  f.connect(g).connect(out);
  const a = osc(e, 'triangle', hz, 0, t);
  a.connect(f);
  a.start(t);
  a.stop(t + hold + 0.3);
  if (hz >= 55) {
    const sub = osc(e, 'sine', hz / 2, 0, t);
    const gs = e.ctx.createGain();
    gs.gain.value = 0.5;
    sub.connect(gs).connect(f);
    sub.start(t);
    sub.stop(t + hold + 0.3);
  }
}

/** A soft glassy bell: a sine plus an inharmonic partial, long decay. */
export function playBell(e: VoiceEnv, out: AudioNode, hz: number, t: number, peak: number): void {
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.002);
  g.gain.setTargetAtTime(0.0001, t + 0.01, 0.35);
  g.connect(out);
  for (const [mul, level] of [[1, 1], [2.76, 0.22]] as const) {
    const o = osc(e, 'sine', hz * mul, 0, t);
    const gi = e.ctx.createGain();
    gi.gain.value = level;
    o.connect(gi).connect(g);
    o.start(t);
    o.stop(t + 2.2);
  }
}

/** Low drone: a saw through a very dark lowpass whose cutoff drifts (LFO 0.1 Hz), plus an audible octave sine. */
export function playDrone(e: VoiceEnv, out: AudioNode, hz: number, t: number, dur: number, peak: number): void {
  const f = lowpass(e, 200);
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 0.1;
  const depth = e.ctx.createGain();
  depth.gain.value = 70;
  lfo.connect(depth).connect(f.frequency);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.4);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.25);
  f.connect(g).connect(out);
  const saw = osc(e, 'sawtooth', hz, 0, t);
  const oct = osc(e, 'sine', hz * 2, 0, t);
  const go = e.ctx.createGain();
  go.gain.value = 0.5;
  saw.connect(f);
  oct.connect(go).connect(g);
  const end = t + dur + 1.5;
  for (const o of [saw, oct, lfo]) {
    o.start(t);
    o.stop(end);
  }
}

/** Pad: each chord tone as a detuned pair (+6 / -6 cents), slow attack, one lowpass with a slow filter LFO. */
export function playPad(e: VoiceEnv, out: AudioNode, hzs: readonly number[], t: number, dur: number, peak: number): void {
  const f = lowpass(e, 1500);
  const lfo = e.ctx.createOscillator();
  lfo.frequency.value = 0.15;
  const depth = e.ctx.createGain();
  depth.gain.value = 300;
  lfo.connect(depth).connect(f.frequency);
  const g = e.ctx.createGain();
  const attack = Math.min(0.6, dur * 0.4);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.setTargetAtTime(0.0001, t + dur, 0.3);
  f.connect(g).connect(out);
  const end = t + dur + 2.2;
  lfo.start(t);
  lfo.stop(end);
  for (const hz of hzs) {
    for (const d of [6, -6]) {
      const o = osc(e, 'triangle', hz, d, t);
      const gi = e.ctx.createGain();
      gi.gain.value = 1 / hzs.length;
      o.connect(gi).connect(f);
      o.start(t);
      o.stop(end);
    }
  }
}

/** Pluck for the arp: a short square (pulse) or triangle note, lowpass 2.5 kHz, no sustain. */
export function playPluck(e: VoiceEnv, out: AudioNode, wave: string, hz: number, t: number, peak: number): void {
  const f = lowpass(e, 2500);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.003);
  g.gain.setTargetAtTime(0.0001, t + 0.003, 0.035);
  f.connect(g).connect(out);
  const o = osc(e, wave, hz, 0, t);
  o.connect(f);
  o.start(t);
  o.stop(t + 0.35);
}

function noiseHit(e: VoiceEnv, out: AudioNode, type: BiquadFilterType, hz: number, q: number, t: number, len: number, peak: number, attack: number, offset: number): void {
  const src = e.ctx.createBufferSource();
  src.buffer = e.noise;
  const f = e.ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = hz;
  f.Q.value = q;
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(out);
  src.start(t, offset, len + 0.03);
}

function sineDrop(e: VoiceEnv, out: AudioNode, from: number, to: number, drop: number, t: number, len: number, peak: number): void {
  const o = e.ctx.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + drop);
  const g = e.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(peak, t + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + len + 0.03);
}

/** One drum hit: k kick (jig = soft stomp, tom = slow low tom), s snare (bandpass noise + a 190 Hz body), h hat (jig) or shaker. */
export function playDrum(e: VoiceEnv, out: AudioNode, kit: DrumKit, name: string, t: number, peak: number, offset: number): void {
  if (name === 'k') {
    if (kit === 'tom') sineDrop(e, out, 90, 55, 0.2, t, 0.4, peak * 1.6);
    else if (kit === 'jig') sineDrop(e, out, 120, 48, 0.12, t, 0.2, peak * 1.8);
    return;
  }
  if (kit === 'shaker') {
    if (name === 'h') noiseHit(e, out, 'bandpass', 5000, 1, t, 0.07, peak * 1.2, 0.02, offset);
    return;
  }
  if (kit === 'tom') return;
  if (name === 's') {
    noiseHit(e, out, 'bandpass', 1800, 0.8, t, 0.12, peak, 0.002, offset);
    sineDrop(e, out, 190, 170, 0.05, t, 0.07, peak * 0.8);
  } else if (name === 'h') noiseHit(e, out, 'highpass', 7000, 0.7, t, 0.04, peak * 0.8, 0.001, offset);
}
