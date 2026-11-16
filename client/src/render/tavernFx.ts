// Tavern juice (JU-1): pour splash, coin sparkles at the register, steam from a ready stove or barrel. Drawn as small white-or-tinted squares from the
// fx ParticlePool in the marker layer (above the lights). Pure juice: with Reduce effects on nothing spawns. No rules, no art files.

import { Graphics } from 'pixi.js';
import { PALETTE, type Point } from '@pixel-hotel/shared';
import { ParticlePool } from '../fx/particles.ts';
import type { RoomView } from './roomView.ts';

/** A steam wisp is made this often per source, ms. */
export const STEAM_EVERY_MS = 260;
/** The splash drops of a pour are made this often, ms. */
export const SPLASH_EVERY_MS = 70;

const WHITE = 0xffffff;
const toHex = (css: string | undefined): number => (css ? parseInt(css.slice(1), 16) : WHITE);

export class TavernFx {
  private readonly pool = new ParticlePool();
  private readonly g = new Graphics();
  private pour: { at: Point; floorY: number; color: number; until: number; nextAt: number } | null = null;
  private steam: Point[] = [];
  private steamAccum = 0;
  private clock = 0;
  /** True while another screen (the dungeon) covers the room: no steam, no ambience. */
  paused = false;

  constructor(view: RoomView, private readonly reduce: () => boolean) {
    this.g.eventMode = 'none';
    view.markerLayer.addChild(this.g);
  }

  /** The stream hits the mug: drops jump up for `ms` (a pour). `at` = the mug's top, `floorY` = the bar top. */
  pourSplash(at: Point, floorY: number, colorName: number, ms: number): void {
    if (this.reduce()) return;
    this.pour = { at, floorY, color: toHex(PALETTE[colorName]), until: this.clock + ms, nextAt: this.clock };
  }

  stopPour(): void {
    this.pour = null;
  }

  /** A small shower of sparks (coins landing in the register, a served mug). */
  sparkle(at: Point, count = 6, color: number = toHex(PALETTE[8])): void {
    if (this.reduce()) return;
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 40 + Math.random() * 40;
      this.pool.spawn('spark', at.x, at.y, Math.cos(a) * v, Math.sin(a) * v, 380 + Math.random() * 160, 2, color, 260);
    }
  }

  /** The places a ready stove or barrel is (world px, the top of the machine). Empty = no steam. */
  setSteam(sources: Point[]): void {
    this.steam = sources;
  }

  update(dtMs: number): void {
    this.clock += dtMs;
    const p = this.pour;
    if (p) {
      if (this.clock >= p.until) this.pour = null;
      else
        while (this.clock >= p.nextAt) {
          p.nextAt += SPLASH_EVERY_MS;
          const side = Math.random() < 0.5 ? -1 : 1;
          this.pool.spawn('drop', p.at.x, p.at.y, side * (8 + Math.random() * 14), -30 - Math.random() * 20, 300, 1, p.color, 220, p.floorY, 0);
        }
    }
    if (this.steam.length > 0 && !this.reduce()) {
      this.steamAccum += dtMs;
      while (this.steamAccum >= STEAM_EVERY_MS) {
        this.steamAccum -= STEAM_EVERY_MS;
        for (const s of this.steam) this.pool.spawn('dust', s.x + (Math.random() - 0.5) * 6, s.y, (Math.random() - 0.5) * 6, -14 - Math.random() * 6, 1100, 2, WHITE);
      }
    } else this.steamAccum = 0;
    this.pool.update(dtMs);
    this.g.clear();
    if (this.pool.count === 0) return;
    this.pool.forEach((q) => {
      // Whole pixels; steam fades out and drifts, sparks and drops are solid until the last 30%.
      const t = q.ageMs / q.lifeMs;
      const alpha = q.kind === 'dust' ? 0.55 * (1 - t) : t > 0.7 ? (1 - t) / 0.3 : 1;
      this.g.rect(Math.round(q.x), Math.round(q.y), q.size, q.size).fill({ color: q.color, alpha });
    });
  }

  clear(): void {
    this.pool.clear();
    this.pour = null;
    this.steam = [];
  }
}
