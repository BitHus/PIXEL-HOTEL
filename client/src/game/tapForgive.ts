// TAP FORGIVENESS (owner 18 Nov): when a tap hits nothing, the nearest tappable thing within a small radius of its DRAWN bounds is used instead. The maths is
// shared/src/tapPick.ts (pure, tested); this part only collects the candidates on screen: furniture with a use (sprite bounds, not the footprint) and guests.
// Blocks, plants, trees and the water keep their exact cells (the placing and punching rules are unchanged).

import {
  getFurnitureType, hasSeats, isUsable, pickTap, tapMinSize, tapTolerance, worldToScreen,
  type FurnitureItem, type Point, type TapTarget,
} from '@pixel-hotel/shared';
import type { G15 } from './ctx.ts';

/** True for a finger (coarse pointer), false for a mouse. */
export const isTouchInput = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** What a near-miss tap picked. */
export type NearTap = { kind: 'item'; item: FurnitureItem } | { kind: 'guest'; id: number; world: Point };

/** A piece the player can use by tapping: bar, register, taps, machines, casks, seats, usable decor. */
export function isTapUseful(typeId: string): boolean {
  const t = getFurnitureType(typeId);
  return !!(t.servedFromBehind || t.till || t.taps || t.cooks || t.brews || t.casks || isUsable(t) || hasSeats(t));
}

export function createTapForgive(g: Pick<G15, 'st' | 'itemViews' | 'late'>): { nearTap(screen: Point): NearTap | null } {
  const { st, itemViews, late } = g;
  return {
    nearTap(screen) {
      const targets: TapTarget<NearTap>[] = [];
      for (const item of st.items) {
        if (item.roomId !== st.room.id || !isTapUseful(item.typeId)) continue;
        const b = itemViews.screenBounds(item.uid);
        if (b) targets.push({ ref: { kind: 'item', item }, bounds: b, depth: item.y });
      }
      // A guest's body box (28 px wide, from the head to the feet), on screen.
      for (const f of late.guestFeet()) {
        const a = worldToScreen({ x: f.x - 14, y: f.y - 60 }, st.shown);
        const c = worldToScreen({ x: f.x + 14, y: f.y + 6 }, st.shown);
        targets.push({ ref: { kind: 'guest', id: f.id, world: { x: f.x, y: f.y - 24 } }, bounds: { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y }, depth: f.y });
      }
      const touch = isTouchInput();
      return pickTap(screen, targets, { tolerance: tapTolerance(touch), minSize: tapMinSize(touch) })?.target.ref ?? null;
    },
  };
}
