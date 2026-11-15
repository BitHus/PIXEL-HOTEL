// The farm in a room view (steps 9b, BG6): only the fixed cooking pot is drawn and handled here now. The
// soil is a floor style painted per cell, the plants are PlantViews (farm/plantViews.ts), and planting and
// harvesting are punches and taps through main.ts (select a seed, tap soil; punch a grown plant; hold to repeat).
// A tap on the pot opens the Cooking panel.

import { Container } from 'pixi.js';
import { COOKING_POT, potRect, type Point, type Room } from '@pixel-hotel/shared';
import type { RoomView } from '../render/roomView.ts';
import { drawPot } from './farmArt.ts';

export interface FarmHooks {
  openCooking(): void;
}

/** The pot can be tapped on its drawing, which stands above its footprint. */
const POT_TAP_ABOVE = 40;

export class FarmScreen {
  private readonly pot = new Container();
  private on = false;

  constructor(
    private readonly view: RoomView,
    private readonly hooks: FarmHooks,
  ) {
    this.pot.eventMode = 'none';
    this.pot.addChild(drawPot());
  }

  get active(): boolean {
    return this.on;
  }

  /** The room changed: put the pot in when it is a farm, else take it away. */
  async enter(room: Room): Promise<void> {
    if (room.kind !== 'farm') {
      this.leave();
      return;
    }
    if (this.on) return;
    this.on = true;
    this.pot.position.set(COOKING_POT.x, COOKING_POT.y);
    this.view.objects.add(this.pot, { y: COOKING_POT.y, x: COOKING_POT.x, uid: -1_000_000 });
  }

  private leave(): void {
    if (!this.on) return;
    this.on = false;
    this.view.objects.remove(this.pot);
  }

  /** A play mode tap on the farm. True when it was on the cooking pot. */
  tap(p: Point): boolean {
    if (!this.on) return false;
    const pot = potRect();
    if (p.x >= pot.x && p.x <= pot.x + pot.w && p.y >= pot.y - POT_TAP_ABOVE && p.y <= pot.y + pot.h) {
      this.hooks.openCooking();
      return true;
    }
    return false;
  }
}
