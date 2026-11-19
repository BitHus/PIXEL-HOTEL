// The music player (AU-2): thin Web Audio wrapper around the pure sequencer. A look-ahead scheduler (a timer every 100 ms
// schedules the next 0.5 s of notes), one gain bus per track so a room change is an equal-power crossfade, no per-frame work.

import { TRACKS, type TrackId } from './musicData.ts';
import { crossfadeGains, eventsBetween, fadePlan, loopSteps, noteHz, parseTrack, stepSeconds, volumeGain, type ParsedVoice } from './sequencer.ts';

const TICK_MS = 100;
const LOOKAHEAD_S = 0.5;
/** Crossfade length, seconds. */
export const FADE_S = 1.6;
/** Per-note peak gain at voice gain 1 (the bus is further scaled by the music volume). */
const NOTE_PEAK = 0.12;

interface Live {
  id: TrackId;
  bus: GainNode;
  voices: ParsedVoice[];
  /** AudioContext time of step 0 of the loop. */
  t0: number;
  /** Next absolute step to schedule. */
  next: number;
  stepS: number;
  loopLen: number;
}

export class Music {
  private ctx: AudioContext | null = null;
  private out: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private live: Live[] = [];
  private timer = 0;
  private wanted: TrackId | null = null;
  private enabled = true;
  private volume = 0.4;

  /** Called once the audio context exists (after the first tap). */
  attach(ctx: AudioContext, noise: AudioBuffer): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.connect(ctx.destination);
    this.applyVolume();
    this.sync();
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyVolume();
    this.sync();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
    this.sync();
  }

  /** The track for this place (null = none). Safe before the first tap: it starts on attach. */
  play(id: TrackId | null): void {
    this.wanted = id;
    this.sync();
  }

  private audible(): boolean {
    return this.enabled && this.volume > 0;
  }

  private applyVolume(): void {
    if (this.ctx && this.out) this.out.gain.setTargetAtTime(volumeGain(this.enabled, this.volume), this.ctx.currentTime, 0.03);
  }

  /** Brings the live tracks in line with `wanted` and starts or stops the timer. */
  private sync(): void {
    const ctx = this.ctx;
    if (!ctx || !this.out) return;
    const want = this.audible() ? this.wanted : null;
    const current = this.live.find((l) => !this.fading.has(l)) ?? null;
    const action = fadePlan(current?.id ?? null, want);
    if (action === 'stop') this.fadeOut(current!, ctx.currentTime, 0.4);
    else if (action === 'start' || action === 'crossfade') {
      if (current) this.fadeOut(current, ctx.currentTime, FADE_S);
      this.start(want!, action === 'crossfade' ? FADE_S : 0.5);
    }
    if (this.live.length > 0 && !this.timer) this.timer = window.setInterval(() => this.tick(), TICK_MS);
    if (this.live.length === 0 && this.timer) {
      window.clearInterval(this.timer);
      this.timer = 0;
    }
  }

  private readonly fading = new Set<Live>();

  private start(id: TrackId, fadeS: number): void {
    const ctx = this.ctx!;
    const { track, voices } = parseTrack(id);
    const bus = ctx.createGain();
    const now = ctx.currentTime;
    bus.gain.setValueAtTime(0, now);
    bus.gain.linearRampToValueAtTime(crossfadeGains(1).in, now + fadeS);
    bus.connect(this.out!);
    this.live.push({ id, bus, voices, t0: now + 0.05, next: 0, stepS: stepSeconds(track), loopLen: loopSteps(track) });
  }

  private fadeOut(l: Live, at: number, seconds: number): void {
    this.fading.add(l);
    l.bus.gain.cancelScheduledValues(at);
    l.bus.gain.setValueAtTime(l.bus.gain.value, at);
    l.bus.gain.linearRampToValueAtTime(0, at + seconds);
    window.setTimeout(() => {
      this.live = this.live.filter((x) => x !== l);
      this.fading.delete(l);
      try {
        l.bus.disconnect();
      } catch {
        // already gone
      }
      this.sync();
    }, seconds * 1000 + 150);
  }

  /** Pause when the tab is hidden, wake when it is back (the context is suspended by Sound). */
  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    for (const l of this.live) {
      // After a long pause the clock is far ahead of the schedule: skip to now instead of playing a burst.
      const nowStep = Math.floor((ctx.currentTime - l.t0) / l.stepS);
      if (l.next < nowStep) l.next = nowStep + 1;
      const to = Math.floor((ctx.currentTime + LOOKAHEAD_S - l.t0) / l.stepS) + 1;
      if (to <= l.next) continue;
      for (const v of l.voices) {
        for (const { event, at } of eventsBetween(v.events, l.loopLen, l.next, to)) this.note(l, v, event.note, l.t0 + at * l.stepS, event.len * l.stepS);
      }
      l.next = to;
    }
  }

  private note(l: Live, v: ParsedVoice, name: string, t: number, dur: number): void {
    const ctx = this.ctx!;
    const peak = NOTE_PEAK * v.gain;
    const g = ctx.createGain();
    g.connect(l.bus);
    if (v.wave === 'noise') {
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const f = ctx.createBiquadFilter();
      const kick = name === 'k';
      f.type = name === 'h' ? 'highpass' : kick ? 'lowpass' : 'bandpass';
      f.frequency.value = name === 'h' ? 6000 : kick ? 160 : 1800;
      const len = name === 'h' ? 0.04 : kick ? 0.12 : 0.1;
      g.gain.setValueAtTime(peak * (kick ? 2.2 : 1), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      src.connect(f).connect(g);
      src.start(t, 0, len + 0.02);
      return;
    }
    const hz = noteHz(name);
    if (hz === null) return;
    const osc = ctx.createOscillator();
    osc.type = v.wave as OscillatorType;
    osc.frequency.setValueAtTime(hz, t);
    const hold = Math.max(0.05, dur * 0.92);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.012);
    g.gain.setValueAtTime(peak * 0.8, t + hold * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0001, t + hold);
    osc.connect(g);
    osc.start(t);
    osc.stop(t + hold + 0.03);
  }

  /** Every known track id (for a debug listing). */
  static get ids(): TrackId[] {
    return Object.keys(TRACKS) as TrackId[];
  }
}
