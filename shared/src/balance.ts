// Balance maths (step BG9): the EXPECTED values of the block world's gems, packs, seeds and splicing, worked out in closed
// form from the real rules and data (config GEMS, BLOCK_DROPS, SEED_*, PACKS, packs.json, splice.json). Pure; used by
// tools/simulate-economy.ts (the printed tables) and by balance.test.ts (which fails when a loop reopens).
// The ACTIVITY rates (how often a player does a thing per hour) are ASSUMPTIONS, written here in one place.

import {
  BLOCK_DROPS,
  CATALOG_PRICE_MULT,
  ENEMY_GEM_RANK,
  GEMS,
  GEM_RANK_MULT,
  HINTS,
  MINE_HINT,
  RANK_WEIGHTS,
  ROCK_GEM_RANK,
  SEED_BACK_CHANCE,
  SEED_YIELD,
  SPARE_SELL,
  SPLICE_BONUS_MS,
} from './config.ts';
import { BLOCK_TYPES, getBlockType, isBlockId } from './blockTypes.ts';
import { getClothing } from './clothing.ts';
import { getFurnitureType } from './furniture.ts';
import { CROP_TYPES, getMaterialType } from './materials.ts';
import { getPack, packOdds, packPool, type PackItem, type PackType } from './packs.ts';
import { RANKS } from './ranks.ts';
import { seedGrowMs, seedGrows } from './seeds.ts';
import { SPLICE_RECIPES } from './splice.ts';
import type { GemSource } from './gems.ts';
import type { Rank, SeedId } from './types.ts';

const mean = (min: number, max: number): number => (min + max) / 2;

// ---------- Gems per event ----------

/** Expected gems of one event of a source whose thing has this rank (the closed form of gemDrop). */
export function gemsPerEvent(source: GemSource, rank: Rank): number {
  const g = GEMS[source];
  return g.chance * mean(g.min, g.max) * GEM_RANK_MULT[rank];
}

/** Expected gems of one broken block of this rank (the closed form of blockGemDrop; the rank sets the table, no multiplier). */
export function gemsPerBreak(rank: Rank): number {
  const t = BLOCK_DROPS[rank];
  return t.gem * mean(t.gemMin, t.gemMax);
}

/**
 * What one block is worth to a player who keeps placing and punching it until it is gone: it comes back with chance
 * `block` per break, so it is broken 1 / (1 - block) times. Per block: breaks, gems, own-seed drops.
 */
export function blockLineage(rank: Rank): { breaks: number; gems: number; seeds: number } {
  const t = BLOCK_DROPS[rank];
  const breaks = 1 / (1 - t.block);
  return { breaks, gems: breaks * gemsPerBreak(rank), seeds: breaks * t.seed };
}

/** Mean number of blocks (or crops) one harvest of a seed of this rank gives. */
export function harvestYield(rank: Rank): number {
  return mean(SEED_YIELD[rank].min, SEED_YIELD[rank].max);
}

/**
 * The seed ratio of a block seed: seeds a player ends up with from ONE planted seed when every block is punched until
 * it is gone (the harvest's seed-back plus the seeds of the breaks). Under 1 the loop dies out; 1 or more is free seeds forever.
 */
export function seedRatio(blockId: string): number {
  const rank = getBlockType(blockId)!.rank;
  const l = blockLineage(rank);
  return harvestYield(rank) * l.seeds + SEED_BACK_CHANCE;
}

/** Gems from ONE planted block seed over all its generations: the harvest gems plus every block punched, divided by (1 - ratio). */
export function seedLineageGems(blockId: string): number {
  const rank = getBlockType(blockId)!.rank;
  const perCycle = harvestYield(rank) * blockLineage(rank).gems + gemsPerEvent('harvest', rank);
  const r = seedRatio(blockId);
  return r < 1 ? perCycle / (1 - r) : Infinity;
}

// ---------- Activities (ASSUMED rates) ----------

