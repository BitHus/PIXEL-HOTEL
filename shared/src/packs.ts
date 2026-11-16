// Packs bought with gems (step BG8, BLOCKS-PLAN 3.8). Pure: the rng and the time are passed in.
// FAIRNESS RULES (CLAUDE.md section 13): gems are earned in play only; the contents and the rank odds are shown on
// the pack's card before buying (packOdds); duplicates are allowed (a piece of clothing found again is a spare);
// no timers and no limited offers. A roll picks a RANK first (RANK_WEIGHTS times the pack's multiplier, as
// everywhere), then an item of that rank in the pool.

import packData from '../data/packs.json';
import { PACKS, SPARE_SELL } from './config.ts';
import { BLOCK_TYPES } from './blockTypes.ts';
import { CLOTHING, getClothing } from './clothing.ts';
import { applyChange, type Change } from './ledger.ts';
import { gainsSince, type GainList } from './gains.ts';
import type { GameState } from './gameState.ts';
import type { Icon } from './icons.ts';
import { CROP_TYPES, getMaterialType } from './materials.ts';
import { RANKS, rankFallback, rankWeights, rollRank } from './ranks.ts';
import type { MaterialId, Player, Rank, Rng } from './types.ts';

export type PackPool = 'blocks' | 'seeds' | 'clothing';
export type PackId = keyof typeof PACKS;

export interface PackType {
  id: PackId;
  name: string;
  /** What the pack costs and how many things it gives: config PACKS. */
  gemPrice: number;
  rolls: number;
  pool: PackPool;
  /** Multiplies RANK_WEIGHTS (missing = 1; 0 = never). */
  rankWeights: Partial<Record<Rank, number>>;
  icon: Icon;
}

interface PackData {
  id: PackId;
  name: string;
  pool: PackPool;
  rankWeights: Partial<Record<Rank, number>>;
  icon: Icon;
}

export const PACK_TYPES: readonly PackType[] = (packData as PackData[]).map((p) => ({ ...p, gemPrice: PACKS[p.id].gemPrice, rolls: PACKS[p.id].rolls }));

export function getPack(id: string): PackType | undefined {
  return PACK_TYPES.find((p) => p.id === id);
}

/** One thing a pack can give. */
export interface PackItem {
  kind: 'material' | 'clothing';
  /** A material id (a block or a seed) or a clothing id. */
  id: string;
  name: string;
  rank: Rank;
}

/** Everything a pool holds: all blocks; the crop seeds and block seeds; the clothing that is hidden until unlocked. */
export function packPool(pool: PackPool): PackItem[] {
  if (pool === 'blocks') return BLOCK_TYPES.map((b) => ({ kind: 'material', id: b.id, name: b.name, rank: b.rank }));
  if (pool === 'seeds') {
    const seeds: MaterialId[] = [...CROP_TYPES.filter((c) => !c.spliceOnly).map((c) => c.seed as MaterialId), ...BLOCK_TYPES.flatMap((b) => (b.seedId && !b.spliceOnly ? [b.seedId] : []))];
    return seeds.map((id) => {
      const m = getMaterialType(id);
      return { kind: 'material', id, name: m.name, rank: m.rank };
    });
  }
  return CLOTHING.filter((c) => !c.free && c.pack !== false).map((c) => ({ kind: 'clothing', id: c.id, name: c.name, rank: c.rank }));
}

/** One line of the odds on a pack card: a rank, its chance in percent, and the things it can be. */
export interface PackOddsRow {
  rank: Rank;
  percent: number;
  items: PackItem[];
}

/**
 * The odds a roll of this pack has, rank by rank, lowest first, ranks that cannot come left out. A rank with no item in
 * the pool passes its chance on (rankFallback), exactly like openPack. The percents add up to 100.
 */
export function packOdds(pack: PackType): PackOddsRow[] {
  const items = packPool(pack.pool);
  const has = RANKS.filter((r) => items.some((i) => i.rank === r));
  if (has.length === 0) return [];
  const w = rankWeights(pack.rankWeights);
  const total = RANKS.reduce((a, r) => a + w[r], 0);
  if (!(total > 0)) return [];
  const got: Record<Rank, number> = { common: 0, rare: 0, ultra_rare: 0, legendary: 0 };
  for (const r of RANKS) got[r === rankFallback(r, has) ? r : rankFallback(r, has)] += w[r];
  return RANKS.filter((r) => got[r] > 0).map((r) => ({ rank: r, percent: (got[r] / total) * 100, items: items.filter((i) => i.rank === r) }));
}

