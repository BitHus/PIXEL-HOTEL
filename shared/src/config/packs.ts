// ---------- Packs bought with gems (step BG8; BLOCKS-PLAN 3.8; fairness rules in CLAUDE.md section 13) ----------
/**
 * What each pack costs (gems) and how many things it gives (rolls). STARTER numbers: BG9 tunes them (the first Common
 * Clothes Pack should be about an hour of play). The contents and the rank odds are in shared/data/packs.json.
 */
export const PACKS = {
  random_blocks: { gemPrice: 40, rolls: 5 },
  basic_seeds: { gemPrice: 30, rolls: 5 },
  common_clothes: { gemPrice: 75, rolls: 3 },
  rare_clothes: { gemPrice: 225, rolls: 3 },
} as const;
/** Client only: the pack's pop animation (shake, then burst) lasts this long, ms. */
export const PACK_POP_MS = 700;
/** A spare piece of clothing sells for its baseValue times this (gold, until trading exists). */
export const SPARE_SELL = 0.06;
/**
 * The balance targets of the block world (step BG9; the owner confirmed them). shared/src/balance.test.ts fails when a number
 * drifts away from them. Hours are of MIXED play (equal time in every open activity).
 */
export const BALANCE_TARGETS = {
  /** The first (cheapest) pack is affordable within this many minutes of a new game (the first-run quest gems count). */
  firstPackMaxMin: 45,
  /** A Common Clothes Pack is about this many hours of mixed play for a level 3 player. */
  commonClothesHours: 1,
  /** A Rare Clothes Pack is about this many hours of mixed play for a level 3 player. */
  rareClothesHours: 3,
  /** No single gem source is more than this share of the gems of a mixed hour. */
  maxSourceShare: 0.4,
  /** A seed ratio (seeds from one planted block seed) stays under this: seeds never make themselves forever. */
  maxSeedRatio: 0.85,
  /** The cheapest way to turn gold into gems (buy a catalog block, place it and punch it until it is gone) costs at least this much gold per gem. */
  minGoldPerGem: 30,
  /** Playing a pack's contents (punching its blocks, planting its seeds) gives back at most this share of its gem price (planting takes cell time too). */
  maxPackGemReturn: 0.5,
  /** Gold (step S3): each gold source (tavern guests, dungeon run gold, the trader) is between these shares of the gold of a mixed hour. */
  minGoldShare: 0.1,
  maxGoldShare: 0.5,
  /** The same cap for a tavern with the best kitchen (two prep tables next to the stove, step T1): free dishes lift the guests' share a little (51% at the start); 55% is the limit. */
  maxGoldShareBestKitchen: 0.55,
  /** A new game earns about this much gold at the tavern in its first 30 minutes and in its first hour (a perfect-play expectation: the player visits the barrel every 10 minutes). */
  firstHalfHourGold: { min: 150, max: 280 },
  firstHourGold: { min: 300, max: 500 },
  /** Selling a thing at the trader pays at most this share of its base value (things worth 1 or 2 gold are exempt: the trader pays at least 1 gold). */
  maxSellShare: 0.9,
} as const;
/** The id a gem gain has in a gains list (gems are a currency, not an item). */
export const GEMS_GAIN_ID = 'gems';
/** The gain id of gold taken from a tavern table (step 9t); other gold is not a gain (the wallet shows it). */
export const GOLD_GAIN_ID = 'gold';
/** Popups above the avatar's head (step BG3 B): how long one stays, and how many show at once. */
export const POPUP_MS = 1200;
export const POPUP_MAX = 5;
/** The crack pictures of a block that is being punched: 0 = whole, then up to this many minus one. */
export const BLOCK_CRACK_STAGES = 4;
/** Blocks are bought one at a time or in a pack of this many (Catalog > Blocks). */
export const BLOCK_PACK = 10;
