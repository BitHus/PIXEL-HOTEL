// The pour at the taps (step T1): while the avatar pours, a thin stream falls from the tap into a mug on the bar that fills up
// over `ms`, then it is gone (the avatar carries a mug from then on). Pixel boxes drawn in code, no art files. Rendering only.

import { Graphics } from 'pixi.js';
import { POUR_PERFECT_RANGE, PALETTE, getDrinkType, getFurnitureType, type DrinkId, type FurnitureItem, type MaterialId } from '@pixel-hotel/shared';
import { itemDepthKey } from './depthOrder.ts';
import { surfaceHeight } from './furnitureArt.ts';
import type { RoomView } from './roomView.ts';

const MUG_W = 8;
const MUG_H = 9;

export class PourFx {
  private active: { g: Graphics; from: number; until: number; color: string; manual: boolean; fill: number; streaming: boolean } | null = null;

  constructor(private readonly view: RoomView, private readonly now: () => number = () => performance.now()) {}

  /** Starts a pour at a tap stand standing on `bar` for `ms`; the drink's colour is the stream. */
  start(stand: FurnitureItem, bar: FurnitureItem | undefined, drink: MaterialId, ms: number): void {
    this.stop();
    const g = new Graphics();
    g.eventMode = 'none';
    const top = bar ? surfaceHeight(getFurnitureType(bar.typeId)) : 0;
    g.position.set(stand.x, stand.y - top);
    this.view.objects.add(g, bar ? itemDepthKey(stand, bar) : { y: stand.y, x: stand.x, uid: stand.uid });
    const color = PALETTE[getDrinkType(drink as DrinkId).color] ?? PALETTE[9];
    this.active = { g, from: this.now(), until: this.now() + ms, color, manual: false, fill: 0, streaming: true };
    this.draw(0);
  }

  /** G2: a hands-on pour: the mug fills as the player holds (setFill each frame, stop() at the release). */
  startHeld(stand: FurnitureItem, bar: FurnitureItem | undefined, drink: MaterialId): void {
    this.start(stand, bar, drink, 1);
    if (this.active) this.active.manual = true;
  }

  /** G2: the fill of the mug now (0..1.4, 1 = full) and whether the tap runs. */
  setFill(fill: number, streaming: boolean): void {
    const a = this.active;
    if (!a?.manual) return;
    a.fill = fill;
    a.streaming = streaming;
    this.draw(Math.min(1, fill));
  }

  /** Call every frame. */
  update(): void {
    const a = this.active;
    if (!a || a.manual) return;
    const t = (this.now() - a.from) / (a.until - a.from);
    if (t >= 1) this.stop();
    else this.draw(t);
  }

  stop(): void {
    if (!this.active) return;
    this.view.objects.remove(this.active.g);
    this.active.g.destroy();
    this.active = null;
  }

  private draw(t: number): void {
    const a = this.active;
    if (!a) return;
    const filled = Math.round((MUG_H - 2) * t);
    a.g.clear();
    // The mug on the bar in front of the spout, filling from the bottom; the stream falls from the spout into it (not in the last bit).
    a.g.rect(-MUG_W / 2, -MUG_H, MUG_W, MUG_H).fill(PALETTE[2]);
    if (filled > 0) a.g.rect(-MUG_W / 2 + 1, -1 - filled, MUG_W - 2, filled).fill(a.color);
    const stream = a.manual ? a.streaming : t < 0.9;
    if (stream) a.g.rect(-1, -26, 2, 26 - MUG_H - filled).fill(a.color);
    // G2: past the perfect window the mug foams over (a white cap), and the mug trembles while the tap runs.
    if (a.manual && a.fill > POUR_PERFECT_RANGE[1]) a.g.rect(-MUG_W / 2, -MUG_H - 2, MUG_W, 2).fill(PALETTE[26] ?? '#ffffff');
  }
}
