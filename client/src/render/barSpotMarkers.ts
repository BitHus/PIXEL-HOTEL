// TF-6: faint foot markers on the customer side of the bar (one per bar spot). Shown only while a bar guest walks in or while furniture is being
// placed (docs/PLAN-TAVERN-FLOW.md section 4); never a rule here, the spots come from shared/src/barSpots.ts.

import { Graphics } from 'pixi.js';
import { PALETTE, type BarSpot, type Point } from '@pixel-hotel/shared';
import type { RoomView } from './roomView.ts';

/** The marker of a spot: a flat 24 x 10 px footprint glyph under the feet. Pure (tested). */
export function markerRect(spot: Pick<BarSpot, 'x' | 'y'>): { x: number; y: number; w: number; h: number } {
  return { x: Math.round(spot.x - 12), y: Math.round(spot.y - 8), w: 24, h: 10 };
}

/** True while the markers should show: the tavern is open to bar guests and a bar guest walks in or a piece is being placed. */
export function barMarkersWanted(o: { enabled: boolean; inTavern: boolean; walkingIn: boolean; placing: boolean }): boolean {
  return o.enabled && o.inTavern && (o.walkingIn || o.placing);
}

const COLOR = parseInt((PALETTE[8] ?? '#feae34').slice(1), 16);

export class BarSpotMarkers {
  private readonly g = new Graphics();
  private key = '';

  constructor(view: RoomView) {
    this.g.eventMode = 'none';
    view.rugLayer.addChild(this.g);
  }

  /** Draws these spots (an empty list hides everything). `taken`: spots with a guest (drawn brighter). */
  set(spots: readonly (Point & { id?: string })[], takenIds: ReadonlySet<string> = new Set()): void {
    const key = spots.map((s) => `${s.x},${s.y},${takenIds.has(s.id ?? '') ? 1 : 0}`).join(';');
    if (key === this.key) return;
    this.key = key;
    this.g.clear();
    for (const s of spots) {
      const r = markerRect(s);
      this.g.roundRect(r.x, r.y, r.w, r.h, 3).fill({ color: COLOR, alpha: takenIds.has(s.id ?? '') ? 0.34 : 0.2 });
      this.g.rect(r.x + 4, r.y + 3, 4, 4).fill({ color: COLOR, alpha: 0.5 });
      this.g.rect(r.x + 16, r.y + 3, 4, 4).fill({ color: COLOR, alpha: 0.5 });
    }
  }
}
