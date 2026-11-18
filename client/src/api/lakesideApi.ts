// LocalGameAPI helpers: lakeside. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  gainsSince,
  CHOP_REACH_PX,
  bankCatch,
  chop,
  fishDone,
  fishStep,
  growTrees,
  isStump,
  nearestCastSpot,
  bobberPoint,
  newFishSession,
  bonusesOf,
  regrowInMs,
  treeAnchor,
  findPath,
  type GainList,
  type CastPlan,
  type ChopUpdate,
  type FishInput,
  type FishSession,
  type FishUpdate,
  type LakesideView,
  type Point,
} from '@pixel-hotel/shared';
import { finitePoint } from './apiShared.ts';
import type { LocalGameAPI } from './localGameAPI.ts';

export const lakesideApi = {
  async getLakeside(h: LocalGameAPI): Promise<LakesideView> {
    return h.lakesideView();
  },

  async chopTree(h: LocalGameAPI, index: number): Promise<ChopUpdate | null> {
    if (h.room().kind !== 'lakeside') return null;
    const tree = (() => {
      try {
        return treeAnchor(index);
      } catch {
        return null;
      }
    })();
    if (!tree) return null;
    // The avatar must stand next to the tree.
    const me = h.avatarNow();
    if (Math.hypot(me.x - tree.x, me.y - tree.y) > CHOP_REACH_PX) return null;
    const r = chop(h.state, index, h.now(), h.rng);
    if (!r) return null;
    const gains = gainsSince(h.state, r.state);
    if (r.state !== h.state) h.commit(r.state);
    return { kind: r.result.kind, hits: r.result.hits, ...(r.result.loot ? { loot: r.result.loot } : {}), gains, lakeside: h.lakesideView() };
  },

  async castAt(h: LocalGameAPI, target: Point): Promise<CastPlan | null> {
    if (h.room().kind !== 'lakeside' || !finitePoint(target)) return null;
    const avatar = h.standingAvatar(target);
    const spot = nearestCastSpot(h.grid, avatar, target);
    if (!spot) return null;
    const path = findPath(h.grid, avatar, spot);
    if (!path) return null;
    h.fish = null;
    h.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: h.now(), sitOn: null, seated: null };
    return { path, spot, bobber: bobberPoint(spot, target) };
  },

  async fishStart(h: LocalGameAPI): Promise<FishSession | null> {
    if (h.room().kind !== 'lakeside') return null;
    if (h.fish && !fishDone(h.fish)) return structuredClone(h.fish);
    h.fish = newFishSession(h.rng, h.state.player.gear, bonusesOf(h.state.player));
    return structuredClone(h.fish);
  },

  async fishStep(h: LocalGameAPI, inputs: readonly FishInput[], dtMs: number): Promise<FishUpdate | null> {
    if (!h.fish) return null;
    const next = fishStep(h.fish, inputs, dtMs, h.rng);
    h.fish = next;
    let caught: FishUpdate['caught'] = null;
    let gains: GainList = [];
    if (next.phase === 'done') {
      h.fish = null;
      if (next.outcome === 'caught') {
        const before = h.state.player.biggest[next.catchId] ?? 0;
        const banked = bankCatch(h.state, next, h.now(), h.rng);
        if (banked) {
          gains = gainsSince(h.state, banked);
          h.commit(banked);
          caught = { id: next.catchId, rank: next.rank, cm: next.cm, record: next.cm !== null && next.cm > before };
        }
      }
    }
    return { session: structuredClone(next), caught, gains };
  },

  async fishStop(h: LocalGameAPI): Promise<void> {
    h.fish = null;
  },

  lakesideView(h: LocalGameAPI): LakesideView {
    const now = h.now();
    const lake = growTrees(h.state.lakeside, now);
    return {
      roomId: lake.roomId,
      trees: lake.trees.map((t) => ({ hits: t.hits, regrowInMs: isStump(t, now) ? regrowInMs(t, now) : null })),
      at: now,
    };
  },
};
