// The farm in a room view (step 9b): draws the plots (tilled soil under everything, the crops in
// their stage), the cooking pot (in the depth-sorted objects) and a bouncing marker over every ripe
// plot. Handles play mode taps on the farm (section 10b):
// - an empty plot: walk there and plant the selected seed (or the first seed in the hotbar);
// - a ripe plot: walk there and harvest into the bag;
// - a growing plot: says when it is ripe;
// - the cooking pot: opens the Cooking panel.
// The planting or harvesting happens when the avatar arrives (main.ts calls arrived()).

import { Container, Graphics } from 'pixi.js';
import {
  COOKING_POT,
  RIPE_MARKER_BOB_MS,
  RIPE_MARKER_BOB_PX,
  getCropType,
  getMaterialType,
  plotAt,
  plotCenter,
  plotRect,
  potRect,
  ripeInMs,
  stageOf,
  type FarmView,
  type GameAPI,
  type Point,
  type Room,
  type SeedId,
} from '@pixel-hotel/shared';
import type { RoomView } from '../render/roomView.ts';
import { drawCrop, drawPlot, drawPot, drawRipeMarker } from './farmArt.ts';

export interface FarmHooks {
  api: Pick<GameAPI, 'getFarm' | 'plant' | 'harvest'>;
  toast(text: string): void;
  /** Walks to a world point; false if there is no way. */
  walkTo(p: Point): Promise<boolean>;
  openCooking(): void;
  /** The seed to plant: the selected hotbar seed, else the first one the player has; null = none. */
  pickSeed(): SeedId | null;
  /** The bag, the hints and the travel panel changed. */
  afterChange(): Promise<void>;
}

type Pending = { kind: 'plant'; plot: number; seed: SeedId } | { kind: 'harvest'; plot: number };

/** The pot can be tapped on its drawing, which stands above its footprint. */
const POT_TAP_ABOVE = 40;

export class FarmScreen {
  private farm: FarmView | null = null;
  /** performance.now() when `farm` was read (its `at` is the API's clock at that moment). */
  private readAt = 0;
  private readonly ground = new Graphics();
  private readonly crops = new Graphics();
  private readonly markers = new Container({ eventMode: 'none' });
  private readonly pot = new Container({ eventMode: 'none' });
  private drawnKey = '';
  private pending: Pending | null = null;
  private busy = false;

  constructor(
    private readonly view: RoomView,
    private readonly hooks: FarmHooks,
  ) {
    this.ground.eventMode = 'none';
    this.crops.eventMode = 'none';
    this.pot.addChild(drawPot());
  }

  get active(): boolean {
    return this.farm !== null;
  }

  /** The room changed: draw the farm when it is one, else take everything away. */
  async enter(room: Room): Promise<void> {
    this.pending = null;
    if (room.kind !== 'farm') {
      this.leave();
      return;
    }
    this.view.rugLayer.addChildAt(this.ground, 0);
    this.view.rugLayer.addChildAt(this.crops, 1);
    this.view.markerLayer.addChild(this.markers);
    this.pot.position.set(COOKING_POT.x, COOKING_POT.y);
    this.view.objects.add(this.pot, { y: COOKING_POT.y, x: COOKING_POT.x, uid: -1_000_000 });
    this.set(await this.hooks.api.getFarm());
  }

  private leave(): void {
    if (this.farm === null) return;
    this.farm = null;
    this.ground.removeFromParent();
    this.crops.removeFromParent();
    this.markers.removeFromParent();
    this.view.objects.remove(this.pot);
  }

  private set(farm: FarmView): void {
    this.farm = farm;
    this.readAt = performance.now();
    this.ground.clear();
    farm.plots.forEach((_, i) => drawPlot(this.ground, plotRect(i)));
    this.drawnKey = '';
  }

  /** The API's clock now (crops grow by it). */
  private now(): number {
    return this.farm ? this.farm.at + (performance.now() - this.readAt) : 0;
  }

