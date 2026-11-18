// Balance maths (step BG9): the EXPECTED values of the block world's gems, packs, seeds and splicing, worked out in closed
// form from the real rules and data (config GEMS, BLOCK_DROPS, SEED_*, PACKS, packs.json, splice.json). Pure; used by
// tools/simulate-economy.ts (the printed tables) and by balance.test.ts (which fails when a loop reopens).
// The ACTIVITY rates (how often a player does a thing per hour) are ASSUMPTIONS, written here in one place.

import {
  BALANCE_TARGETS,
  BLOCK_DROPS,
  FIRST_GUEST_DELAY_MS,
  GUEST_BASE_INTERVAL_MS,
  GUEST_EAT_MAX_MS,
  GUEST_EAT_MIN_MS,
  GUEST_GROUP_WEIGHTS,
  GUEST_ORDER_AFTER_MAX_MS,
  GUEST_ORDER_AFTER_MIN_MS,
  TAVERN_START_DRINK,
  STOVE_BATCH_MAX,
  PREP_BONUS,
  TAP_CAP,
  POUR_MS,
  CATALOG_PRICE_MULT,
  ENEMY_GEM_RANK,
  GEMS,
  GEM_RANK_MULT,
  HINTS,
  MINE_HINT,
  RANK_WEIGHTS,
  ROCK_GEM_RANK,
  PLANTS_ROOM_CAP,
  SEED_BACK_CHANCE,
  SEED_GROW_MS,
  SEED_YIELD,
  RIPEN_AFTER_MIN,
  CELLAR_RACK_MAX_BY_LEVEL,
  CASK_SLOTS,
  TASTE_RESERVE_CHANCE,
  TAP_SLOTS,
} from './config.ts';
import { BLOCK_TYPES, getBlockType, isBlockId } from './blockTypes.ts';
import { getClothing } from './clothing.ts';
import { getFurnitureType } from './furniture.ts';
import { CROP_TYPES, DRINK_TYPES, FOOD_TYPES, getMaterialType } from './materials.ts';
import { blockPrice } from './economy.ts';
import { getPack, packOdds, packPool, type PackItem, type PackType } from './packs.ts';
import { RANKS } from './ranks.ts';
import { getLootTable, rollLoot, type LootTableId } from './dungeon/loot.ts';
import { CATCH_TYPES } from './fish.ts';
import { fellLoot } from './woodcut.ts';
import { DUNGEON_KEY_COST } from './config.ts';
import { coinsFor } from './tavern.ts';
import { getDrinkType, getFoodType } from './materials.ts';
import { ROCK_ORE_MAX, ROCK_ORE_MIN, RARE_DROP_CHANCE } from './config.ts';
import { isMaterialId } from './materials.ts';
import type { MaterialId, Rng } from './types.ts';
import { seedGrowMs, seedGrows, seedRank } from './seeds.ts';
import { spliceGrowMs } from './splice.ts';
import { allRecipes } from './spliceRule.ts';
import { tavernTipGems, type GemSource } from './gems.ts';
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
  out.set('tavern', tavernTipGemsPerHour(stage)); // the small tip of a happy guest (step S3)
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
  if (item.kind === 'clothing') return 0; // spares cannot be sold since 18 Nov: they stay in the bag
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
 * One splice cell grows for the longest of the two seeds' and the result's grow time plus SPLICE_BONUS_MS (spliceGrowMs). Over allRecipes():
 * the special recipes and the general rule's result of every pair (step SG2).
 */
