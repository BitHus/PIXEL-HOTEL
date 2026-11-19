import { describe, expect, it } from 'vitest';
import type { OrderChip } from '@pixel-hotel/shared';
import { bestGuestForTrayItem, chipTitle, showGrabAll, showServeAll } from './ordersStripLogic.ts';

const chip = (guestId: number, item: string, state: OrderChip['state'], where: OrderChip['where'] = 'table'): OrderChip =>
  ({ guestId, item: item as OrderChip['item'], patience: 0.5, urgent: false, state, where });

describe('orders strip logic', () => {
  it('Grab all needs 2 idle orders of one item', () => {
    expect(showGrabAll([chip(1, 'root_ale', 'waiting')])).toBe(false);
    expect(showGrabAll([chip(1, 'root_ale', 'waiting'), chip(2, 'root_ale', 'waiting', 'bar')])).toBe(true);
    expect(showGrabAll([chip(1, 'root_ale', 'queued'), chip(2, 'root_ale', 'waiting')])).toBe(false);
  });
  it('Serve all needs 2 ready orders', () => {
    expect(showServeAll([chip(1, 'a', 'ready')])).toBe(false);
    expect(showServeAll([chip(1, 'a', 'ready'), chip(2, 'b', 'ready')])).toBe(true);
  });
  it('a tray icon serves the ready order of its item first, never one being poured', () => {
    expect(bestGuestForTrayItem([chip(1, 'a', 'waiting'), chip(2, 'a', 'ready')], 'a' as never)).toBe(2);
    expect(bestGuestForTrayItem([chip(1, 'a', 'pouring')], 'a' as never)).toBeNull();
    expect(bestGuestForTrayItem([chip(1, 'b', 'ready')], 'a' as never)).toBeNull();
  });
  it('titles say bar or table', () => {
    expect(chipTitle({ state: 'ready', where: 'bar' })).toContain('hand it over');
    expect(chipTitle({ state: 'pouring', where: 'table' })).toContain('Pouring');
  });
});
