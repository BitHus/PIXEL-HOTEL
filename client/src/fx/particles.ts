// A particle pool (outdoors rework C11): every particle object is made once at construction and reused, so a spawn allocates nothing. At most
// `cap` live at a time (FX_MAX_PARTICLES): a spawn over the cap is dropped. Pure data and motion; the renderer draws what forEach gives it.

import { FX_MAX_PARTICLES } from '@pixel-hotel/shared';

export type ParticleKind = 'spark' | 'goo' | 'bone' | 'feather' | 'dust' | 'debris' | 'leaf' | 'drop';

export interface Particle {
  alive: boolean;
  kind: ParticleKind;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** px/s^2 added to vy (0 for floaters, positive = falls). */
  gravity: number;
  ageMs: number;
  lifeMs: number;
  /** Side in px. */
  size: number;
  /** 0xRRGGBB. */
  color: number;
  /** A particle that falls past this y lands: it bounces up with `bounce` of its speed (0 = it stays). Infinity = no floor. */
  floorY: number;
  bounce: number;
}

export class ParticlePool {
  private readonly items: Particle[];
  private readonly free: number[];
  private live = 0;

  constructor(readonly cap: number = FX_MAX_PARTICLES) {
    this.items = Array.from({ length: cap }, () => ({ alive: false, kind: 'spark' as ParticleKind, x: 0, y: 0, vx: 0, vy: 0, gravity: 0, ageMs: 0, lifeMs: 1, size: 1, color: 0xffffff, floorY: Infinity, bounce: 0 }));
    this.free = Array.from({ length: cap }, (_, i) => cap - 1 - i);
  }

  get count(): number {
    return this.live;
  }

  /** Starts a particle, or returns null when the pool is full. */
  spawn(kind: ParticleKind, x: number, y: number, vx: number, vy: number, lifeMs: number, size: number, color: number, gravity = 0, floorY = Infinity, bounce = 0): Particle | null {
    const i = this.free.pop();
    if (i === undefined) return null;
    const p = this.items[i]!;
    p.alive = true;
    p.kind = kind;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.gravity = gravity;
    p.ageMs = 0;
    p.lifeMs = Math.max(1, lifeMs);
    p.size = size;
    p.color = color;
    p.floorY = floorY;
    p.bounce = bounce;
    this.live++;
    return p;
  }

  update(dtMs: number): void {
    const dt = dtMs / 1000;
    for (let i = 0; i < this.items.length; i++) {
      const p = this.items[i]!;
      if (!p.alive) continue;
      p.ageMs += dtMs;
      if (p.ageMs >= p.lifeMs) {
        p.alive = false;
        this.free.push(i);
        this.live--;
        continue;
      }
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y >= p.floorY && p.vy > 0) {
        p.y = p.floorY;
        p.vy = p.vy * p.bounce > 24 ? -p.vy * p.bounce : 0;
        p.vx *= 0.6;
      }
    }
  }

  /** Calls fn for every live particle (do not keep the object: it is reused). */
  forEach(fn: (p: Particle) => void): void {
    for (const p of this.items) if (p.alive) fn(p);
  }

  clear(): void {
    this.free.length = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      this.items[i]!.alive = false;
      this.free.push(i);
    }
    this.live = 0;
  }
}