export function chains(): Map<SeedId, Chain> {
  const start = starterSeeds();
  const best = new Map<SeedId, Chain>();
  const recipes = allRecipes();
  const seedsOf = new Set<SeedId>(recipes.flatMap((x) => [x.a, x.b, x.result]));
  for (const s of seedsOf) best.set(s, start.has(s) ? { ms: 0, gold: seedGold(s), cellMs: 0 } : { ms: Infinity, gold: Infinity, cellMs: Infinity });
  for (let round = 0; round < 40; round++) {
    let changed = false;
    for (const x of recipes) {
      const a = best.get(x.a)!;
      const b = best.get(x.b)!;
      const grow = spliceGrowMs(x.a, x.b);
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

// ---------- The general splice rule's gate (step SG2, plan 2.7) ----------

/** Gems per cell-minute of the best plain harvest (any rank): the yardstick of the splice gem cap. */
export function bestHarvestGemsPerCellMinute(): number {
  return Math.max(...RANKS.map((rank) => gemsPerEvent('harvest', rank) / (SEED_GROW_MS[rank] / 60_000)));
}

/** For every spliced result: the gems of one splice harvest, per cell-minute of the whole chain, and their worth in gold at the cheapest gold-per-gem against the chain's cost. */
export function spliceGemRows(): { seed: SeedId; gems: number; perCellMin: number; gemGold: number; cost: number }[] {
  const ch = chains();
  const start = starterSeeds();
  const rate = bestCropGoldPerCellMinute();
  const perGem = cheapestGoldPerGem();
  const out: { seed: SeedId; gems: number; perCellMin: number; gemGold: number; cost: number }[] = [];
  for (const seed of new Set(allRecipes().map((x) => x.result))) {
    if (start.has(seed)) continue;
    const c = ch.get(seed)!;
    const gems = gemsPerEvent('splice', seedRank(seed));
    out.push({ seed, gems, perCellMin: gems / (c.cellMs / 60_000), gemGold: gems * perGem, cost: c.gold + (c.cellMs / 60_000) * rate });
  }
  return out;
}

/**
 * The bounded cycle check (plan 2.7 group 7): the cheapest way to get a seed BACK by a loop of at most `depth` splices, root + partner -> ... -> root.
 * Each step costs the partner's chain (gold plus cell-minutes at the best plain crop rate) and the splice cell's own cell-minutes. A loop gives back
 * nothing new (the root again), so its cost must stay above zero: no loop is free. Dynamic programming over the recipes, no walk of all paths.
 */
export function cheapestSpliceCycle(depth: number): { seed: SeedId; cost: number }[] {
  const ch = chains();
  const rate = bestCropGoldPerCellMinute();
  const recipes = allRecipes().filter((x) => x.result !== x.a && x.result !== x.b);
  const step = (partner: SeedId, a: SeedId, b: SeedId): number => ch.get(partner)!.gold + ((ch.get(partner)!.cellMs + spliceGrowMs(a, b)) / 60_000) * rate;
  const roots = new Set<SeedId>(recipes.flatMap((x) => [x.a, x.b]));
  const out: { seed: SeedId; cost: number }[] = [];
  for (const root of roots) {
    let best = new Map<SeedId, number>([[root, 0]]);
    let back = Infinity;
    for (let d = 0; d < depth; d++) {
      const next = new Map<SeedId, number>();
      for (const x of recipes) {
        for (const [at, partner] of [[x.a, x.b], [x.b, x.a]] as const) {
          const have = best.get(at);
          if (have === undefined) continue;
          const cost = have + step(partner, x.a, x.b);
          if (x.result === root) back = Math.min(back, cost);
          else if (cost < (next.get(x.result) ?? Infinity)) next.set(x.result, cost);
        }
      }
      best = next;
    }
    if (Number.isFinite(back)) out.push({ seed: root, cost: back });
  }
  return out;
}

// ---------- Run gold (the dungeon is the only gold source besides the tavern since the trader went, 18 Nov) ----------

/** Gold the loot table DROPS as gold (run gold), averaged over `n` seeded rolls. */
function lootDroppedGold(table: LootTableId, rng: Rng, n = 600): number {
  let total = 0;
  for (let i = 0; i < n; i++) for (const l of rollLoot(getLootTable(table), rng)) if (l.item === 'gold') total += l.qty;
  return total / n;
}

/** Run gold ONE event of a dungeon line drops (the gold that goes into the bag; the other loot is not gold: nothing is sold any more). */
function lineRunGoldPerEvent(line: GemLine, rng: Rng): number {
  switch (line.source) {
    case 'chest': return lootDroppedGold(line.mix[0]![0] === 'common' ? 'wooden_chest' : 'golden_chest', rng);
    case 'kill': return RARE_DROP_CHANCE * lootDroppedGold(line.note.startsWith('skeleton') ? 'skeleton' : 'slime', rng);
    case 'mimic': return lootDroppedGold('mimic', rng);
    case 'boss': return lootDroppedGold('bone_king', rng);
    default: return 0;
  }
}



// ====================================================================================================================
// ---------- Step S3: gold per hour by SOURCE, the first hour, and the tavern gem tip ----------
// ====================================================================================================================
// Gold sources of a mixed hour: tavern GUESTS, the DUNGEON (run gold in the bag, minus the keys, plus the loot sold at the trader), the MINE (ore sold), the FARM
// (crops sold, net of the seeds) and the LAKE (wood and fish sold). Everything the trader pays is counted as surplus, so those four are CEILINGS (crops, ore and
// wood also feed cooking, brewing and crafting); the guest gold is a CEILING too (every mug and dish is sold). The ASSUMPTIONS below are in one place.

/** The player is at the tavern (serving, brewing, cooking, tapping coins) this share of a mixed hour; the barrels brew and the guests wait meanwhile. The more there is to do (more activities open), the less time is spent at the bar. */
export const TAVERN_ATTENTION_BY_STAGE: Record<Stage, number> = { new: 0.4, level3: 0.35, level8: 0.3 };
/** Dungeon runs per hour of FOCUSED crypt play (a key costs DUNGEON_KEY_COST gold; round 1 runs are short, round 2 runs are longer). */
export function runsPerHour(stage: Stage): number {
  return stage === 'level8' ? 4 : 7;
}
/** The player visits the barrel and the stove every this many minutes (a brew or batch is collected and the next one started). */
export const VISIT_EVERY_MIN = 10;

export interface TavernSetup {
  seats: number;
  barrels: number;
  /** Dishes the stoves deliver per hour (crops permitting). */
  dishesPerHour: number;
  appeal: number;
}

/** What a typical player of a stage has built in the tavern (ASSUMPTION; the new game's setup is the real one: 3 seats, 1 barrel, 1 stove). */
export function tavernSetup(stage: Stage): TavernSetup {
  return stage === 'new' ? { seats: 3, barrels: 1, dishesPerHour: 6, appeal: 10 } : stage === 'level3' ? { seats: 4, barrels: 1, dishesPerHour: 8, appeal: 30 } : { seats: 6, barrels: 2, dishesPerHour: 9, appeal: 60 };
}

const AVG_GROUP = GUEST_GROUP_WEIGHTS.reduce((sum, w, i) => sum + w * (i + 1), 0) / GUEST_GROUP_WEIGHTS.reduce((a, b) => a + b, 0);
/** Guests who arrive per hour at an appeal (a group every GUEST_BASE_INTERVAL_MS * 100 / (100 + appeal)). */
export function guestsPerHour(appeal: number): number {
  return (3_600_000 / (GUEST_BASE_INTERVAL_MS * (100 / (100 + appeal)))) * AVG_GROUP;
}
/** The seconds a guest holds a seat (the pause before the order, the carry, the meal, the walk out; the pour at the taps adds POUR_MS). */
const SERVE_S = 15 + POUR_MS / 1000;
export const GUEST_STAY_S = (GUEST_ORDER_AFTER_MIN_MS + GUEST_ORDER_AFTER_MAX_MS) / 2000 + SERVE_S + (GUEST_EAT_MIN_MS + GUEST_EAT_MAX_MS) / 2000 + 5;
/** Guests the seats can hold per hour. */
export function seatCapPerHour(seats: number): number {
  return (seats * 3600) / GUEST_STAY_S;
}
/** Mugs one barrel gives per hour when it is visited every VISIT_EVERY_MIN minutes. */
export function mugsPerHour(drinkId: string, barrels = 1): number {
  const d = getDrinkType(drinkId as never);
  return barrels * d.mugs * (60 / Math.max(VISIT_EVERY_MIN, d.minutes));
}
/** The gold a guest leaves for one drink at the menu price (its base value) plus the tip. */
function drinkGold(id: string): number {
  return coinsFor(id as never, getDrinkType(id as never).baseValue);
}

/** Dishes one batch gives with a prep bonus (step T1): the batch the player chose (at most STOVE_BATCH_MAX) plus the bonus, which PREP_BONUS caps. */
export function dishesPerBatch(prepBonus: number, batch = STOVE_BATCH_MAX): number {
  return batch + Math.min(prepBonus, PREP_BONUS.max);
}

/** SG3b: the drinks and dishes a plain farm can make every day (no splice-only crop in them); the tavern hours use these, the splice-crop ones are an optional extra reached by splicing (their loops are tested over ALL recipes). */
const PLAIN_INPUTS = (inputs: Partial<Record<string, number>>): boolean => Object.keys(inputs).every((id) => !CROP_TYPES.some((c) => c.id === id && c.spliceOnly));
const PLAIN_DRINKS = DRINK_TYPES.filter((d) => PLAIN_INPUTS(d.inputs));
const PLAIN_DISHES = FOOD_TYPES.filter((f) => PLAIN_INPUTS(f.inputs));

/** Drinks poured per hour at full attention (step T1): the drinks among the things sold. A pour is one mug off a tap. */
export function poursPerHour(stage: Stage): number {
  const t = tavernSetup(stage);
  const drinks = stage === 'new' ? DRINK_TYPES.filter((d) => d.id === TAVERN_START_DRINK) : PLAIN_DRINKS;
  const mugs = (drinks.reduce((a, d) => a + mugsPerHour(d.id), 0) / drinks.length) * t.barrels;
  const sold = guestGoldPerHour(stage).sold;
  return sold * (mugs / (mugs + t.dishesPerHour));
}

/** How long a full tap lasts at that pour rate when the drink is the only one on it, minutes (a tap holds TAP_CAP mugs). */
export function tapLastsMin(stage: Stage, taps = 1): number {
  return (TAP_CAP * taps * 60) / poursPerHour(stage);
}

/** What the tavern earns per hour at FULL attention: the smaller of the guests who come, the seats and the supply, at the average drink and dish. */
export function guestGoldPerHour(stage: Stage, prepBonus = 0): { gold: number; sold: number; limit: 'guests' | 'seats' | 'supply' } {
  const base = tavernSetup(stage);
  // Prep tables (step T1) add dishes to every batch: the batches stay the same, so dishes per hour grow by (batch + bonus) / batch.
  const t = { ...base, dishesPerHour: base.dishesPerHour * dishesPerBatch(prepBonus) / STOVE_BATCH_MAX };
  // The new game brews root ale and roasts turnips; later players brew every drink and cook every dish.
  const drinks = stage === 'new' ? DRINK_TYPES.filter((d) => d.id === TAVERN_START_DRINK) : PLAIN_DRINKS;
  const dishes = stage === 'new' ? FOOD_TYPES.filter((f) => f.id === 'roasted_turnip') : PLAIN_DISHES;
  const mugs = (drinks.reduce((a, d) => a + mugsPerHour(d.id), 0) / drinks.length) * t.barrels;
  const mugPrice = drinks.reduce((a, d) => a + drinkGold(d.id), 0) / drinks.length;
  const dishPrice = dishes.reduce((a, f) => a + f.baseValue, 0) / dishes.length;
  const supply = mugs + t.dishesPerHour;
  const arrive = guestsPerHour(t.appeal);
  const cap = seatCapPerHour(t.seats);
  const sold = Math.min(arrive, cap, supply);
  const limit = sold === supply ? 'supply' : sold === cap ? 'seats' : 'guests';
  return { gold: sold * ((mugs * mugPrice + t.dishesPerHour * dishPrice) / supply), sold, limit };
}

// ---------- The first hour of a new game (target: BALANCE_TARGETS.firstHour) ----------

/** The first visit to the start barrel (walk in, read the hint, collect, brew again) happens this many minutes into the game. */
export const FIRST_VISIT_MIN = 2;
/** The early dish: a batch of this many roasted turnips is ready every FIRST_DISH_EVERY_MIN minutes from FIRST_DISH_FROM_MIN (the first turnips grow ~10 min). */
export const FIRST_DISH_BATCH = 2;
export const FIRST_DISH_EVERY_MIN = 20;
export const FIRST_DISH_FROM_MIN = 14;

/**
 * Expected tavern gold of a new game after `minutes`: the start barrel's root ale is collected at the first visit and a new brew goes in at once; every
 * VISIT_EVERY_MIN minutes after it the brew is collected and started again; every drink is sold when guests are there (they arrive faster than the supply).
 */
export function firstHourGold(minutes: number): { gold: number; mugs: number; dishes: number; guests: number } {
  const ale = getDrinkType(TAVERN_START_DRINK);
  const visits = minutes < FIRST_VISIT_MIN ? 0 : 1 + Math.floor((minutes - FIRST_VISIT_MIN) / VISIT_EVERY_MIN);
  const mugs = visits === 0 ? 0 : ale.mugs * visits; // the start barrel is one brew; each later visit collects the brew started at the one before
  const dishes = minutes < FIRST_DISH_FROM_MIN ? 0 : FIRST_DISH_BATCH * (1 + Math.floor((minutes - FIRST_DISH_FROM_MIN) / FIRST_DISH_EVERY_MIN));
  const guests = Math.max(0, minutes * 60_000 - FIRST_GUEST_DELAY_MS) / 60_000 * (guestsPerHour(tavernSetup('new').appeal) / 60);
  const sold = Math.min(guests, mugs + dishes);
  const share = mugs + dishes > 0 ? sold / (mugs + dishes) : 0;
  return { gold: share * (mugs * drinkGold(TAVERN_START_DRINK) + dishes * getFoodType('roasted_turnip').baseValue), mugs, dishes, guests };
}

// ---------- Gold per hour by source ----------

export type GoldSourceId = 'guests' | 'dungeon';
export interface GoldSource {
  id: GoldSourceId;
  label: string;
  /** Gold per hour of FOCUSED play there (guests: full attention). */
  focused: number;
  /** Gold per hour of a MIXED hour. */
  mixed: number;
}

/** Run gold per hour of a FOCUSED crypt hour: the gold the chests and kills drop, minus the keys (round 2 at level 8). The rest of the loot is not gold (nothing is sold since 18 Nov). */
export function runGoldPerHour(stage: Stage, rng: Rng): number {
  const a = activities(stage).find((x) => x.id === 'crypt')!;
  return a.lines.reduce((sum, l) => sum + l.perHour * lineRunGoldPerEvent(l, rng), 0) - runsPerHour(stage) * DUNGEON_KEY_COST;
}

/** Gold per hour by SOURCE for a stage (tavern guests and dungeon run gold; the trader is gone since 18 Nov): focused and mixed (equal time in every open activity; the tavern at TAVERN_ATTENTION). */
export function goldBySource(stage: Stage, rng: Rng, prepBonus = 0): GoldSource[] {
  const guests = guestGoldPerHour(stage, prepBonus).gold;
  const run = runGoldPerHour(stage, rng);
  return [
    { id: 'guests', label: 'Tavern guests', focused: guests, mixed: guests * TAVERN_ATTENTION_BY_STAGE[stage] },
    { id: 'dungeon', label: 'Dungeon run gold (minus keys)', focused: run, mixed: run / activities(stage).length },
  ];
}

/** The mixed hour's gold in all, and the biggest and smallest share of one source. */
export function goldShares(stage: Stage, rng: Rng, prepBonus = 0): { total: number; biggest: { id: GoldSourceId; share: number }; smallest: { id: GoldSourceId; share: number } } {
  const rows = goldBySource(stage, rng, prepBonus);
  const total = rows.reduce((a, r) => a + r.mixed, 0);
  const by = [...rows].sort((a, b) => b.mixed - a.mixed);
  return { total, biggest: { id: by[0]!.id, share: by[0]!.mixed / total }, smallest: { id: by[by.length - 1]!.id, share: by[by.length - 1]!.mixed / total } };
}

// ---------- The tavern gem tip ----------

/** Expected gems per hour from the tavern tip: the sold items of a stage, each at the chance of its rank (a happy guest only; HAPPY_SHARE of the guests). */
export const HAPPY_SHARE = 0.8;
export function tavernTipGemsPerHour(stage: Stage): number {
  const t = guestGoldPerHour(stage);
  const drinks = stage === 'new' ? DRINK_TYPES.filter((d) => d.id === TAVERN_START_DRINK) : PLAIN_DRINKS;
  const avg = drinks.reduce((a, d) => a + tavernTipGems(d.rank), 0) / drinks.length;
  return t.sold * HAPPY_SHARE * avg * TAVERN_ATTENTION_BY_STAGE[stage];
}

// ---------- CEL: the cellar's ripening tiers (docs/PLAN-CELLAR.md 4.3) ----------

/** CEL (PROPOSAL, owner: use it): a cask slot's gold per hour of a tier stays under the best fresh barrel's gold per hour times this. */
export const CEL_RACK_RATIO_MAX = 1.6;
/** CEL: the cap on the guest share of the best-kitchen mixed hour (BALANCE_TARGETS: 85% since the trader went). */
export const CEL_GUEST_SHARE_MAX = BALANCE_TARGETS.maxGoldShareBestKitchen;
/** CEL: the best kitchen = prep tables up to PREP_BONUS.max. */
const BEST_KITCHEN = PREP_BONUS.max;

function tierMinutesOf(drink: { id: string; rank: Rank }, tier: 'aged' | 'vintage' | 'reserve'): number {
  return RIPEN_AFTER_MIN[drink.rank][tier];
}

/** The gold ONE cask slot adds per hour over selling the same mugs fresh, when it is refilled the moment a tier is reached (a drink at a tier). */
export function rackGoldPerHour(drinkId: string, tier: 'aged' | 'vintage' | 'reserve'): number {
  const d = getDrinkType(drinkId as never);
  const t = getDrinkType(`${drinkId}_${tier}` as never);
  return ((drinkGold(t.id) - drinkGold(d.id)) * d.mugs * 60) / tierMinutesOf(d, tier);
}

/** The gold per hour of the best fresh path: one barrel brewing the best drink and selling every mug at once. */
export function bestFreshBarrelGoldPerHour(): number {
  return Math.max(...DRINK_TYPES.map((d) => mugsPerHour(d.id) * drinkGold(d.id)));
}

/** The gold a cask slot adds per DAY at a tier (refilled as soon as the tier is reached; the choice between tiers is real when reserve is not far above vintage). */
export function rackDayGold(drinkId: string, tier: 'aged' | 'vintage' | 'reserve'): number {
  return rackGoldPerHour(drinkId, tier) * 24;
}

/** Reserve drinks a full level 3 cellar (CELLAR_RACK_MAX_BY_LEVEL[2] racks x CASK_SLOTS casks) can supply per hour of the best drink (casks refilled at once). */
export function fullCellarReserveSupplyPerHour(): { drink: string; mugsPerHour: number; extraGoldPerHour: number } {
  const casks = CELLAR_RACK_MAX_BY_LEVEL[2] * CASK_SLOTS;
  const best = DRINK_TYPES.map((d) => ({ drink: d.id, mugsPerHour: (casks * d.mugs * 60) / tierMinutesOf(d, 'reserve'), extraGoldPerHour: casks * rackGoldPerHour(d.id, 'reserve') })).sort((a, b) => b.extraGoldPerHour - a.extraGoldPerHour)[0]!;
  return best;
}

/** What guests can take of it per hour: orders per hour at the stage times the share of orders that can be a reserve drink (the taste guests, and the rest picking it among the menu's drinks on a stand's two taps). */
export function reserveDemandPerHour(stage: Stage, prepBonus = BEST_KITCHEN): number {
  const orders = guestGoldPerHour(stage, prepBonus).sold;
  return orders * (TASTE_RESERVE_CHANCE + (1 - TASTE_RESERVE_CHANCE) / TAP_SLOTS);
}

/** The guest share of the mixed hour at a stage when a full level 3 cellar sells reserve drinks (flow = the smaller of supply and demand; the extra is the gold over the fresh mug; at the bar's attention). */
export function guestShareWithReserve(stage: Stage, rng: Rng, prepBonus = BEST_KITCHEN): { share: number; extraMixed: number; extraFocused: number } {
  const supply = fullCellarReserveSupplyPerHour();
  const per = supply.extraGoldPerHour / supply.mugsPerHour;
  const flow = Math.min(supply.mugsPerHour, reserveDemandPerHour(stage, prepBonus));
  const extraFocused = flow * per;
  const extraMixed = extraFocused * TAVERN_ATTENTION_BY_STAGE[stage];
  const rows = goldBySource(stage, rng, prepBonus);
  const total = rows.reduce((a, r) => a + r.mixed, 0);
  const guests = rows.find((r) => r.id === 'guests')!.mixed;
  return { share: (guests + extraMixed) / (total + extraMixed), extraMixed, extraFocused };
}