export type Stage = 'new' | 'level3' | 'level8';
export const STAGES: readonly Stage[] = ['new', 'level3', 'level8'];
export const STAGE_NAMES: Record<Stage, string> = { new: 'new player (level 1)', level3: 'level 3', level8: 'level 8' };

type Mix = readonly (readonly [Rank, number])[];
export interface GemLine {
  source: GemSource;
  /** Events per hour of FOCUSED play in this activity. */
  perHour: number;
  /** The rank of the thing that drops it (weights; blocks: the block's rank). */
  mix: Mix;
  note: string;
}
export interface Activity {
  id: string;
  label: string;
  lines: GemLine[];
}

const c: Mix = [['common', 1]];
const r: Mix = [['rare', 1]];
const u: Mix = [['ultra_rare', 1]];
/** The ranks a tree or a fish rolls (RANK_WEIGHTS). */
const rolled: Mix = RANKS.map((k) => [k, RANK_WEIGHTS[k]] as const);

/**
 * What a player does per hour when they do ONLY that, by stage (assumptions, not rules; the dungeon is DUNGEON_ROUND 1 for
 * the first two stages and round 2 at level 8). A "mixed" hour gives each open activity an equal share of the time.
 */
export function activities(stage: Stage): Activity[] {
  const blockMix: Mix = stage === 'new' ? [['common', 9], ['rare', 1]] : stage === 'level3' ? [['common', 13], ['rare', 6], ['ultra_rare', 1]] : [['common', 10], ['rare', 7], ['ultra_rare', 3]];
  const harvestMix: Mix = stage === 'new' ? c : stage === 'level3' ? [['common', 7], ['rare', 3]] : [['common', 80], ['rare', 17], ['ultra_rare', 3]];
  const out: Activity[] = [
    { id: 'blocks', label: 'Punching blocks (hand-fed: place, punch, 1 break per 6 s)', lines: [{ source: 'block', perHour: 600, mix: blockMix, note: 'blocks broken' }] },
    {
      id: 'farm',
      label: 'Farm (plant, wait, punch the ripe plant)',
      lines: [{ source: 'harvest', perHour: stage === 'new' ? 150 : stage === 'level3' ? 200 : 300, mix: harvestMix, note: 'plants harvested' }],
    },
    {
      id: 'crypt',
      label: stage === 'level8' ? 'Crypt (round 2 rules)' : 'Crypt (round 1: slimes only)',
      lines:
        stage === 'level8'
          ? [
              { source: 'chest', perHour: 24, mix: c, note: 'wooden chests' },
              { source: 'chest', perHour: 12, mix: r, note: 'golden chests' },
              { source: 'kill', perHour: 36, mix: [[ENEMY_GEM_RANK.slime, 1]], note: 'slime kills' },
              { source: 'kill', perHour: 12, mix: [[ENEMY_GEM_RANK.skeleton, 1]], note: 'skeleton kills' },
              { source: 'mimic', perHour: 3, mix: r, note: 'mimics' },
              { source: 'boss', perHour: 0.5, mix: u, note: 'the Bone King' },
            ]
          : [
              { source: 'chest', perHour: 24, mix: c, note: 'wooden chests' },
              { source: 'chest', perHour: stage === 'new' ? 4 : 8, mix: r, note: 'golden chests' },
              { source: 'kill', perHour: 40, mix: [[ENEMY_GEM_RANK.slime, 1]], note: 'slime kills' },
            ],
    },
  ];
  if (stage !== 'new') {
    out.push({
      id: 'mine',
      label: 'Mine (rocks, 4-minute visits)',
      lines:
        stage === 'level3'
          ? [
              { source: 'rock', perHour: 30, mix: [[ROCK_GEM_RANK.copper, 1]], note: 'copper rocks' },
              { source: 'rock', perHour: 8, mix: [[ROCK_GEM_RANK.iron, 1]], note: 'iron rocks' },
            ]
          : [
              { source: 'rock', perHour: 22, mix: [[ROCK_GEM_RANK.copper, 1]], note: 'copper rocks' },
              { source: 'rock', perHour: 14, mix: [[ROCK_GEM_RANK.iron, 1]], note: 'iron rocks' },
              { source: 'rock', perHour: 4, mix: [[ROCK_GEM_RANK.mithril, 1]], note: 'mithril rocks' },
            ],
    });
  }
  out.push({
    id: 'lake',
    label: 'Lakeside (chop and fish)',
    lines: [
      { source: 'chop', perHour: stage === 'new' ? 25 : 30, mix: rolled, note: 'trees felled' },
      { source: 'fish', perHour: stage === 'new' ? 30 : 40, mix: rolled, note: 'catches' },
    ],
  });
  return out;
}

