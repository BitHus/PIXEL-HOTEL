// The music player (AU-2, OB-9): thin Web Audio wrapper around the pure sequencer. A look-ahead scheduler (a timer every 100 ms
// schedules the next 0.5 s of notes), one gain bus per track so a room change is an equal-power crossfade, no per-frame work.
// OB-9 graph (built once in attach): track buses -> mix -> compressor -> lowpass 7 kHz -> out; sends: reverb (generated impulse,
// 20 ms pre-delay) and a dotted-eighth echo with a darkening feedback. Voices live in musicVoices.ts, pure form maths in musicForm.ts.

import { TRACKS, type Track, type TrackId, type VoiceRole } from './musicData.ts';
import { makeImpulse, pulseCoeffs } from './musicFx.ts';
import { accentFor, arcLevel, chordNotes, dottedEighth, dropout, humanize, leadTranspose, mulberry32, sectionOf, swingDelay } from './musicForm.ts';
import { NOTE_PEAK, playBass, playBell, playDrone, playDrum, playLead, playPad, playPluck, type VoiceEnv } from './musicVoices.ts';
import { crossfadeGains, eventsBetween, fadePlan, loopSteps, noteHz, parseTrack, stepSeconds, volumeGain, type NoteEvent, type ParsedVoice } from './sequencer.ts';

const TICK_MS = 100;
const LOOKAHEAD_S = 0.5;
/** Crossfade length, seconds. */
export const FADE_S = 1.6;
/** Headroom: pad and arp are new layers, so every voice sits 25% lower (the compressor does the rest). */
const MIX = 0.75;
/** Send levels per role: [reverb, echo]. Bass stays dry. */
const SENDS: Record<VoiceRole, [number, number]> = { lead: [0.25, 0.18], pad: [0.35, 0], bass: [0, 0], drums: [0.1, 0], arp: [0.15, 0.25], bell: [0.35, 0.2], drone: [0.2, 0] };

interface Live {
  id: TrackId;
  track: Track;
  bus: GainNode;
  /** Reverb and echo send buses: faded together with `bus`. */
  revBus: GainNode;
  delBus: GainNode;
  roles: Map<VoiceRole, GainNode>;
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
  private env: VoiceEnv | null = null;
  private mix: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  private revIn: GainNode | null = null;
  private delay: DelayNode | null = null;
  private readonly impulses = new Map<string, AudioBuffer>();
  private readonly rng = mulberry32(0x0b9);

  /** Called once the audio context exists (after the first tap). */
  attach(ctx: AudioContext, noise: AudioBuffer): void {
    if (this.ctx) return;
    this.ctx = ctx;
    this.noise = noise;
    this.out = ctx.createGain();
    this.out.connect(ctx.destination);
    const pc = pulseCoeffs(0.25);
    this.env = { ctx, noise, pulse: ctx.createPeriodicWave(pc.real, pc.imag) };
    this.buildGraph(ctx, this.out);
    this.applyVolume();
    this.sync();
  }

  /** Master chain, reverb and echo: created once, shared by every track. */
  private buildGraph(ctx: AudioContext, out: AudioNode): void {
    const mix = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 3;
    comp.attack.value = 0.01;
    comp.release.value = 0.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;
    mix.connect(comp).connect(lp).connect(out);
    this.mix = mix;
    // reverb: pre-delay -> generated impulse -> return
    this.revIn = ctx.createGain();
    const pre = ctx.createDelay(0.1);
    pre.delayTime.value = 0.02;
    this.convolver = ctx.createConvolver();
    const back = ctx.createGain();
    back.gain.value = 0.5;
    this.revIn.connect(pre).connect(this.convolver).connect(back).connect(mix);
    // echo: dotted eighth, feedback 0.3 through a lowpass at 2.4 kHz (each repeat darker)
    this.delay = ctx.createDelay(2);
    this.delay.delayTime.value = dottedEighth(100);
    const fb = ctx.createGain();
    fb.gain.value = 0.3;
    const fbLp = ctx.createBiquadFilter();
    fbLp.type = 'lowpass';
    fbLp.frequency.value = 2400;
    this.delay.connect(fbLp).connect(fb).connect(this.delay);
    this.delay.connect(mix);
  }

