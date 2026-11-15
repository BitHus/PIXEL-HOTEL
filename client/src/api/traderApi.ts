// LocalGameAPI helper: the trader (step S2). The only caller of the shared sell rule, and only when the player taps Sell:
// no clock, no tick and no catch-up ever calls it (shared/src/trader.test.ts scans for it).

import { sell, sellRows, type SellKind, type SellResult, type SellRow } from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const traderApi = {
  async getSellRows(h: LocalGameAPI): Promise<SellRow[]> {
    return sellRows(h.state);
  },

  async sell(h: LocalGameAPI, kind: SellKind, id: string, qty: number): Promise<SellResult | null> {
    const res = sell(h.state, kind, id, qty, h.now());
    if (!res) return null;
    h.commit(res.state);
    return res.result;
  },
};