/** Expected gems of ONE event of a line: the mix of ranks averaged. */
export function lineGemsPerEvent(line: GemLine): number {
  const total = line.mix.reduce((a, [, w]) => a + w, 0);
  return line.mix.reduce((a, [rank, w]) => a + (w / total) * (line.source === 'block' ? gemsPerBreak(rank) : gemsPerEvent(line.source, rank)), 0);
}

/** Gems per hour of one line at a share of the hour (1 = fully focused). */
export function lineGemsPerHour(line: GemLine, share = 1): number {
  return line.perHour * share * lineGemsPerEvent(line);
}

/** Gems per hour of a fully focused hour in an activity. */
export function focusedGems(a: Activity): number {
  return a.lines.reduce((s, l) => s + lineGemsPerHour(l), 0);
}

/** The mixed hour: every open activity gets an equal share of the time. Returns gems per hour by SOURCE (chest, kill, ...). */
export function mixedBySource(stage: Stage): Map<GemSource, number> {
  const acts = activities(stage);
  const out = new Map<GemSource, number>();
  for (const a of acts) for (const l of a.lines) out.set(l.source, (out.get(l.source) ?? 0) + lineGemsPerHour(l, 1 / acts.length));
  return out;
}

/** Gems per hour of the mixed hour. */
export function mixedGemsPerHour(stage: Stage): number {
  return [...mixedBySource(stage).values()].reduce((a, b) => a + b, 0);
}

/** The biggest share (0 to 1) one gem source has in the mixed hour, and which source it is. */
export function biggestShare(stage: Stage): { source: GemSource; share: number } {
  const by = mixedBySource(stage);
  const total = [...by.values()].reduce((a, b) => a + b, 0);
  let best: GemSource = 'block';
  for (const [s, g] of by) if (g > (by.get(best) ?? 0)) best = s;
  return { source: best, share: total > 0 ? (by.get(best) ?? 0) / total : 0 };
}

/** Gems the first-run quests pay a player who has not reached the mine yet (the quests before the mine hint). */
export function questGemsBeforeMine(): number {
  return MINE_HINT * GEMS.quest.chance * mean(GEMS.quest.min, GEMS.quest.max);
}

/** Gems of all first-run quests together. */
export function questGemsTotal(): number {
  return HINTS.length * GEMS.quest.chance * mean(GEMS.quest.min, GEMS.quest.max);
}

/** Hours of mixed play to collect `price` gems at a stage (the first-run quests count for the new stage). */
export function hoursToAfford(price: number, stage: Stage): number {
  const bonus = stage === 'new' ? questGemsBeforeMine() : 0;
  return Math.max(0, price - bonus) / mixedGemsPerHour(stage);
}

// ---------- The exploit ceiling of punching blocks ----------

/**
 * Gems per hour when ONE focused player punches blocks as fast as the hand can (hold to repeat: one break per BLOCK_HIT_COOLDOWN_MS
 * would be the absolute limit; a place + punch pair is about 2 s with moving, so 1800 breaks per hour is the ceiling used here), IF
 * the blocks never ran out. Blocks run out (they come back 40 to 60 % of the time), so the supply is what counts: see blockSupply.
 */
export const BLOCK_BREAKS_CEILING_PER_HOUR = 1800;

