// LocalGameAPI helpers: dungeon, mine and forge. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  gain,
  gainsFromRunEvents,
  DUNGEON_HINT,
  RECIPES,
  RUN_SAVE_EVERY_MS,
  forgePiece,
  smelt,
  startMine,
  MINE_HINT,
  buyGear,
  craft as craftRecipe,
  finishRun,
  startRun,
  step,
  rngInt,
  type GainList,
  type BarId,
  type GearId,
  type FoodId,
  type DungeonInput,
  type DungeonRun,
  type RunResult,
  type RunUpdate,
  type RunView,
  type ShopGearId,
} from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const dungeonApi = {
  async getRun(h: LocalGameAPI): Promise<RunView | null> {
    const run = h.state.run;
    return run ? { run, paused: h.runPaused } : null;
  },

  async dungeonStart(h: LocalGameAPI, lunch: readonly FoodId[] = []): Promise<DungeonRun | null> {
    if (h.state.run) return null;
    const seed = rngInt(h.rng, 1, 2 ** 31 - 1);
    const r = startRun(h.state, seed, h.now(), undefined, lunch);
    // The dungeon hint is done once the player goes in.
    h.commit({ ...h.hintDone(r.state, DUNGEON_HINT), run: r.run });
    h.runPaused = false;
    h.runSavedAt = 0;
    return r.run;
  },

  async dungeonInput(h: LocalGameAPI, input: DungeonInput): Promise<RunUpdate | null> {
    const run = h.state.run;
    if (!run || h.runPaused) return null;
    return h.applyRun(step(run, [input], 0, h.rng));
  },

  async dungeonAdvance(h: LocalGameAPI, dtMs: number): Promise<RunUpdate | null> {
    const run = h.state.run;
    if (!run) return null;
    if (h.runPaused || !(dtMs > 0)) return { run, result: null, gains: [] };
    return h.applyRun(step(run, [], dtMs, h.rng));
  },

  async dungeonPause(h: LocalGameAPI): Promise<void> {
    if (h.state.run) h.runPaused = true;
  },

  async dungeonResume(h: LocalGameAPI): Promise<void> {
    h.runPaused = false;
  },

  async craft(h: LocalGameAPI, recipeId: string): Promise<GainList | null> {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    const next = recipe ? craftRecipe(recipe, h.state, h.now()) : null;
    return next ? h.commitGains(next) : null;
  },

  async buyGear(h: LocalGameAPI, id: ShopGearId): Promise<GainList | null> {
    const next = buyGear(h.state, id, h.now());
    if (!next) return null;
    h.commit(next);
    // Gear and potions are not in the ledger's materials: the piece itself is the gain.
    return [gain(id)];
  },

  async mineStart(h: LocalGameAPI): Promise<DungeonRun | null> {
    if (h.state.run) return null;
    const seed = rngInt(h.rng, 1, 2 ** 31 - 1);
    const r = startMine(h.state, seed);
    if (!r) return null;
    h.commit({ ...h.hintDone(r.state, MINE_HINT), run: r.run });
    h.runPaused = false;
    h.runSavedAt = 0;
    return r.run;
  },

  async smelt(h: LocalGameAPI, bar: BarId): Promise<GainList | null> {
    const next = smelt(h.state, bar, h.now());
    return next ? h.commitGains(next) : null;
  },

  async forge(h: LocalGameAPI, piece: GearId): Promise<GainList | null> {
    const next = forgePiece(h.state, piece, h.now());
    if (!next) return null;
    h.commit(next);
    return [gain(piece)];
  },

  /**
   * Keeps a stepped run. A run that ended is banked at once (finishRun: the ledger, xp, potions)
   * and removed from the state, so it can never be banked twice. A going run is saved when
   * something happened, and at least every RUN_SAVE_EVERY_MS of run time.
   */
  applyRun(h: LocalGameAPI, next: DungeonRun): RunUpdate {
    if (next.status === 'left' || next.status === 'dead') {
      const before = h.state.player;
      const banked = finishRun({ ...h.state, run: null }, next, h.now()) ?? { ...h.state, run: null };
      h.commit(banked);
      const result: RunResult = {
        status: next.status,
        place: next.place,
        lanternOut: next.events.some((e) => e.t === 'lantern_out'),
        banked: next.banked,
        lost: next.lost,
        xpGained: next.xpGained,
        levelBefore: before.level,
        levelAfter: banked.player.level,
        floor: next.floor,
        lastHitBy: next.lastHitBy,
      };
      return { run: next, result, gains: gainsFromRunEvents(next.events) };
    }
    const worth = next.events.some((e) => e.t !== 'windup') || next.status !== h.state.run?.status;
    if (worth || next.timeMs - h.runSavedAt >= RUN_SAVE_EVERY_MS) {
      h.runSavedAt = next.timeMs;
      h.commit({ ...h.state, run: next });
    } else {
      h.state = { ...h.state, run: next };
    }
    return { run: next, result: null, gains: gainsFromRunEvents(next.events) };
  },
};
