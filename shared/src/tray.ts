// The waiter's tray (COD-1, owner playtest 2). Pure rules on plain data.
//
// One pour = ONE mug. Poured mugs (and picked-up dishes) ride on a tray, at most TRAY_MAX. A mug is not bound to the guest it was
// poured for: it goes to ANY guest whose open order is that item (guestsWaitingFor lights those guests up). Tapping a guest with a
// matching mug on the tray carries exactly ONE mug there, never the whole stack. The ORDERS STRIP data (one chip per open order)
// is made here too, so the client only draws it.

import { GUEST_PATIENCE_MS, GUEST_PATIENCE_WARN_MS, TRAY_MAX } from './config.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import type { Guest, TavernState } from './tavern.ts';
import type { MaterialId } from './types.ts';

/** One mug or dish on the tray. `perfect` = poured in the perfect window (a small tip on delivery). */
export interface TrayMug {
  item: MaterialId;
  perfect?: boolean;
}

/** True while the tray has no room for another mug. */
export function trayFull(t: Pick<TavernState, 'tray'>, max = TRAY_MAX): boolean {
  return t.tray.length >= max;
}

/** The guests with an OPEN order for exactly this item (they pulse while a matching mug is on the tray), in guest order. */
export function guestsWaitingFor(t: Pick<TavernState, 'guests'>, item: MaterialId): number[] {
  return t.guests.filter((g) => g.phase === 'order' && g.order?.item === item).map((g) => g.id);
}

/** The guests the tray can serve right now: open orders for any item on the tray. */
export function guestsTrayCanServe(t: Pick<TavernState, 'guests' | 'tray'>): number[] {
  const items = new Set(t.tray.map((m) => m.item));
  return t.guests.filter((g) => g.phase === 'order' && g.order !== null && items.has(g.order.item)).map((g) => g.id);
}

/** The tray without ONE mug of `item` (a perfect one goes first, it earns the tip), and that mug. Null = none of that item. */
export function takeMug(tray: readonly TrayMug[], item: MaterialId): { tray: TrayMug[]; mug: TrayMug } | null {
  let i = tray.findIndex((m) => m.item === item && m.perfect === true);
  if (i < 0) i = tray.findIndex((m) => m.item === item);
  if (i < 0) return null;
  return { tray: tray.filter((_, k) => k !== i), mug: tray[i]! };
}

/** Puts every mug of the tray back in the bag (ledger 'tap', no finds). Null with an empty tray. */
export function returnTray(state: GameState, at: number): GameState | null {
  const tray = state.tavern.tray;
  if (tray.length === 0) return null;
  const materials: Partial<Record<MaterialId, number>> = {};
  for (const m of tray) materials[m.item] = (materials[m.item] ?? 0) + 1;
  const back = applyChange(state, { reason: 'tap', materials, notFound: { ...materials }, note: 'tray put back' }, at);
  return back ? { ...back, tavern: { ...back.tavern, tray: [] } } : null;
}

/** What one chip of the orders strip shows. */
export interface OrderChip {
  guestId: number;
  item: MaterialId;
  /** Patience left, 0..1 (1 = just ordered). */
  patience: number;
  /** The guest called out (patience at or under the warning mark). */
  urgent: boolean;
  /** waiting = nobody is on it; queued = in the serve queue (the avatar goes to pour it); ready = a matching mug is on the tray. */
  state: 'waiting' | 'queued' | 'ready';
}

/** The orders strip: one chip per open order, the guest who waits longest first (least patience left). */
export function ordersStrip(t: Pick<TavernState, 'guests' | 'tray' | 'serveQueue'>): OrderChip[] {
  const have = new Map<MaterialId, number>();
  for (const m of t.tray) have.set(m.item, (have.get(m.item) ?? 0) + 1);
  const open = t.guests.filter((g): g is Guest & { order: NonNullable<Guest['order']> } => g.phase === 'order' && g.order !== null);
  const sorted = [...open].sort((a, b) => a.patienceMs - b.patienceMs);
  const chips: OrderChip[] = [];
  for (const g of sorted) {
    const left = have.get(g.order.item) ?? 0;
    const ready = left > 0;
    if (ready) have.set(g.order.item, left - 1); // one mug serves one guest
    chips.push({
      guestId: g.id,
      item: g.order.item,
      patience: Math.max(0, Math.min(1, g.patienceMs / GUEST_PATIENCE_MS)),
      urgent: g.patienceMs <= GUEST_PATIENCE_WARN_MS,
      state: ready ? 'ready' : t.serveQueue.includes(g.id) ? 'queued' : 'waiting',
    });
  }
  return chips;
}
