// Sounds made in code with the Web Audio API (atmosphere step): no files. Quiet by default. The
// audio context is only made after the first tap or key (browsers do not allow sound before).

export type SoundName = 'step' | 'coin' | 'bell' | 'pop' | 'click' | 'hit' | 'hurt';

/** The same sound is never started twice within this many ms. */
const MIN_GAP_MS: Record<SoundName, number> = { step: 120, coin: 60, bell: 300, pop: 60, click: 40, hit: 50, hurt: 80 };

type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private readonly last = new Map<SoundName, number>();
  private stepFlip = false;

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

  play(name: SoundName): void {
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
        this.tone('sine', 1568, 1568, 0.7, 0.13);
        this.tone('sine', 2349, 2349, 0.4, 0.05);
        this.tone('sine', 1245, 1245, 0.8, 0.11, 0.2);
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
      case 'hurt':
        this.tone('sawtooth', 300, 110, 0.2, 0.12);
        this.hiss(0.1, 0.12, 'lowpass', 900);
        break;
    }
  }

  /** One note that fades out; the pitch slides from f0 to f1. */
  private tone(wave: Wave, f0: number, f1: number, seconds: number, gain: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = wave;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + seconds);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
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
