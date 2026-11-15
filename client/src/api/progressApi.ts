// LocalGameAPI helpers: book, hints and gains. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  completeQuest,
  GEMS_GAIN_ID,
  mergeGains,
  gainsSince,
  DUNGEON_HINT,
  HINTS,
  MINE_HINT,
  MINE_UNLOCK_LEVEL,
  claimBookReward,
  openBook,
  type BookClaim,
  type GainList,
  type BookTab,
  type GameState,
} from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const progressApi = {
  async bookOpened(h: LocalGameAPI): Promise<void> {
    h.commit(openBook(h.state, h.now()));
  },

  async claimBookReward(h: LocalGameAPI, tab: BookTab, percent: number): Promise<BookClaim | null> {
    const next = claimBookReward(h.state, tab, percent, h.now(), h.rng);
    if (!next) return null;
    const gold = next.player.wallet.gold - h.state.player.wallet.gold;
    const gems = next.player.wallet.gems - h.state.player.wallet.gems;
    h.commit(next);
    return { gold, gems, gains: gems > 0 ? [{ itemId: GEMS_GAIN_ID, count: gems, rank: 'common' }] : [] };
  },

  async currentHint(h: LocalGameAPI): Promise<string | null> {
    const i = h.state.hintsDone;
    // The dungeon hint only shows while the shop has nothing for sale (and no run is going).
    // The mine hint (step 9c) waits until the mine opens.
    if (i === MINE_HINT && h.state.player.level < MINE_UNLOCK_LEVEL) return null;
    if (i === DUNGEON_HINT) return !h.state.run && !h.state.shop.slots.some((s) => s.loot) ? (HINTS[i] ?? null) : null;
    return HINTS[i] ?? null;
  },

  /** Marks hint `index` done when it is the one showing (hints go one at a time). */
  hintDone(h: LocalGameAPI, state: GameState, index: number): GameState {
    const next = completeQuest(state, index, h.now(), h.rng);
    // The quest's gems are handed to the client by takeGains (the call that finished the quest has its own result).
    if (next !== state) h.pendingGains = mergeGains(h.pendingGains, gainsSince(state, next));
    return next;
  },

  async takeGains(h: LocalGameAPI): Promise<GainList> {
    const out = h.pendingGains;
    h.pendingGains = [];
    return out;
  },
};
