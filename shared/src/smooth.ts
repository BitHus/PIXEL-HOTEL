// Smoothness helpers (pure): where a shown walker is drawn, and how a new path joins a walker that is already moving.

import type { Point } from './types.ts';

/** Rounds a value to a multiple of `step` (step <= 0: unchanged). Used to put sprites on whole DEVICE pixels instead of whole world pixels. */
export function snapToStep(v: number, step: number): number {
  return step > 0 ? Math.round(v / step) * step : v;
}

/**
 * A walker already moving gets a fresh path whose first point may lie just BEHIND it (the model
 * ticks every 100 ms, the walker is drawn every frame). Walking back to that point is a visible
 * stutter at every corner, so leading points the walker has already passed (it lies on the
 * segment to the next point, beyond the first) are dropped.
 */
export function skipPassed(pos: Point, path: readonly Point[], tolerance = 2): Point[] {
  let i = 0;
  while (i + 1 < path.length) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) {
      i++;
      continue;
    }
    const t = ((pos.x - a.x) * dx + (pos.y - a.y) * dy) / len2;
    if (t <= 0 || t > 1) break;
    if (Math.hypot(pos.x - (a.x + t * dx), pos.y - (a.y + t * dy)) > tolerance) break;
    i++;
  }
  return path.slice(i);
}

/** Frame times of the last N frames (ms): average and worst, for the debug line. */
export class FrameStats {
  private readonly times: number[] = [];
  private next = 0;
  constructor(private readonly size = 120) {}

  add(ms: number): void {
    if (this.times.length < this.size) this.times.push(ms);
    else this.times[this.next] = ms;
    this.next = (this.next + 1) % this.size;
  }

  get count(): number {
    return this.times.length;
  }

  get avg(): number {
    return this.times.length === 0 ? 0 : this.times.reduce((s, t) => s + t, 0) / this.times.length;
  }

  get max(): number {
    return this.times.reduce((m, t) => Math.max(m, t), 0);
  }

  /** "frame avg 16.7 ms (60 fps) max 21.0 ms" */
  text(): string {
    const avg = this.avg;
    return `frame avg ${avg.toFixed(1)} ms (${avg > 0 ? Math.round(1000 / avg) : 0} fps) max ${this.max.toFixed(1)} ms`;
  }
}
