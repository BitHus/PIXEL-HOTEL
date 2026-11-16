// Sounds made in code with the Web Audio API (atmosphere step): no files. Quiet by default. The
// audio context is only made after the first tap or key (browsers do not allow sound before).

import type { Rank } from '@pixel-hotel/shared';

export type SoundName = 'step' | 'coin' | 'bell' | 'pop' | 'click' | 'hit' | 'hurt' | 'clink' | 'murmur' | 'pour' | 'kill' | 'chestOpen' | 'windup' | 'levelUp' | 'stairs' | 'found' | 'cast' | 'splash' | 'reelTick' | 'rustle' | 'door' | 'arrive' | 'ready' | 'collect' | 'uiOpen' | 'uiClose';

/** The ping of a find, by rank: the rarer, the higher (G5, B5, E6, G6). */
const FOUND_HZ: Record<Rank, number> = { common: 784, rare: 988, ultra_rare: 1319, legendary: 1568 };

/** The same sound is never started twice within this many ms. */
export const MIN_GAP_MS: Record<SoundName, number> = { step: 120, coin: 60, bell: 6000, pop: 60, click: 40, hit: 50, hurt: 80, clink: 120, murmur: 12000, pour: 600, kill: 70, chestOpen: 300, windup: 250, levelUp: 1000, stairs: 500, found: 90, cast: 300, splash: 150, reelTick: 90, rustle: 120, door: 400, arrive: 1500, ready: 2500, collect: 120, uiOpen: 120, uiClose: 120 };

