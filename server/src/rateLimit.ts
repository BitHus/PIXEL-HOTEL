// Sliding-window rate limiter. Time is passed in (tests drive it). A hit is counted only when allowed.

export class RateLimiter {
  private readonly hits = new Map<string, number[]>();
  constructor(
    readonly max: number,
    readonly windowMs: number,
  ) {}

  /** True and counts the hit if the key is under its limit; false (not counted) otherwise. */
  take(key: string, now: number): boolean {
    const recent = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(now);
    this.hits.set(key, recent);
    return true;
  }

  /** Forgets keys with no recent hit (call now and then). */
  sweep(now: number): void {
    for (const [k, v] of this.hits) if (v.every((t) => now - t >= this.windowMs)) this.hits.delete(k);
  }
}