/** Gems per block you BUY (catalog dirt, planks, stone, glass), when it is placed and punched until it is gone. */
export function gemsPerBoughtBlock(blockId: string): number {
  return blockLineage(getBlockType(blockId)!.rank).gems;
}

// ---------- Packs ----------

/** What one roll of a pack gives, per item: the chance and the item. */
export function itemChances(pack: PackType): { item: PackItem; p: number }[] {
  const out: { item: PackItem; p: number }[] = [];
  for (const row of packOdds(pack)) for (const item of row.items) out.push({ item, p: row.percent / 100 / row.items.length });
  return out;
}

/** Gems a player gets back by PLAYING a pack's contents: blocks punched until gone, block seeds planted over all their generations, crop seeds planted until the seed-back stops. Clothes: 0. */
export function packGemReturn(pack: PackType): number {
  return pack.rolls * itemChances(pack).reduce((a, { item, p }) => {
    if (item.kind === 'clothing') return a;
    const id = item.id;
    if (isBlockId(id)) return a + p * blockLineage(getBlockType(id).rank).gems;
    const ownId = id.endsWith('_seed') ? id.slice(0, -'_seed'.length) : '';
    if (isBlockId(ownId)) return a + p * seedLineageGems(ownId);
    const rank = getMaterialType(id as never).rank;
    return a + p * (gemsPerEvent('harvest', rank) / (1 - SEED_BACK_CHANCE));
  }, 0);
}

/** The gold value of one pack item when sold (a block or seed in the shop at its baseValue; a clothes piece as a SPARE). */
export function itemSellValue(item: PackItem): number {
  if (item.kind === 'clothing') return Math.floor(getClothing(item.id)!.baseValue * SPARE_SELL);
  return getMaterialType(item.id as never).baseValue;
}

/** Expected sell value of a whole pack (gold), every piece sold at once (clothes as spares). */
export function packSellValue(pack: PackType): number {
  return pack.rolls * itemChances(pack).reduce((a, { item, p }) => a + p * itemSellValue(item), 0);
}

/** The dearest single piece a pack can give, sold (gold), and the pack's price per piece (gems). */
export function packPeakSale(pack: PackType): { peak: number; pricePerPiece: number } {
  return { peak: Math.max(0, ...itemChances(pack).map(({ item }) => itemSellValue(item))), pricePerPiece: pack.gemPrice / pack.rolls };
}

/** Expected number of pieces that are DUPLICATES (spares) after opening `n` packs from scratch: sum over items of E[max(0, X - 1)]. */
export function expectedSpares(pack: PackType, n: number): number {
  const rolls = pack.rolls * n;
  return itemChances(pack).reduce((a, { p }) => a + (rolls * p - (1 - (1 - p) ** rolls)), 0);
}

/** Expected number of DIFFERENT pieces after opening `n` packs. */
export function expectedDistinct(pack: PackType, n: number): number {
  const rolls = pack.rolls * n;
  return itemChances(pack).reduce((a, { p }) => a + (1 - (1 - p) ** rolls), 0);
}

/** Packs needed on average until every piece a pack can give has been found at least once (by a seeded Monte Carlo). */
export function packsToComplete(pack: PackType, rng: () => number, trials = 300): number {
  const chances = itemChances(pack);
  const cum: number[] = [];
  let acc = 0;
  for (const x of chances) cum.push((acc += x.p));
  let total = 0;
  for (let t = 0; t < trials; t++) {
    const seen = new Set<number>();
    let packs = 0;
    while (seen.size < chances.length && packs < 5000) {
      packs++;
      for (let i = 0; i < pack.rolls; i++) {
        const x = rng() * acc;
        const k = cum.findIndex((cv) => x < cv);
        seen.add(k < 0 ? chances.length - 1 : k);
      }
    }
    total += packs;
  }
  return total / trials;
}

export { getPack };

// ---------- Splicing ----------

