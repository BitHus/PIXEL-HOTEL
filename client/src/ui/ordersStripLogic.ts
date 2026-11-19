// TF-7: the pure choices of the orders strip (which buttons show, which guest a tray icon serves). No DOM here.

import type { MaterialId, OrderChip } from '@pixel-hotel/shared';

/** Grab all shows when 2 or more orders that nobody works on share one item. */
export function showGrabAll(chips: readonly OrderChip[]): boolean {
  const n = new Map<MaterialId, number>();
  for (const c of chips) if (c.state === 'waiting') n.set(c.item, (n.get(c.item) ?? 0) + 1);
  return [...n.values()].some((v) => v >= 2);
}

/** Serve all shows when 2 or more orders have their mug ready on the tray. */
export function showServeAll(chips: readonly OrderChip[]): boolean {
  return chips.filter((c) => c.state === 'ready').length >= 2;
}

/** A tap on a tray icon serves the open order of that item with the least patience (the chips come least patience first), or null. */
export function bestGuestForTrayItem(chips: readonly OrderChip[], item: MaterialId): number | null {
  const open = chips.filter((c) => c.item === item && c.state !== 'pouring');
  const ready = open.find((c) => c.state === 'ready');
  return (ready ?? open[0])?.guestId ?? null;
}

/** The chip's hover text. */
export function chipTitle(c: Pick<OrderChip, 'state' | 'where'>): string {
  const where = c.where === 'bar' ? 'at the bar' : 'at a table';
  if (c.state === 'ready') return c.where === 'bar' ? `A mug is ready: tap to hand it over (${where})` : `A mug is ready: tap to carry it over (${where})`;
  if (c.state === 'pouring') return `Pouring now (${where})`;
  if (c.state === 'queued') return `Waiting to be poured (${where})`;
  return `Tap to pour this order (${where})`;
}
