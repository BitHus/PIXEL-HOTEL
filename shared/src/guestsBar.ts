// TF-3 (docs/PLAN-TAVERN-FLOW.md): the hand-over to a BAR GUEST, the grab-all and the serve route. Pure: rng passed in.
//
// A bar guest does not get a mug carried to a table: the player pours at the tap, stands on the staff side of the bar and taps the guest (or the chip): ONE mug
// of the tray goes to them (handOver), they drink 6 to 10 s on the spot, then leave the coins and the empty mug ON THE BAR (guests.ts, Mess with seatUid = the bar piece).

import { BAR_DRINK_MAX_MS, BAR_DRINK_MIN_MS, BAR_PATIENCE_MS, BAR_SPEED_TIP_MS, BAR_SPEED_TIP_RATE, GUEST_SIP_MAX_MS, GUEST_SIP_MIN_MS, SERVE_QUEUE_MAX } from './config.ts';
import type { GameState } from './gameState.ts';
import { pourTip } from './pour.ts';
import { bonusesOf, trayMaxOf } from './skillRules.ts';
import { takeMug, type TrayMug } from './tray.ts';
import { openOrders, requestServe, type Guest } from './tavern.ts';
import type { MaterialId, Point, Rng } from './types.ts';

const between = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo));

/** The extra tip for a bar guest served fast: BAR_SPEED_TIP_RATE of the price when served within BAR_SPEED_TIP_MS of ordering (patience counts down from BAR_PATIENCE_MS). */
export function speedTip(patienceMs: number, price: number): number {
  return BAR_PATIENCE_MS - patienceMs <= BAR_SPEED_TIP_MS ? Math.round(price * BAR_SPEED_TIP_RATE) : 0;
}

/**
 * The player hands ONE mug of the tray to the bar guest `guestId`: they start drinking on the spot. The mug is one of the guest's own item (a perfect one first,
 * as for tables); the coins they leave grow by the perfect-pour tip and the speed tip. Null when that guest is not a bar guest with an open order, or the tray has no mug of it.
 */
export function handOver(state: GameState, rng: Rng, guestId: number): { state: GameState; guestId: number; item: MaterialId; tip: number } | null {
  const guest = state.tavern.guests.find((g) => g.id === guestId && g.kind2 === 'bar' && g.phase === 'order');
  const taken = guest?.order ? takeMug(state.tavern.tray, guest.order.item) : null;
  if (!guest || !guest.order || !taken) return null;
  const tip = pourTip(taken.mug.perfect === true, guest.order.price) + speedTip(guest.patienceMs, guest.order.price);
  const drinking: Guest = { ...guest, order: { ...guest.order, coins: guest.order.coins + tip }, phase: 'bar_drink', waitMs: between(rng, BAR_DRINK_MIN_MS, BAR_DRINK_MAX_MS), sipInMs: between(rng, GUEST_SIP_MIN_MS, GUEST_SIP_MAX_MS) };
  return { state: { ...state, tavern: { ...state.tavern, tray: taken.tray, guests: state.tavern.guests.map((g) => (g.id === guest.id ? drinking : g)) } }, guestId: guest.id, item: taken.mug.item, tip };
}

/**
 * GRAB ALL: queues one pour per open order of the MOST urgent item (the open order with the least patience that nothing has claimed yet), up to the free tray
 * slots and SERVE_QUEUE_MAX; requestServe keeps "never more pours than guests want that item". Null when nothing could be queued. `queued` = the guests added.
 */
export function grabAll(state: GameState): { state: GameState; queued: number[]; item: MaterialId } | null {
  const t0 = state.tavern;
  const trayMax = trayMaxOf(bonusesOf(state.player));
  const open = [...openOrders(t0)].sort((a, b) => a.patienceMs - b.patienceMs);
  const claimedBy = (item: MaterialId, s: GameState): number => s.tavern.tray.filter((m) => m.item === item).length + s.tavern.serveQueue.filter((id) => s.tavern.guests.some((g) => g.id === id && g.order?.item === item)).length;
  // The most urgent item that still has a guest nobody is on.
  const first = open.find((g) => g.order && claimedBy(g.order.item, state) < open.filter((o) => o.order?.item === g.order!.item).length);
  if (!first?.order) return null;
  const item = first.order.item;
  let s = state;
  const queued: number[] = [];
  for (const g of open) {
    if (g.order?.item !== item) continue;
    if (s.tavern.tray.length + s.tavern.serveQueue.length >= trayMax || s.tavern.serveQueue.length >= SERVE_QUEUE_MAX) break;
    const next = requestServe(s, g.id);
    if (next) {
      s = next;
      queued.push(g.id);
    }
  }
  return queued.length > 0 ? { state: s, queued, item } : null;
}

/**
 * SERVE ALL route (plan section 2): which open order each tray item serves (the guest with the least patience first for an item) and the order of the tour:
 * bar guests first (nearest first from `from`, then each next nearest), then table guests the same way. Pure; `where` is read from Guest.kind2.
 */
export function serveRoute(tray: readonly TrayMug[], guests: readonly Guest[], from: Point): number[] {
  const open = guests.filter((g) => g.phase === 'order' && g.order !== null).sort((a, b) => a.patienceMs - b.patienceMs);
  const left = [...tray];
  const targets: Guest[] = [];
  for (const g of open) {
    const taken = takeMug(left, g.order!.item);
    if (!taken) continue;
    left.splice(0, left.length, ...taken.tray);
    targets.push(g);
  }
  const tour = (list: Guest[], start: Point): { ids: number[]; end: Point } => {
    const rest = [...list];
    const ids: number[] = [];
    let at = start;
    while (rest.length > 0) {
      let bi = 0;
      for (let i = 1; i < rest.length; i++) {
        if (Math.hypot(rest[i]!.x - at.x, rest[i]!.y - at.y) < Math.hypot(rest[bi]!.x - at.x, rest[bi]!.y - at.y)) bi = i;
      }
      const g = rest.splice(bi, 1)[0]!;
      ids.push(g.id);
      at = { x: g.x, y: g.y };
    }
    return { ids, end: at };
  };
  const bar = tour(targets.filter((g) => g.kind2 === 'bar'), from);
  const table = tour(targets.filter((g) => g.kind2 !== 'bar'), bar.end);
  return [...bar.ids, ...table.ids];
}