/** The seeds a player can hold without splicing: the ones a pack can give (crop seeds and block seeds). */
export function starterSeeds(): Set<SeedId> {
  return new Set(packPool('seeds').map((i) => i.id as SeedId));
}

/** Gold a seed costs to get (crop seeds: the shop price; block and other seeds: their baseValue). */
function seedGold(seed: SeedId): number {
  const crop = CROP_TYPES.find((x) => x.seed === seed);
  return crop && crop.seedPrice !== null ? crop.seedPrice : getMaterialType(seed).baseValue;
}

export interface Chain {
  /** Wall-clock ms from starter seeds to this seed, planting the branches in parallel in their own cells. */
  ms: number;
  /** Gold the starter seeds cost along the cheapest way. */
  gold: number;
  /** Cell-minutes used (every plant in the tree occupies a cell for its time), by the way that uses the fewest. */
  cellMs: number;
}

/**
 * The cheapest way to each seed from the starter seeds, each measure on its own (fastest, cheapest, fewest cell-minutes).
 * One splice cell grows for the longer of the two seeds' grow times plus SPLICE_BONUS_MS (spliceGrowMs).
 */
export function chains(): Map<SeedId, Chain> {
  const start = starterSeeds();
  const best = new Map<SeedId, Chain>();
  const seedsOf = new Set<SeedId>(SPLICE_RECIPES.flatMap((x) => [x.a, x.b, x.result]));
  for (const s of seedsOf) best.set(s, start.has(s) ? { ms: 0, gold: seedGold(s), cellMs: 0 } : { ms: Infinity, gold: Infinity, cellMs: Infinity });
  for (let round = 0; round < 40; round++) {
    let changed = false;
    for (const x of SPLICE_RECIPES) {
      const a = best.get(x.a)!;
      const b = best.get(x.b)!;
      const grow = Math.max(seedGrowMs(x.a), seedGrowMs(x.b)) + SPLICE_BONUS_MS;
      const cur = best.get(x.result)!;
      const next: Chain = { ms: Math.max(a.ms, b.ms) + grow, gold: a.gold + b.gold, cellMs: a.cellMs + b.cellMs + grow };
      const merged: Chain = { ms: Math.min(cur.ms, next.ms), gold: Math.min(cur.gold, next.gold), cellMs: Math.min(cur.cellMs, next.cellMs) };
      if (merged.ms !== cur.ms || merged.gold !== cur.gold || merged.cellMs !== cur.cellMs) {
        best.set(x.result, merged);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return best;
}

/** The gold value of what a seed grows (the item at its baseValue, furniture and clothes at theirs). */
export function seedProductValue(seed: SeedId): number {
  const g = seedGrows(seed);
  if (g.kind === 'material') return getMaterialType(g.id).baseValue;
  if (g.kind === 'furniture') return getFurnitureType(g.id).baseValue;
  return getClothing(g.id)?.baseValue ?? 0;
}

/**
 * Gold a plain cell earns per minute with the best common crop (yield times its baseValue per grow time, minus the seed). A spliced
 * thing must not be worth more per cell-minute than just planting this: otherwise a chain makes value from nothing.
 */
export function bestCropGoldPerCellMinute(): number {
  let best = 0;
  for (const crop of CROP_TYPES) {
    if (crop.seedPrice === null) continue;
    const minutes = seedGrowMs(crop.seed as SeedId) / 60_000;
    const gold = harvestYield(crop.rank) * crop.baseValue - crop.seedPrice * (1 - SEED_BACK_CHANCE);
    best = Math.max(best, gold / minutes);
  }
  return best;
}

/** The cheapest way to turn gold into gems: gold per gem over the blocks the catalog sells (price = baseValue x CATALOG_PRICE_MULT). */
export function cheapestGoldPerGem(): number {
  let best = Infinity;
  for (const b of BLOCK_TYPES) if (b.inCatalog) best = Math.min(best, (b.baseValue * CATALOG_PRICE_MULT) / gemsPerBoughtBlock(b.id));
  return best;
}
