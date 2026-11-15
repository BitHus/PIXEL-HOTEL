// Hit-stop (outdoors rework C11): a short freeze of the DRAWING on a hit. It is render-side only: the run keeps its real-time ticks (the caller
// keeps feeding api.dungeonAdvance the real dt); only the view and the effects clock hold still while this is active.

export class HitStop {
  private leftMs = 0;

  /** Starts (or extends to) a freeze of `ms`; a shorter one never cuts a longer one short. */
  trigger(ms: number): void {
    if (ms > this.leftMs) this.leftMs = ms;
  }

  get active(): boolean {
    return this.leftMs > 0;
  }

  /** Spends dt on the freeze and returns what is left of dt for drawing (all of it when not frozen, 0 while frozen). */
  consume(dtMs: number): number {
    if (this.leftMs <= 0) return dtMs;
    const used = Math.min(this.leftMs, Math.max(0, dtMs));
    this.leftMs -= used;
    return dtMs - used;
  }

  clear(): void {
    this.leftMs = 0;
  }
}

/** What one frame spends: the run always gets the real dt; only the drawing can be held back. */
export interface FrameTimes {
  /** ms for api.dungeonAdvance: always the full dt (hit-stop never delays the run). */
  runMs: number;
  /** ms for the view and the effects. */
  drawMs: number;
  /** True = draw nothing this frame (the picture holds still). */
  skipDraw: boolean;
}

export function frameTimes(dtMs: number, stop: HitStop): FrameTimes {
  const wasActive = stop.active;
  const drawMs = stop.consume(dtMs);
  return { runMs: dtMs, drawMs, skipDraw: wasActive && drawMs <= 0 };
}
