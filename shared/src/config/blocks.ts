import { TAP_MAX_MS } from './clientInput.ts';

// ---------- Blocks, punching and gems (step BG5) ----------
/** A block can be placed or punched this many cells from the avatar (centre to centre, in cells). */
export const BLOCK_REACH = 3;
/** One punch per tap, at most every this many ms. */
export const BLOCK_HIT_COOLDOWN_MS = 250;
/** A half-broken block heals (its hits reset) when it was not hit for this long. */
export const BLOCK_HEAL_MS = 6000;
/**
 * What a broken block drops, by the block's rank (Growtopia style: every part is its own roll, so a break gives the
 * block, the seed, both, gems, or nothing). block = chance the block itself comes back, seed = chance of its seed,
 * gem = chance of gems and gemMin..gemMax = how many (both included). BG9 tunes these.
 */
export const BLOCK_DROPS = {
  common: { block: 0.6, seed: 0.05, gem: 0.05, gemMin: 1, gemMax: 2 },
  rare: { block: 0.5, seed: 0.08, gem: 0.1, gemMin: 2, gemMax: 4 },
  ultra_rare: { block: 0.45, seed: 0.08, gem: 0.15, gemMin: 4, gemMax: 8 },
  legendary: { block: 0.4, seed: 0.06, gem: 0.5, gemMin: 7, gemMax: 12 },
} as const;
/** Gem pieces on the ground: a drop is split into the biggest pieces first. Each value has its own colour (palette name). */
export const GEM_TIERS = [
  { value: 10, colors: ['red', 'rose'] },
  { value: 5, colors: ['cyan', 'sky'] },
  { value: 1, colors: ['green', 'lime'] },
] as const;
/**
 * Where gems come from (step BG4): the chance of a drop and its size (min to max, both included) before the rank
 * bonus. Small on purpose; BG9 tunes them. The rank of the thing that dropped it multiplies the amount (GEM_RANK_MULT).
 */
export const GEMS = {
  block: { chance: 0.15, min: 1, max: 2 },
  /** Harvesting a grown plant (step BG6). */
  harvest: { chance: 0.25, min: 1, max: 2 },
  /** A harvested spliced plant (the result's rank). */
  splice: { chance: 0.3, min: 1, max: 2 },
  /** A dungeon chest (wooden = common, golden = rare). */
  chest: { chance: 0.8, min: 1, max: 2 },
  /** A kill (the enemy's rank: ENEMY_GEM_RANK). */
  kill: { chance: 0.35, min: 1, max: 1 },
  /** A woken mimic (it also opens its golden chest's loot). */
  mimic: { chance: 0.9, min: 1, max: 2 },
  /** The Bone King always drops. */
  boss: { chance: 1, min: 2, max: 3 },
  /** A broken mine rock (the rock's rank: ROCK_GEM_RANK). */
  rock: { chance: 0.6, min: 1, max: 1 },
  /** A felled tree (the rank the tree rolled for its extra drop). */
  chop: { chance: 0.45, min: 1, max: 1 },
  /** A fish or fished-up thing (its own rank). */
  fish: { chance: 0.6, min: 1, max: 2 },
  /** A finished first-run quest (a hint): always. */
  quest: { chance: 1, min: 2, max: 2 },
  /** A Book reward (the tier's rank: BOOK_GEM_RANK). */
  book: { chance: 1, min: 2, max: 3 },
  /**
   * The tip a happy tavern guest leaves with the coins (step S3). `chance` is the BASE chance for a common drink or dish; the rank of what they
   * ordered multiplies the chance (TAVERN_GEM_CHANCE_MULT), the amount stays min to max. Aged and vintage drinks (K2) will use the higher ranks.
   */
  tavern: { chance: 0.05, min: 1, max: 1 },
} as const;
/** The chance of the tavern gem tip is GEMS.tavern.chance times this, by the rank of the drink or dish ordered (never over 1). */
export const TAVERN_GEM_CHANCE_MULT = { common: 1, rare: 2.5, ultra_rare: 5, legendary: 10 } as const;
/** The rank an enemy counts as for its gems (a mimic and the boss have their own sources). */
export const ENEMY_GEM_RANK = { slime: 'common', bat: 'common', skeleton: 'rare', bone_king: 'ultra_rare' } as const;
/** The rank a mine rock counts as for its gems. */
export const ROCK_GEM_RANK = { copper: 'common', iron: 'rare', mithril: 'ultra_rare' } as const;
/** The rank of a Book tier (25 / 50 / 75 / 100 %) for its gems. */
export const BOOK_GEM_RANK = { 25: 'common', 50: 'rare', 75: 'ultra_rare', 100: 'legendary' } as const;
/** A gem pickup on the dungeon floor is collected when the avatar is this close (px), or walks onto it. */
export const GEM_PICKUP_REACH = 28;
/** The gem amount is multiplied by this per rank of the thing that dropped it. */
export const GEM_RANK_MULT = { common: 1, rare: 2, ultra_rare: 4, legendary: 8 } as const;
// ---------- Hold to repeat (step BG5b) ----------
/** A press on empty floor with a block selected becomes a "place" hold after this many ms of not moving (a short tap places one). */
export const HOLD_PLACE_START_MS = TAP_MAX_MS;
/** While a place hold runs, one block is placed at most every this many ms (a drag along cells makes a line). */
export const HOLD_PLACE_MS = 150;
