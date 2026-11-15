// The pour (ART-T1): a short amber stream from a tap and a mug that fills under it, drawn in the
// room above the objects. Drawing only; the coder decides WHEN to pour (the avatar's 'bar' stage,
// POUR_MS) and calls playPour(itemViews, tapUid, durationMs?, onSound?). Whole world px, no
// smoothing. With reduced motion the stream is skipped and the mug just appears full.
//
//   0 .. 12%   the stream grows from the spout down to the mug
//   12 .. 82%  the mug fills (whole px steps), foam on top
//   82 .. 100% the stream thins and stops, the mug stays full, then it fades
// The 'clink' sound is only asked for by NAME through onSound at the end (audio lives elsewhere).

import { Container, Graphics } from 'pixi.js';
import { PALETTE } from '@pixel-hotel/shared';
import type { ItemViews } from './itemViews.ts';

/** Default length when the caller passes none (config POUR_MS is about 800). */
export const DEFAULT_POUR_MS = 800;

const BEER = PALETTE[10];
const BEER_DARK = PALETTE[9];
const FOAM = PALETTE[2];
const GLASS = PALETTE[20];
const OUTLINE = PALETTE[6];

/** Spout positions (dx, dy from the stand's anchor, in px) for the two taps of a tap_stand. */
export const TAP_SPOUTS = [
  { dx: -8, dy: -13 },
  { dx: 8, dy: -13 },
] as const;

interface Pour {
  g: Graphics;
  age: number;
  total: number;
  onSound?: (name: 'clink') => void;
  clinked: boolean;
}

function reducedMotion(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/** The running pours of one room (owned by ItemViews). */
export class PourEffects {
  private readonly pours: Pour[] = [];
  private nextTap = new Map<number, number>();

  constructor(private readonly layer: Container) {}

  /** Starts a pour at the stand's x, y (world px of its anchor); alternates between its two taps. */
  start(uid: number, x: number, y: number, totalMs: number, onSound?: (name: 'clink') => void): void {
    const i = (this.nextTap.get(uid) ?? 0) % TAP_SPOUTS.length;
    this.nextTap.set(uid, i + 1);
    const spout = TAP_SPOUTS[i]!;
    const g = new Graphics();
    g.position.set(Math.round(x + spout.dx), Math.round(y + spout.dy));
    this.layer.addChild(g);
    const p: Pour = { g, age: 0, total: Math.max(100, totalMs), onSound, clinked: false };
    this.pours.push(p);
    this.draw(p);
  }

  update(dtMs: number): void {
    for (const p of this.pours) {
      p.age += dtMs;
      this.draw(p);
    }
    for (const p of this.pours.filter((q) => q.age >= q.total + FADE_MS)) p.g.destroy();
    this.pours.splice(0, this.pours.length, ...this.pours.filter((q) => q.age < q.total + FADE_MS));
  }

  clear(): void {
    for (const p of this.pours) p.g.destroy();
    this.pours.length = 0;
  }

  /** Draws one frame. The origin is the spout; the mug stands MUG_DROP px below it. */
  private draw(p: Pour): void {
    const g = p.g;
    g.clear();
    const k = Math.min(1, p.age / p.total);
    const still = reducedMotion();
    const mugTop = MUG_DROP - MUG_H;
    // Fill level in whole px: 0 .. MUG_H - 2 (inside the walls).
    const fillK = still ? 1 : Math.min(1, Math.max(0, (k - 0.12) / 0.7));
    const level = Math.round(fillK * (MUG_H - 2));
    // The mug: outline, glass, beer, foam.
    g.rect(-MUG_W / 2 - 1, mugTop - 1, MUG_W + 2, MUG_H + 2).fill(OUTLINE);
    g.rect(-MUG_W / 2, mugTop, MUG_W, MUG_H).fill(GLASS);
    if (level > 0) {
      g.rect(-MUG_W / 2 + 1, mugTop + MUG_H - 1 - level, MUG_W - 2, level).fill(BEER);
      g.rect(-MUG_W / 2 + 1, mugTop + MUG_H - 2, MUG_W - 2, 1).fill(BEER_DARK);
      if (level >= 2) g.rect(-MUG_W / 2 + 1, mugTop + MUG_H - 1 - level, MUG_W - 2, 1).fill(FOAM);
    }
    g.rect(MUG_W / 2 + 1, mugTop + 2, 2, 4).fill(OUTLINE); // handle
    // The stream: grows 0..12%, steady, thins 82%..100%.
    if (!still && k < 1) {
      const grow = Math.min(1, k / 0.12);
      const len = Math.round(grow * (MUG_DROP - 1 - Math.round(level * 0.0)));
      const thin = k > 0.82;
      const w = thin ? 1 : 2;
      const x = thin ? 0 : -1;
      g.rect(x, 0, w, Math.max(0, len)).fill(BEER);
      if (!thin && len > 3) g.rect(x + 1, 1, 1, len - 1).fill(BEER_DARK);
    }
    // A drip of foam at the end, and the clink hook once.
    if (k >= 1 && !p.clinked) {
      p.clinked = true;
      p.onSound?.('clink');
    }
    g.alpha = p.age <= p.total ? 1 : Math.max(0, 1 - (p.age - p.total) / FADE_MS);
  }
}

const MUG_W = 8;
const MUG_H = 9;
/** Distance from the spout down to the mug's bottom. */
const MUG_DROP = 14;
const FADE_MS = 150;

/**
 * Plays the pour of the tap stand `tapUid`: a stream and a filling mug above the stand, lasting
 * `durationMs` (config POUR_MS), then a 150 ms fade. Does nothing when the stand is not shown.
 * `onSound` is called once with 'clink' when the mug is full (the caller maps it to audio).
 */
export function playPour(view: ItemViews, tapUid: number, durationMs: number = DEFAULT_POUR_MS, onSound?: (name: 'clink') => void): void {
  view.pourAt(tapUid, durationMs, onSound);
}
