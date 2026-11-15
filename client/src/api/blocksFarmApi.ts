// LocalGameAPI helpers: blocks, farm and cooking. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  gainsSince,
  FARM_HINT,
  buySeeds,
  buyBlocks,
  approachSpot,
  placeBlock,
  hitBlock,
  hitPlant,
  inReach,
  plantSeed,
  SPLICE_HINT,
  spliceSeed,
  farmCounts,
  repathGuests,
  repathCustomers,
  findPath,
  type GainList,
  type BlockResult,
  type FarmView,
  type FoodId,
  type RoomLevel,
  type SeedId,
  type Avatar,
  type GameState,
} from '@pixel-hotel/shared';
import type { LocalGameAPI } from './localGameAPI.ts';

export const blocksFarmApi = {
  async placeBlock(h: LocalGameAPI, c: number, r: number, blockId: string): Promise<BlockResult> {
    const room = h.room();
    const me = h.avatarNow();
    const res = placeBlock(h.state, room.id, c, r, blockId, h.now(), { standing: h.standingPoints(), from: me });
    if (!res.ok) return res.problem === 'reach' ? h.walkCloser(me, c, r) : { kind: 'refused', problem: res.problem };
    h.commitBlocks(res.state);
    return { kind: 'placed', room: h.roomById(room.id)!, c, r, gains: [] };
  },

  async hitBlock(h: LocalGameAPI, c: number, r: number): Promise<BlockResult> {
    const room = h.room();
    const me = h.avatarNow();
    const now = h.now();
    const res = hitBlock(h.state, room.id, c, r, now, h.lastBlockHitAt, h.rng, me);
    if (!res.ok) return res.problem === 'reach' ? h.walkCloser(me, c, r) : { kind: 'refused', problem: res.problem };
    h.lastBlockHitAt = now;
    if (res.kind === 'cracked') {
      h.commit(res.state);
      return { kind: 'cracked', room: h.roomById(room.id)!, c, r, hits: res.hits, hardness: res.hardness, gains: [] };
    }
    const gains = gainsSince(h.state, res.state);
    h.commitBlocks(res.state);
    return { kind: 'broken', room: h.roomById(room.id)!, c, r, gains };
  },

  async buyBlocks(h: LocalGameAPI, blockId: string, qty: number): Promise<GainList | null> {
    const next = buyBlocks(h.state, blockId, qty, h.now());
    return next ? h.commitGains(next) : null;
  },

  /** Plants a seed in a soil cell (step BG6): within reach, else the avatar walks closer first. */
  async plantSeed(h: LocalGameAPI, c: number, r: number, seed: SeedId): Promise<BlockResult> {
    const room = h.room();
    const me = h.avatarNow();
    const res = plantSeed(h.state, room.id, c, r, seed, h.now(), { standing: h.standingPoints(), from: me });
    if (!res.ok) return res.problem === 'reach' ? h.walkCloser(me, c, r) : { kind: 'refused', problem: res.problem };
    // The farm quest: plant your first seed (any seed counts).
    h.commitBlocks(h.hintDone(res.state, FARM_HINT));
    return { kind: 'planted', room: h.roomById(room.id)!, c, r, gains: [] };
  },

  /** One punch at a plant (step BG6): a grown one is harvested, an unripe one is left alone. */
  async hitPlant(h: LocalGameAPI, c: number, r: number): Promise<BlockResult> {
    const room = h.room();
    const me = h.avatarNow();
    const now = h.now();
    const res = hitPlant(h.state, room.id, c, r, now, h.lastBlockHitAt, h.rng, me);
    if (!res.ok) {
      if (res.problem === 'reach') return h.walkCloser(me, c, r);
      if (res.problem === 'unripe') return { kind: 'unripe', c, r, leftMs: res.leftMs ?? 0 };
      return { kind: 'refused', problem: res.problem };
    }
    h.lastBlockHitAt = now;
    const gains = gainsSince(h.state, res.state);
    const clothing = res.state.player.unlockedClothing.find((id) => !h.state.player.unlockedClothing.includes(id));
    const recipe = res.state.player.splicesFound.find((k) => !h.state.player.splicesFound.includes(k));
    h.commitBlocks(res.state);
    return { kind: 'harvested', room: h.roomById(room.id)!, c, r, gains, ...(clothing ? { clothing } : {}), ...(recipe ? { recipe } : {}) };
  },

  /** A second seed on a planted cell (step BG7): within reach, else the avatar walks closer first. */
  async spliceSeed(h: LocalGameAPI, c: number, r: number, seed: SeedId): Promise<BlockResult> {
    const room = h.room();
    const me = h.avatarNow();
    const res = spliceSeed(h.state, room.id, c, r, seed, h.now());
    if (!res.ok) return { kind: 'refused', problem: res.problem };
    if (!inReach(me, c, r)) return h.walkCloser(me, c, r);
    h.commitBlocks(h.hintDone(res.state, SPLICE_HINT));
    return { kind: 'spliced', room: h.roomById(room.id)!, c, r, gains: [] };
  },

  async buySeeds(h: LocalGameAPI, seed: SeedId, qty: number): Promise<GainList | null> {
    const next = buySeeds(h.state, seed, qty, h.now());
    return next ? h.commitGains(next) : null;
  },

  async getFarm(h: LocalGameAPI): Promise<FarmView> {
    return h.farmView();
  },

  farmView(h: LocalGameAPI): FarmView {
    const room = h.roomById(h.state.player.farmRoomId);
    const at = h.now();
    const counts = room ? farmCounts(room, at) : { ripe: 0, growing: 0, free: 0 };
    return { roomId: h.state.player.farmRoomId, level: (room?.level ?? 1) as RoomLevel, ...counts, at };
  },

  /** A block cell is out of reach: walk to a spot near it; the client asks again on arrival. */
  walkCloser(h: LocalGameAPI, me: Avatar, c: number, r: number): BlockResult {
    const spot = approachSpot(h.grid, me, c, r);
    const path = spot && findPath(h.grid, me, spot);
    if (!path) return { kind: 'refused', problem: 'reach' };
    h.walkState = { avatar: { ...me, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: h.now(), sitOn: null, seated: null };
    return { kind: 'walk', path };
  },

  /** A block was placed or broken: save, rebuild the grids and send the customers round the new walls. */
  commitBlocks(h: LocalGameAPI, next: GameState): void {
    h.commit(next);
    h.grid = h.buildGrid();
    h.shopGrid = null;
    if (h.state.currentRoomId === h.state.shop.roomId) {
      h.commit(repathGuests(repathCustomers(h.state, h.shopWorld(h.state)), h.tavernWorld(h.state)));
    }
  },
};
