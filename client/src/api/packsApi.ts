// LocalGameAPI helpers: packs. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  buyHat,
  openPack,
  PACK_HINT,
  type PackOpenResult,
} from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const packsApi = {
  async openPack(h: LocalGameAPI, packId: string): Promise<PackOpenResult | null> {
    const res = openPack(h.state, packId, h.rng, h.now());
    if (!res) return null;
    h.commit(h.hintDone(res.state, PACK_HINT));
    return { packId, finds: res.finds, gains: res.gains };
  },

  async buyHat(h: LocalGameAPI, hatId: string): Promise<boolean> {
    const next = buyHat(h.state, hatId, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },
};