  /** Cancels a walk to a plot (the player tapped something else). */
  cancel(): void {
    this.pending = null;
  }

  /** A play mode tap on the farm. True when it was about a plot or the pot. */
  tap(p: Point): boolean {
    const farm = this.farm;
    if (!farm) return false;
    this.pending = null;
    const pot = potRect();
    if (p.x >= pot.x && p.x <= pot.x + pot.w && p.y >= pot.y - POT_TAP_ABOVE && p.y <= pot.y + pot.h) {
      this.hooks.openCooking();
      return true;
    }
    const index = plotAt(farm.level, p);
    const plot = index === null ? undefined : farm.plots[index];
    if (index === null || !plot) return false;
    const now = this.now();
    const stage = stageOf(plot, now);
    if (stage === null) {
      const seed = this.hooks.pickSeed();
      if (!seed) {
        this.hooks.toast('You have no seeds. Buy some in the Catalog (Seeds), then tap a plot.');
        return true;
      }
      this.goTo(index, { kind: 'plant', plot: index, seed });
      return true;
    }
    if (stage === 'ripe') {
      this.goTo(index, { kind: 'harvest', plot: index });
      return true;
    }
    const mins = Math.max(1, Math.ceil((ripeInMs(plot, now) ?? 0) / 60_000));
    this.hooks.toast(`${getCropType(plot.crop!).name}: ripe in ${mins} min.`);
    return true;
  }

  private goTo(index: number, action: Pending): void {
    void this.hooks.walkTo(plotCenter(index)).then((ok) => {
      if (ok) this.pending = action;
      else this.hooks.toast('There is no way to that plot.');
    });
  }

  /** The avatar stopped walking: plant or harvest if it was walking to a plot. */
  arrived(): void {
    const a = this.pending;
    if (!a || this.busy) return;
    this.pending = null;
    this.busy = true;
    void this.act(a).finally(() => (this.busy = false));
  }

  private async act(a: Pending): Promise<void> {
    if (a.kind === 'plant') {
      const farm = await this.hooks.api.plant(a.plot, a.seed);
      if (!farm) {
        this.hooks.toast('That cannot be planted there.');
        return;
      }
      this.set(farm);
      this.hooks.toast(`Planted: ${getMaterialType(a.seed).name}.`);
    } else {
      const r = await this.hooks.api.harvest(a.plot);
      if (!r) return;
      this.set(r.farm);
      this.hooks.toast(`+${r.qty} ${getCropType(r.crop).name}`);
    }
    await this.hooks.afterChange();
  }

  /** Re-reads the farm (after an upgrade). */
  async refresh(): Promise<void> {
    if (this.farm) this.set(await this.hooks.api.getFarm());
  }

  /** Every frame: redraws the crops when a stage changed, bobs the ripe markers. */
  update(clockMs: number): void {
    const farm = this.farm;
    if (!farm) return;
    const now = this.now();
    const stages = farm.plots.map((p) => stageOf(p, now));
    const key = stages.map((s, i) => `${farm.plots[i]?.crop ?? ''}:${s ?? ''}`).join('|');
    if (key !== this.drawnKey) {
      this.drawnKey = key;
      this.crops.clear();
      this.markers.removeChildren().forEach((c) => c.destroy());
      stages.forEach((s, i) => {
        const crop = farm.plots[i]?.crop;
        if (!s || !crop) return;
        const r = plotRect(i);
        drawCrop(this.crops, r, crop, s);
        if (s === 'ripe') {
          const m = drawRipeMarker();
          m.position.set(r.x + r.w / 2, r.y - 14);
          this.markers.addChild(m);
        }
      });
    }
    const bob = Math.floor(clockMs / RIPE_MARKER_BOB_MS) % 2 === 0 ? 0 : -RIPE_MARKER_BOB_PX;
    this.markers.position.set(0, bob);
  }
}
