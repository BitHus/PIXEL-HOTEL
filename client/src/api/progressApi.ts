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
  claimQuest,
  achievementsClaimed,
  buySkill,
  respecSkills,
  skillsView,
  unlearnSkill,
  type SkillsView,
  dayInfo,
  questBoard,
  tutorialCookSupplies,
  type QuestBoard,
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

  // SK-1: opening the panel (getSkills) starts a new undo list: ranks bought since then come back for free (h.skillUndo, one entry per rank).
  async getSkills(h: LocalGameAPI): Promise<SkillsView> {
    h.skillUndo = [];
    return progressApi.skillsNow(h);
  },

  skillsNow(h: LocalGameAPI): SkillsView {
    return skillsView(h.state.player, { achieved: achievementsClaimed(h.state), undo: h.skillUndo });
  },

  async buySkill(h: LocalGameAPI, id: string): Promise<SkillsView | null> {
    const next = buySkill(h.state, id);
    if (!next) return null;
    h.commit(next);
    h.skillUndo = [...h.skillUndo, id];
    return progressApi.skillsNow(h);
  },

  async unlearnSkill(h: LocalGameAPI, id: string): Promise<SkillsView | null> {
    const undo = h.skillUndo.includes(id);
    const next = unlearnSkill(h.state, id, h.now(), undo);
    if (!next) return null;
    h.commit(next);
    if (undo) {
      const i = h.skillUndo.lastIndexOf(id);
      h.skillUndo = [...h.skillUndo.slice(0, i), ...h.skillUndo.slice(i + 1)];
    }
    return progressApi.skillsNow(h);
  },

  async respecSkills(h: LocalGameAPI): Promise<SkillsView | null> {
    const next = respecSkills(h.state, h.now());
    if (!next) return null;
    h.commit(next);
    h.skillUndo = [];
    return progressApi.skillsNow(h);
  },

  async getQuestBoard(h: LocalGameAPI, tzOffsetMin: number): Promise<QuestBoard> {
    return questBoard(h.state, dayInfo(h.now(), tzOffsetMin));
  },

  async claimQuest(h: LocalGameAPI, claimId: string, tzOffsetMin: number): Promise<{ gold: number } | null> {
    const next = claimQuest(h.state, claimId, dayInfo(h.now(), tzOffsetMin), h.now());
    if (!next) return null;
    const gold = next.player.wallet.gold - h.state.player.wallet.gold;
    h.commit(next);
    return { gold };
  },

  /** The tutorial's stove step: when the bag has nothing to cook, gives 2 turnips (reason 'start'). True = given. */
  async ensureTutorialCookSupplies(h: LocalGameAPI): Promise<boolean> {
    const next = tutorialCookSupplies(h.state, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async currentHint(h: LocalGameAPI): Promise<string | null> {
    const i = h.state.hintsDone;
    // The dungeon hint only shows while no run is going.
    // The mine hint (step 9c) waits until the mine opens.
    if (i === MINE_HINT && h.state.player.level < MINE_UNLOCK_LEVEL) return null;
    if (i === DUNGEON_HINT) return !h.state.run ? (HINTS[i] ?? null) : null;
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
