// TAP FORGIVENESS (owner 18 Nov): when a tap hits nothing, the nearest tappable thing within a small radius of its DRAWN bounds is used instead. The maths is
// shared/src/tapPick.ts (pure, tested); this part only collects the candidates on screen: furniture with a use (sprite bounds, not the footprint) and guests.
// Blocks, plants, trees and the water keep their exact cells (the placing and punching rules are unchanged).
// MISCLICK-PROOF (owner 19 Nov): every candidate carries its state (ready/urgent, machine, seat; shared/src/interact.ts), so overlapping things pick the
// urgent one first, the hover tag and the context button name the action, and 'Big tap targets' widens the finger radius (TAP_BIG_PX).

import {
  getFurnitureType, hasSeats, interactLabel, interactPriority, isTinyPiece, isUsable, machineStates, pickTap, screenToWorld, tapOptions, worldToScreen,
  type FurnitureItem, type InteractState, type Point, type Rect, type Reachable, type TapTarget,
} from '@pixel-hotel/shared';
import type { G15 } from './ctx.ts';

/** True for a finger (coarse pointer), false for a mouse. */
export const isTouchInput = (): boolean => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

/** What a near-miss tap picked. */
export type NearTap = { kind: 'item'; item: FurnitureItem } | { kind: 'guest'; id: number; world: Point };

/** A pick with what it is: its screen bounds, state, priority and action label (the hover tag, the context button). */
export interface InteractPick {
  ref: NearTap;
  bounds: Rect;
  state: InteractState;
  priority: number;
  label: string;
  /** True = inside the (grown) bounds; false = a near miss. */
  hit: boolean;
}

/** A piece the player can use by tapping: bar, register, taps, machines, casks, seats, usable decor. */
export function isTapUseful(typeId: string): boolean {
  const t = getFurnitureType(typeId);
  return !!(t.servedFromBehind || t.till || t.taps || t.stash || t.cooks || t.brews || t.casks || isUsable(t) || hasSeats(t));
}

export interface TapForgiveExtras {
  /** The Settings toggle 'Big tap targets' (on by default on touch). */
  bigTaps?: () => boolean;
  /** True while the avatar waits at the taps for a pour (the stand is then 'Pour', urgent). */
  pourWaiting?: () => boolean;
  /** The clock for ready machines (Date.now in the client). */
  now?: () => number;
}

