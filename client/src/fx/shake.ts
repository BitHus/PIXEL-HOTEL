// Screen shake (outdoors rework C11): a whole-pixel offset whose size decays to 0, with SEEDED noise instead of sin(clock), so it never drifts
// or hums and the same kick always shakes the same way. Pure: the caller keeps the time. Units are the caller's (the dungeon: screen px).

/** Deterministic noise in [0, 1) from a seed and a step number. */
export function hash01(seed: number, step: number): number {
  let h = (Math.imul(seed | 0, 374761393) + Math.imul(step | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/** The shake size after `elapsedMs` of `totalMs`: whole px, falling to 0 (and 0 from totalMs on). */
export function shakeAmplitude(px: number, elapsedMs: number, totalMs: number): number {
  if (px <= 0 || totalMs <= 0 || elapsedMs >= totalMs) return 0;
  return Math.round(px * (1 - Math.max(0, elapsedMs) / totalMs));
}

/** One whole-pixel offset: the noise changes every `stepMs`, scaled by the decaying amplitude. */
export function shakeOffset(px: number, elapsedMs: number, totalMs: number, seed: number, stepMs: number): { x: number; y: number } {
  const amp = shakeAmplitude(px, elapsedMs, totalMs);
  if (amp === 0) return { x: 0, y: 0 };
  const step = Math.floor(Math.max(0, elapsedMs) / Math.max(1, stepMs));
  return { x: Math.round((hash01(seed, step * 2) * 2 - 1) * amp), y: Math.round((hash01(seed, step * 2 + 1) * 2 - 1) * amp) };
}

/** The running shake. A kick only replaces a weaker one that still runs (a hard hit is not cut short by a light one). */
export class Shake {
  private px = 0;
  private totalMs = 0;
  private elapsedMs = 0;
  private seed = 1;

  constructor(private readonly stepMs: number) {}

  kick(px: number, totalMs: number): void {
    if (this.active && shakeAmplitude(this.px, this.elapsedMs, this.totalMs) > px) return;
    this.px = px;
    this.totalMs = totalMs;
    this.elapsedMs = 0;
    this.seed++;
  }

  get active(): boolean {
    return this.elapsedMs < this.totalMs;
  }

  /** Advances by dt and returns the offset for this frame. */
  update(dtMs: number): { x: number; y: number } {
    if (!this.active) return { x: 0, y: 0 };
    this.elapsedMs += dtMs;
    return shakeOffset(this.px, this.elapsedMs, this.totalMs, this.seed, this.stepMs);
  }

  clear(): void {
    this.px = 0;
    this.totalMs = 0;
    this.elapsedMs = 0;
  }
}
