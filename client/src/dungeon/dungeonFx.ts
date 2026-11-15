// The dungeon's particles (outdoors rework C12): sparks, goo, bone and feather bits, dust, rock debris and the drops that pop out of a chest.
// One ParticlePool (fx/particles.ts, capped at FX_MAX_PARTICLES) plus a fixed set of pre-made 1 px white sprites, tinted and sized per particle:
// nothing is created or redrawn per frame. Whole-pixel positions. Directions come from a seeded counter, never Math.random.

import { Container, Sprite, Texture } from 'pixi.js';
import { FX_DUST_EVERY_PX, FX_LOOT_POP_MS, FX_LOOT_POP_PX, FX_MAX_PARTICLES, PALETTE, RANK_COLORS, type Point, type Rank } from '@pixel-hotel/shared';
import { hash01 } from '../fx/shake.ts';
import { ParticlePool, type ParticleKind } from '../fx/particles.ts';
import type { BitKind } from '../fx/fxSpec.ts';

const hex = (css: string): number => parseInt(css.slice(1), 16);
const SPARK = [hex(PALETTE[11]!), hex(PALETTE[10]!), hex(PALETTE[19]!)];
const BITS: Record<BitKind, number[]> = {
  goo: [hex(PALETTE[12]!), hex(PALETTE[13]!)],
  bone: [hex(PALETTE[2]!), hex(PALETTE[20]!)],
  feather: [hex(PALETTE[21]!), hex(PALETTE[22]!)],
  debris: [hex(PALETTE[22]!), hex(PALETTE[23]!)],
  dust: [hex(PALETTE[21]!)],
};
const KIND_OF: Record<BitKind, ParticleKind> = { goo: 'goo', bone: 'bone', feather: 'feather', debris: 'debris', dust: 'dust' };

export class DungeonFx {
  readonly container = new Container();
  readonly pool = new ParticlePool(FX_MAX_PARTICLES);
  private readonly sprites: Sprite[] = [];
  private shown = 0;
  private counter = 1;
  private walked = 0;
  private last: Point | null = null;

  constructor() {
    this.container.eventMode = 'none';
    for (let i = 0; i < this.pool.cap; i++) {
      const s = new Sprite(Texture.WHITE);
      s.anchor.set(0.5);
      s.visible = false;
      this.sprites.push(s);
      this.container.addChild(s);
    }
  }

  /** The next seeded number in [0, 1). */
  private rand(): number {
    return hash01(0x5eed, this.counter++);
  }

  private between(a: number, b: number): number {
    return a + (b - a) * this.rand();
  }

  /** Short bright specks that fly out from a hit. */
  sparks(at: Point, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = this.rand() * Math.PI * 2;
      const speed = this.between(70, 150);
      this.pool.spawn('spark', at.x, at.y, Math.cos(a) * speed, Math.sin(a) * speed - 20, this.between(160, 280), 2, SPARK[i % SPARK.length]!, 120);
    }
  }

  /** A burst of bits: goo, bones, feathers, rock debris or dust. */
  burst(at: Point, bits: BitKind, count: number): void {
    const colors = BITS[bits];
    const feather = bits === 'feather';
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + this.between(-1.3, 1.3);
      const speed = this.between(feather ? 30 : 60, feather ? 70 : 140);
      this.pool.spawn(KIND_OF[bits], at.x, at.y, Math.cos(a) * speed, Math.sin(a) * speed, this.between(feather ? 500 : 320, feather ? 800 : 560), feather ? 2 : 3, colors[i % colors.length]!, feather ? 50 : 420);
    }
  }

  /** Drops that jump out of a chest (or a broken rock) and bounce on the floor; the colour is the rank colour. */
  lootPop(at: Point, floorY: number, rank: Rank, count = 3): void {
    const color = hex(PALETTE[RANK_COLORS[rank]]!);
    for (let i = 0; i < count; i++) {
      const vy = -Math.sqrt(2 * 420 * FX_LOOT_POP_PX) * this.between(0.9, 1.3);
      this.pool.spawn('drop', at.x, at.y, this.between(-40, 40), vy, FX_LOOT_POP_MS + 200, 4, color, 420, floorY, 0.45);
    }
  }

  /** Call every frame with where the player stands (whole walk): a dust puff every FX_DUST_EVERY_PX walked. */
  footsteps(at: Point, moving: boolean): void {
    if (this.last && moving) {
      this.walked += Math.hypot(at.x - this.last.x, at.y - this.last.y);
      if (this.walked >= FX_DUST_EVERY_PX) {
        this.walked = 0;
        this.pool.spawn('dust', at.x + this.between(-3, 3), at.y - 1, this.between(-12, 12), -this.between(8, 22), 320, 3, BITS.dust[0]!, 0);
      }
    }
    this.last = { x: at.x, y: at.y };
    if (!moving) this.walked = 0;
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
  }

  /** Forgets every particle (a new floor, the end of a run, Reduce effects switched on). */
  clear(): void {
    this.pool.clear();
    this.update(0);
    this.last = null;
    this.walked = 0;
  }
}
