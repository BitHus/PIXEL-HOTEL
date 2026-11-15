// The lakeside's particles and rings (outdoors rework C13): leaves, water drops and pixel-ellipse rings that grow on the water, and the fish that
// flies to the avatar. One ParticlePool (capped) plus pre-made sprites and pre-drawn ring Graphics: nothing is created or redrawn per frame.
// Whole-pixel positions; directions come from a seeded counter, never Math.random.

import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import { FX_MAX_PARTICLES, FX_RING_MS, PALETTE, RANK_COLORS, type Point, type Rank } from '@pixel-hotel/shared';
import { easeOutQuad } from '../fx/ease.ts';
import { ParticlePool } from '../fx/particles.ts';
import { hash01 } from '../fx/shake.ts';
import { DARK_WARM } from '../render/bareStyles.ts';

const hex = (css: string): number => parseInt(css.slice(1), 16);
const LEAVES = [hex(PALETTE[12]!), hex(PALETTE[13]!), hex(PALETTE[14]!)];
const DROPS = [hex(PALETTE[17]!), hex(PALETTE[18]!), hex(PALETTE[19]!)];
const RING_RADII = [3, 5, 7, 9, 11, 13, 15];
const RING_SLOTS = 4;

interface Ring {
  at: Point;
  ageMs: number;
}

/** A pixel ellipse outline (rx wide, rx / 2 high), 1 px thick, as rects. */
function drawRing(rx: number): Graphics {
  const g = new Graphics();
  const ry = Math.max(1, Math.round(rx / 2));
  const seen = new Set<string>();
  for (let a = 0; a < 64; a++) {
    const t = (a / 64) * Math.PI * 2;
    const x = Math.round(Math.cos(t) * rx);
    const y = Math.round(Math.sin(t) * ry);
    const key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    g.rect(x, y, 1, 1).fill(PALETTE[19]);
  }
  return g;
}

/** The little fish that flies to the avatar (silver, tinted by the rank): drawn once. */
function drawFishIcon(): Graphics {
  const g = new Graphics();
  g.rect(-7, -4, 14, 8).fill(DARK_WARM);
  g.rect(-6, -3, 9, 6).fill(PALETTE[20]);
  g.rect(3, -2, 3, 4).fill(PALETTE[21]);
  g.rect(-5, -2, 2, 1).fill(PALETTE[19]);
  g.rect(-4, -1, 1, 1).fill(PALETTE[24]);
  return g;
}

export class LakeFx {
  readonly container = new Container({ eventMode: 'none' });
  readonly pool = new ParticlePool(FX_MAX_PARTICLES);
  readonly prize = drawFishIcon();
  private readonly sprites: Sprite[] = [];
  private shown = 0;
  private counter = 1;
  private readonly rings: (Ring | null)[] = Array.from({ length: RING_SLOTS }, () => null);
  private readonly ringArt: Graphics[][] = [];

  constructor() {
    for (let i = 0; i < this.pool.cap; i++) {
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0.5);
      s.visible = false;
      this.sprites.push(s);
      this.container.addChild(s);
    }
    for (let slot = 0; slot < RING_SLOTS; slot++) {
      const set = RING_RADII.map((r) => {
        const g = drawRing(r);
        g.visible = false;
        this.container.addChild(g);
        return g;
      });
      this.ringArt.push(set);
    }
    this.prize.visible = false;
    this.container.addChild(this.prize);
  }

  private rand(): number {
    return hash01(0x1a4e, this.counter++);
  }

  private between(a: number, b: number): number {
    return a + (b - a) * this.rand();
  }

  /** Leaves that puff out of a crown and drift down. */
  leaves(at: Point, count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.spawn('leaf', at.x + this.between(-10, 10), at.y + this.between(-6, 6), this.between(-30, 30), this.between(-30, -5), this.between(520, 900), 2, LEAVES[i % LEAVES.length]!, 70);
    }
  }

  /** Water drops that jump up and fall back. */
  splash(at: Point, count: number): void {
    for (let i = 0; i < count; i++) {
      this.pool.spawn('drop', at.x, at.y, this.between(-34, 34), -this.between(60, 120), this.between(300, 480), 2, DROPS[i % DROPS.length]!, 360);
    }
  }

  /** A burst in a rank colour (a catch). */
  rankBurst(at: Point, rank: Rank, count: number): void {
    const color = hex(PALETTE[RANK_COLORS[rank]]!);
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const speed = this.between(50, 120);
      this.pool.spawn('spark', at.x, at.y, Math.cos(a) * speed, Math.sin(a) * speed - 30, this.between(300, 520), 3, i % 3 === 0 ? 0xffffff : color, 140);
    }
  }

  /** A ring that grows on the water at a point (the oldest slot is reused when all are busy). */
  ring(at: Point): void {
    let slot = this.rings.findIndex((r) => r === null);
    if (slot < 0) slot = this.rings.reduce((best, r, i) => (r!.ageMs > this.rings[best]!.ageMs ? i : best), 0);
    this.rings[slot] = { at: { x: at.x, y: at.y }, ageMs: 0 };
  }

  update(dtMs: number): void {
    this.pool.update(dtMs);
    let n = 0;
    this.pool.forEach((p) => {
      const s = this.sprites[n++]!;
      s.visible = true;
      s.position.set(Math.round(p.x), Math.round(p.y));
      s.width = p.size;
      s.height = p.size;
      s.tint = p.color;
      const k = p.ageMs / p.lifeMs;
      s.alpha = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    });
    for (let i = n; i < this.shown; i++) this.sprites[i]!.visible = false;
    this.shown = n;
    this.rings.forEach((r, slot) => {
      const set = this.ringArt[slot]!;
      if (r) r.ageMs += dtMs;
      const k = r ? r.ageMs / FX_RING_MS : 1;
      if (!r || k >= 1) {
        this.rings[slot] = null;
        for (const g of set) g.visible = false;
        return;
      }
      const step = Math.min(set.length - 1, Math.floor(easeOutQuad(k) * set.length));
      set.forEach((g, i) => {
        g.visible = i === step;
        if (i === step) {
          g.position.set(Math.round(r.at.x), Math.round(r.at.y));
          g.alpha = 1 - k;
        }
      });
    });
  }

  /** Forgets everything (the room changed, Reduce effects switched on). */
  clear(): void {
    this.pool.clear();
    this.rings.fill(null);
    this.prize.visible = false;
    this.update(0);
  }
}