type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<SoundName, number>();
  private stepFlip = false;
  private ambienceWanted: 'tavern' | null = null;
  private crowd = 0;
  private ambienceSources: AudioBufferSourceNode[] = [];
  private murmurGain: GainNode | null = null;
  private ambienceTimer = 0;

  constructor(
    private enabled: boolean,
    private volume: number,
  ) {}

  /** Call from the first tap or key press: makes (or wakes) the audio context. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.connect(this.ctx.destination);
        this.applyVolume();
        // Half a second of white noise, reused by every noisy sound.
        const n = Math.floor(this.ctx.sampleRate / 2);
        this.noise = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      this.syncAmbience(); // an ambience asked for before the first tap starts now
    } catch {
      // No sound on this device: the game goes on silently.
      this.ctx = null;
    }
  }

  /** Unlocks on the first tap or key anywhere. */
  listenForFirstTap(): void {
    const go = (): void => this.unlock();
    window.addEventListener('pointerdown', go, { capture: true, passive: true });
    window.addEventListener('keydown', go, { capture: true, passive: true });
  }

  /**
   * A warm ambient bed for a place (AU-1): a low room rumble, a murmur that grows with `crowd` (0 to 1), and now and then a soft lute-like note.
   * Synthesised, quiet, follows the sound setting (the master gain) and stops with `null`. Safe to call before the first tap: it starts on unlock.
   */
  setAmbience(scene: 'tavern' | null, crowd = 0): void {
    this.ambienceWanted = scene;
    this.crowd = Math.max(0, Math.min(1, crowd));
    if (this.murmurGain) this.murmurGain.gain.value = 0.015 + 0.05 * this.crowd;
    this.syncAmbience();
  }

  private syncAmbience(): void {
    const ctx = this.ctx;
    if (this.ambienceWanted === null || !ctx || !this.master || !this.noise) {
      this.stopAmbience();
      return;
    }
    if (this.ambienceSources.length > 0) return;
    const master = this.master;
    const noise = this.noise;
    const loop = (freq: number, gain: number): GainNode => {
      const src = ctx.createBufferSource();
      src.buffer = noise;
      src.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(f).connect(g).connect(master);
      src.start();
      this.ambienceSources.push(src);
      return g;
    };
    loop(160, 0.03);
    this.murmurGain = loop(420, 0.015 + 0.05 * this.crowd);
    const notes = [196, 220, 261.6, 294, 392]; // a calm pentatonic
    const next = (): void => {
      this.ambienceTimer = window.setTimeout(() => {
        if (this.ambienceSources.length === 0) return;
        if (this.ctx?.state === 'running' && this.enabled && Math.random() < 0.7) {
          const hz = notes[Math.floor(Math.random() * notes.length)]!;
          this.tone('triangle', hz, hz, 1.6, 0.012, 0, 0.03);
        }
        next();
      }, 3500 + Math.random() * 5000);
    };
    next();
  }

  private stopAmbience(): void {
    if (this.ambienceTimer) window.clearTimeout(this.ambienceTimer);
    this.ambienceTimer = 0;
    for (const s of this.ambienceSources) {
      try {
        s.stop();
      } catch {
        // already stopped
      }
    }
    this.ambienceSources = [];
    this.murmurGain = null;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.applyVolume();
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyVolume();
  }

  private applyVolume(): void {
    // Squared: the slider feels even to the ear.
    if (this.master) this.master.gain.value = this.enabled ? this.volume * this.volume : 0;
  }

  /** `rank` only matters for 'found': a rank-pitched ping, rarer = higher. */
  play(name: SoundName, rank: Rank = 'common', pitch = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.enabled || this.volume <= 0 || ctx.state !== 'running') return;
    const nowMs = ctx.currentTime * 1000;
    if (nowMs - (this.last.get(name) ?? -1e9) < MIN_GAP_MS[name]) return;
    this.last.set(name, nowMs);
    switch (name) {
      case 'step':
        this.stepFlip = !this.stepFlip;
        this.hiss(0.05, 0.1, 'lowpass', this.stepFlip ? 420 : 520);
        break;
      case 'coin':
        this.tone('triangle', 1320, 1320, 0.07, 0.16);
        this.tone('triangle', 1760, 1760, 0.12, 0.16, 0.07);
        break;
      case 'bell':
        // A soft two-note door chime: low, quiet, with a slow start (the old bell was high and sharp).
        this.tone('sine', 659, 659, 0.9, 0.045, 0, 0.06);
        this.tone('sine', 880, 880, 1.1, 0.035, 0.16, 0.06);
        break;
      case 'pop':
        this.tone('sine', 280, 620, 0.1, 0.24);
        break;
      case 'click':
        this.tone('triangle', 880, 620, 0.035, 0.1);
        break;
      case 'hit':
        this.hiss(0.06, 0.2, 'bandpass', 1800);
        this.tone('square', 170, 90, 0.07, 0.08);
        break;
      case 'clink':
        // A mug set down: two quick glassy notes.
        this.tone('triangle', 2093, 2093, 0.09, 0.07);
        this.tone('triangle', 2637, 2637, 0.14, 0.05, 0.05);
        break;
      case 'pour':
        // Beer from a tap: a soft rushing hiss for the pour, a low gurgle under it.
        this.hiss(0.7, 0.07, 'bandpass', 1400);
        this.tone('sine', 220, 150, 0.7, 0.04);
        break;
      case 'murmur':
        // Soft talk in the room: a slow swell of low, muffled noise.
        this.hiss(1.4, 0.05, 'lowpass', 380);
        break;
      case 'hurt':
        this.tone('sawtooth', 300, 110, 0.2, 0.12);
        this.hiss(0.1, 0.12, 'lowpass', 900);
        break;
      case 'kill':
        // A dull burst: a low thump that drops, and a soft rush of noise.
        this.tone('square', 220, 60, 0.14, 0.09);
        this.hiss(0.1, 0.1, 'lowpass', 700);
        break;
      case 'chestOpen':
        // A creaking lid, then a small sparkle.
        this.tone('sawtooth', 120, 230, 0.22, 0.045);
        this.tone('triangle', 1047, 1568, 0.2, 0.07, 0.2);
        break;
      case 'windup':
        // A rising warning growl.
        this.tone('sawtooth', 170, 340, 0.28, 0.045);
        break;
      case 'levelUp':
        // A bright four-note run.
        [523, 659, 784, 1047].forEach((f, i) => this.tone('triangle', f, f, 0.22, 0.09, i * 0.09));
        break;
      case 'stairs':
        // Steps going down: a falling note and a soft scuff.
        this.tone('sine', 330, 165, 0.35, 0.08);
        this.hiss(0.12, 0.06, 'lowpass', 500);
        break;
      case 'cast':
        // A rod swish: a quick falling hiss.
        this.hiss(0.18, 0.08, 'bandpass', 2400);
        this.tone('sine', 520, 260, 0.12, 0.04);
        break;
      case 'splash':
        this.hiss(0.22, 0.1, 'bandpass', 1100);
        this.tone('sine', 420, 180, 0.12, 0.05);
        break;
      case 'reelTick': {
        const hz = 440 + 760 * Math.max(0, Math.min(1, pitch));
        this.tone('triangle', hz, hz, 0.05, 0.07);
        break;
      }
      case 'rustle':
        this.hiss(0.16, 0.07, 'highpass', 3000);
        break;
      case 'door':
        // A wooden door: a low creak that slides, then a soft thud.
        this.tone('sawtooth', 140, 190, 0.18, 0.03);
        this.tone('sine', 90, 55, 0.14, 0.09, 0.16);
        this.hiss(0.08, 0.05, 'lowpass', 500);
        break;
      case 'arrive':
        // A guest comes in: the latch, then the soft door chime.
        this.hiss(0.05, 0.05, 'bandpass', 1500);
        this.tone('sine', 659, 659, 0.8, 0.04, 0.08, 0.05);
        this.tone('sine', 988, 988, 0.9, 0.03, 0.22, 0.05);
        break;
      case 'ready':
        // A batch or brew is ready: a warm two-note "ding-ding".
        this.tone('triangle', 784, 784, 0.25, 0.07);
        this.tone('triangle', 1175, 1175, 0.4, 0.07, 0.14);
        break;
      case 'collect':
        // Taking something from a stove or barrel: a rising pop and a clink.
        this.tone('sine', 330, 700, 0.09, 0.2);
        this.tone('triangle', 1568, 1568, 0.12, 0.06, 0.07);
        break;
      case 'uiOpen':
        this.tone('triangle', 520, 780, 0.07, 0.07);
        break;
      case 'uiClose':
        this.tone('triangle', 700, 440, 0.07, 0.06);
        break;
      case 'found':
        this.tone('triangle', FOUND_HZ[rank], FOUND_HZ[rank], 0.16, 0.08);
        if (rank === 'ultra_rare' || rank === 'legendary') this.tone('triangle', FOUND_HZ[rank] * 1.5, FOUND_HZ[rank] * 1.5, 0.22, 0.06, 0.08);
        break;
    }
  }

  /** One note that fades out; the pitch slides from f0 to f1. */
  private tone(wave: Wave, f0: number, f1: number, seconds: number, gain: number, delay = 0, attack = 0.005): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + seconds);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  }

  /** A short burst of filtered noise. */
  private hiss(seconds: number, gain: number, filter: BiquadFilterType, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 0.3, seconds + 0.02);
  }
}