/** How many copies of a piece the player has: 0 = not unlocked, 1 = unlocked, 2 and more = spares too. */
export function copiesOwned(player: Pick<Player, 'unlockedClothing' | 'clothingSpares'>, id: string): number {
  const c = getClothing(id);
  if (!c) return 0;
  if (c.free) return 1;
  return player.unlockedClothing.includes(id) ? 1 + (player.clothingSpares[id] ?? 0) : 0;
}

/** For a clothes pack: how many of the pieces it can give the player still misses, and how many it can give in all. */
export function piecesMissing(player: Pick<Player, 'unlockedClothing'>, pack: PackType): { missing: number; total: number } {
  if (pack.pool !== 'clothing') return { missing: 0, total: 0 };
  const reachable = packOdds(pack).flatMap((row) => row.items);
  return { missing: reachable.filter((i) => !player.unlockedClothing.includes(i.id)).length, total: reachable.length };
}

/** What one roll gave. */
export interface PackFind {
  kind: 'material' | 'clothing';
  id: string;
  name: string;
  rank: Rank;
  /** Clothing: the first copy, which unlocks the piece for good. */
  isNew: boolean;
  /** Clothing: how many copies the player has after this one (2 = "Spare x2"). Materials: 0. */
  copies: number;
}

export interface PackOpened {
  state: GameState;
  finds: PackFind[];
  gains: GainList;
}

/**
 * Opens a pack: the gems go out, the things come in, all through the ledger (reason 'pack'). Null (nothing changes)
 * for an unknown pack, an empty pool or too few gems. A piece of clothing already owned is allowed: it becomes a
 * spare (never unlocks twice).
 */
export function openPack(state: GameState, packId: string, rng: Rng, at: number): PackOpened | null {
  const pack = getPack(packId);
  if (!pack) return null;
  const items = packPool(pack.pool);
  if (items.length === 0 || packOdds(pack).length === 0) return null;
  if ((state.player.wallet.gems ?? 0) < pack.gemPrice) return null;
  const has = RANKS.filter((r) => items.some((i) => i.rank === r));
  const materials: Partial<Record<MaterialId, number>> = {};
  const addClothing: string[] = [];
  const owned = new Map<string, number>();
  const finds: PackFind[] = [];
  for (let i = 0; i < pack.rolls; i++) {
    const rank = rollRank(rng, pack.rankWeights, has);
    const ofRank = items.filter((x) => x.rank === rank);
    const item = ofRank[Math.min(ofRank.length - 1, Math.floor(rng() * ofRank.length))]!;
    if (item.kind === 'material') {
      materials[item.id as MaterialId] = (materials[item.id as MaterialId] ?? 0) + 1;
      finds.push({ ...item, isNew: false, copies: 0 });
    } else {
      const before = owned.get(item.id) ?? copiesOwned(state.player, item.id);
      owned.set(item.id, before + 1);
      addClothing.push(item.id);
      finds.push({ ...item, isNew: before === 0, copies: before + 1 });
    }
  }
  const change: Change = { reason: 'pack', gems: -pack.gemPrice, materials, addClothing, note: pack.id };
  const next = applyChange(state, change, at);
  if (!next) return null;
  const opened = { ...next.player.packsOpened, [pack.id]: (next.player.packsOpened[pack.id] ?? 0) + 1 };
  const out: GameState = { ...next, player: { ...next.player, packsOpened: opened } };
  return { state: out, finds, gains: gainsSince(state, out) };
}

/** What one spare piece sells for (gold, config SPARE_SELL times its baseValue). 0 for an unknown piece. */
export function spareValue(id: string): number {
  const c = getClothing(id);
  return c ? Math.floor(c.baseValue * SPARE_SELL) : 0;
}

/** Sells spare copies of a piece for gold (reason 'spare_sale'). Null (nothing changes) if the player has fewer spares. */
export function sellSpare(state: GameState, id: string, qty: number, at: number): GameState | null {
  const c = getClothing(id);
  if (!c || c.free || !Number.isInteger(qty) || qty <= 0) return null;
  return applyChange(state, { reason: 'spare_sale', gold: spareValue(id) * qty, sellSpares: { [id]: qty }, note: id }, at);
}
