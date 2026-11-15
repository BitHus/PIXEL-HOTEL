// LocalGameAPI helper: the catalog. The method takes the API instance first and does what the
// class method of the same name did (R1 split; the class delegates here).

import { gainsSince, buyCatalog, type BuyResult } from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const catalogApi = {
  async buyCatalog(h: LocalGameAPI, typeId: string): Promise<BuyResult | null> {
    const first = !h.state.ledger.some((e) => e.reason === 'catalog' || e.reason === 'style');
    const next = buyCatalog(h.state, typeId, h.now());
    if (!next) return null;
    const uid = next.ledger.at(-1)?.furnitureUids?.[0];
    if (uid === undefined) return null;
    const gains = gainsSince(h.state, next);
    h.commit(h.hintDone(next, 0));
    return { uid, first, gains };
  },
};