export function createTapForgive(g: Pick<G15, 'st' | 'itemViews' | 'late'>, extras: TapForgiveExtras = {}) {
  const { st, itemViews, late } = g;
  const opts = () => tapOptions(isTouchInput(), extras.bigTaps?.() ?? false);

  /** The state of a usable piece (null = not usable by a tap). */
  const itemState = (item: FurnitureItem, ready: Map<number, string> | null): InteractState | null => {
    if (!isTapUseful(item.typeId)) return null;
    const t = getFurnitureType(item.typeId);
    const isReady = ready?.get(item.uid) === 'ready';
    if (t.cooks) return { kind: 'stove', ready: isReady };
    if (t.brews) return { kind: 'barrel', ready: isReady };
    if (t.casks) return { kind: 'cask' };
    if (t.stash) return { kind: 'stash' };
    if (t.taps) return extras.pourWaiting?.() ? { kind: 'pour' } : { kind: 'taps' };
    if (t.servedFromBehind || t.till) return { kind: 'bar', ready: !!st.tavern?.guests?.some((x) => x.phase === 'order' && x.order) };
    if (hasSeats(t)) return { kind: 'seat' };
    return { kind: 'use' };
  };

  /** Every usable thing on screen with its state (furniture and guests with an open order). */
  const candidates = (): { ref: NearTap; bounds: Rect; depth: number; state: InteractState }[] => {
    const out: { ref: NearTap; bounds: Rect; depth: number; state: InteractState }[] = [];
    const ready = st.tavern?.cooks ? machineStates(st.tavern, extras.now?.() ?? Date.now()) : null;
    for (const item of st.items) {
      if (item.roomId !== st.room.id) continue;
      const state = itemState(item, ready);
      if (!state) continue;
      const b = itemViews.screenBounds(item.uid);
      if (b) out.push({ ref: { kind: 'item', item }, bounds: b, depth: item.y, state });
    }
    // A guest's body box (28 px wide, from the head to the feet), on screen. Without a known tavern (tests) every guest counts; else only one with an order.
    for (const f of late.guestFeet()) {
      const guest = st.tavern?.guests?.find((x) => x.id === f.id);
      const ordering = !!guest && guest.phase === 'order' && !!guest.order;
      if (st.tavern?.guests && !ordering) continue;
      const a = worldToScreen({ x: f.x - 14, y: f.y - 60 }, st.shown);
      const c = worldToScreen({ x: f.x + 14, y: f.y + 6 }, st.shown);
      out.push({ ref: { kind: 'guest', id: f.id, world: { x: f.x, y: f.y - 24 } }, bounds: { x: a.x, y: a.y, w: c.x - a.x, h: c.y - a.y }, depth: f.y, state: { kind: 'guest', ready: ordering } });
    }
    return out;
  };

  const toPick = (c: { ref: NearTap; bounds: Rect; state: InteractState }, hit: boolean): InteractPick => ({
    ref: c.ref, bounds: c.bounds, state: c.state, priority: interactPriority(c.state), label: interactLabel(c.state), hit,
  });

  return {
    /** A2: BUILD mode. The small pieces (wall items, decor on a surface, riders, walk-over decor) with a touch box and a tolerance, so they can be selected and dragged; null = none near. */
    buildPick(screen: Point): FurnitureItem | null {
      const targets: TapTarget<FurnitureItem>[] = [];
      for (const item of st.items) {
        if (item.roomId !== st.room.id || !isTinyPiece(getFurnitureType(item.typeId), item.onItemUid)) continue;
        const b = itemViews.screenBounds(item.uid);
        if (b) targets.push({ ref: item, bounds: b, depth: item.y + (item.onItemUid === null ? 0 : 1) });
      }
      return pickTap(screen, targets, opts())?.target.ref ?? null;
    },
    /** The usable thing a tap at this screen point would pick (hit first, then priority, then the nearest centre), or null. */
    pickAt(screen: Point): InteractPick | null {
      const list = candidates();
      const targets: TapTarget<number>[] = list.map((c, i) => ({ ref: i, bounds: c.bounds, depth: c.depth, priority: interactPriority(c.state) }));
      const p = pickTap(screen, targets, opts());
      return p ? toPick(list[p.target.ref]!, p.hit) : null;
    },
    nearTap(screen: Point): NearTap | null {
      return this.pickAt(screen)?.ref ?? null;
    },
    /** The state and label of one piece (for an exact Pixi hit), or null when it has no use. */
    pickOfItem(item: FurnitureItem): InteractPick | null {
      const state = itemState(item, st.tavern?.cooks ? machineStates(st.tavern, extras.now?.() ?? Date.now()) : null);
      const b = itemViews.screenBounds(item.uid);
      return state && b ? toPick({ ref: { kind: 'item', item }, bounds: b, state }, true) : null;
    },
    /** For the E key, Tab and the context button: every usable thing with its WORLD area (from the drawn bounds) and priority. */
    reachables(): Reachable<InteractPick>[] {
      return candidates().map((c) => {
        const a = screenToWorld({ x: c.bounds.x, y: c.bounds.y }, st.shown);
        const b = screenToWorld({ x: c.bounds.x + c.bounds.w, y: c.bounds.y + c.bounds.h }, st.shown);
        const pick = toPick(c, true);
        return { ref: pick, area: { x: a.x, y: a.y, w: b.x - a.x, h: b.y - a.y }, priority: pick.priority };
      });
    },
    /** The pick options now (touch or mouse, big tap targets on or off). */
    options: opts,
  };
}
