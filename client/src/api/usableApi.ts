// LocalGameAPI helpers: usable furniture and the cat (step 9g-2). One area, like the other *Api files.

import { renamePet, useItem, type UseResult } from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const usableApi = {
  /** A tap on a usable piece (lamp, fire, music box, clock, mirror, basket, darts, dice). Null = nothing to use. Only on/off and the cat's adoption are saved. */
  async useItem(h: LocalGameAPI, uid: number): Promise<UseResult | null> {
    const d = new Date(h.now());
    const r = useItem(h.state, uid, d.getHours() * 60 + d.getMinutes(), h.rng);
    if (!r) return null;
    if (r.state !== h.state) h.commit(r.state);
    return r.result;
  },

  async renamePet(h: LocalGameAPI, name: string): Promise<boolean> {
    const next = renamePet(h.state, name);
    if (!next) return false;
    h.commit(next);
    return true;
  },
};