  /** The generated reverb impulse of a track (cached by tail length and damping). */
  private impulseFor(track: Track): AudioBuffer {
    const ctx = this.ctx!;
    const { seconds, damp } = track.reverb;
    const key = `${seconds}-${damp}`;
    let buf = this.impulses.get(key);
    if (!buf) {
      const [l, r] = makeImpulse(ctx.sampleRate, seconds, damp);
      buf = ctx.createBuffer(2, l.length, ctx.sampleRate);
      buf.getChannelData(0).set(l);
      buf.getChannelData(1).set(r);
      this.impulses.set(key, buf);
    }
    return buf;
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
    const now = ctx.currentTime;
    const mk = (to: AudioNode): GainNode => {
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(crossfadeGains(1).in, now + fadeS);
      g.connect(to);
      return g;
    };
    const bus = mk(this.mix!);
    const revBus = mk(this.revIn!);
    const delBus = mk(this.delay!);
    // the room and the echo follow the newest track (the old one fades out through them)
    if (this.convolver) this.convolver.buffer = this.impulseFor(track);
    if (this.delay) this.delay.delayTime.setValueAtTime(dottedEighth(track.bpm), now);
    this.live.push({ id, track, bus, revBus, delBus, roles: new Map(), voices, t0: now + 0.05, next: 0, stepS: stepSeconds(track), loopLen: loopSteps(track) });
  }

  private fadeOut(l: Live, at: number, seconds: number): void {
    this.fading.add(l);
    for (const b of [l.bus, l.revBus, l.delBus]) {
      b.gain.cancelScheduledValues(at);
      b.gain.setValueAtTime(b.gain.value, at);
      b.gain.linearRampToValueAtTime(0, at + seconds);
    }
    window.setTimeout(() => {
      this.live = this.live.filter((x) => x !== l);
      this.fading.delete(l);
      try {
        l.bus.disconnect();
        l.revBus.disconnect();
        l.delBus.disconnect();
        for (const r of l.roles.values()) r.disconnect();
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
        for (const { event, at } of eventsBetween(v.events, l.loopLen, l.next, to)) this.note(l, v, event, at);
      }
      l.next = to;
    }
  }

  /** The bus of a role in a live track: dry into the track bus, plus its reverb and echo sends. Made once per role. */
  private roleBus(l: Live, role: VoiceRole): GainNode {
    let g = l.roles.get(role);
    if (!g) {
      const ctx = this.ctx!;
      g = ctx.createGain();
      g.connect(l.bus);
      const [rev, del] = SENDS[role];
      if (rev > 0) {
        const s = ctx.createGain();
        s.gain.value = rev * l.track.reverb.mix;
        g.connect(s).connect(l.revBus);
      }
      if (del > 0) {
        const s = ctx.createGain();
        s.gain.value = del;
        g.connect(s).connect(l.delBus);
      }
      l.roles.set(role, g);
    }
    return g;
  }

  /** One event: the arc (what plays in this part of the 16-bar form), dropouts, swing, then the humanised voice. */
  private note(l: Live, v: ParsedVoice, ev: NoteEvent, abs: number): void {
    const e = this.env;
    if (!e) return;
    const tr = l.track;
    const level = arcLevel(v.role, sectionOf(abs, tr.stepsPerBar));
    if (level <= 0 || dropout(v.role, ev.note, abs, tr.stepsPerBar)) return;
    const h = humanize(this.rng, v.role, ev.note, accentFor(abs % tr.stepsPerBar, tr.stepsPerBeat));
    const t = Math.max(this.ctx!.currentTime, l.t0 + abs * l.stepS + swingDelay(abs, tr.stepsPerBeat, tr.swing, l.stepS) + h.dt);
    const dur = ev.len * l.stepS;
    const peak = NOTE_PEAK * MIX * v.gain * level * h.vel;
    const out = this.roleBus(l, v.role);
    if (v.role === 'drums') {
      playDrum(e, out, tr.kit ?? 'jig', ev.note, t, peak, this.rng() * 0.3);
      return;
    }
    if (v.role === 'pad') {
      playPad(e, out, chordNotes(ev.note, 3).map((n) => noteHz(n) ?? 0), t, dur, peak);
      return;
    }
    let hz = noteHz(ev.note);
    if (hz === null) return;
    if (v.role === 'lead') {
      hz *= 2 ** (leadTranspose(Math.floor(abs / l.loopLen)) / 12);
      playLead(e, out, v.wave, hz, t, dur, peak, h.cents);
    } else if (v.role === 'bass') playBass(e, out, hz, t, dur, peak);
    else if (v.role === 'bell') playBell(e, out, hz, t, peak);
    else if (v.role === 'drone') playDrone(e, out, hz, t, dur, peak);
    else playPluck(e, out, tr.arp?.style === 'repeat' || tr.kit === 'shaker' ? 'square' : 'triangle', hz, t, peak);
  }

  /** Every known track id (for a debug listing). */
  static get ids(): TrackId[] {
    return Object.keys(TRACKS) as TrackId[];
  }
}
