// ---------- Farm and cooking (section 10b, step 9b) ----------
/** Gold cost to upgrade the farm TO this level (rooms use ROOM_UPGRADE_COST). */
export const FARM_UPGRADE_COST = {
  2: 200,
  3: 600,
} as const;
/** The farm's ground and fence (styles.json, not in the catalog; the farm always uses them). */
export const FARM_FLOOR_STYLE = 'grass';
export const FARM_WALL_STYLE = 'hedge';
/**
 * LEGACY (steps 9b to 9e): the old fixed plots, top-left corners in px, level n had the first
 * LEGACY_FARM_PLOTS_PER_LEVEL[n - 1]. Only the save migration 15 -> 16 reads them (each plot became a soil cell).
 */
export const LEGACY_FARM_PLOTS: readonly { x: number; y: number }[] = [
  ...[64, 128, 192].flatMap((x) => [{ x, y: 64 }, { x, y: 128 }]),
  ...[256, 320, 384].flatMap((x) => [{ x, y: 64 }, { x, y: 128 }]),
  ...[64, 128, 192, 256, 320, 384, 448, 512].map((x) => ({ x, y: 192 })),
];
export const LEGACY_FARM_PLOTS_PER_LEVEL = [6, 12, 20] as const;
/** The soil a new farm starts with (step BG6): a rectangle of cells (col, row, width, height). The player adds or removes soil for free. */
export const FARM_START_SOIL = { c: 2, r: 2, w: 6, h: 2 } as const;
/** The floor style ids of the farm's ground (styles.json): soil takes seeds, grass is the rest. Both are free. */
export const SOIL_STYLE = 'soil';
/**
 * Cooking in the tavern (step K1): how long ONE batch takes on a stove, by the rank of the recipe, ms (real time, also
 * while the game is closed). A recipe in food.json may set its own cookMs (the turnip roast takes 20 s, so the first
 * dish of a new game is ready within 30 s); this is the default for one without. The time is per batch, not per dish.
 */
export const COOK_MS = { common: 60_000, rare: 3 * 60_000, ultra_rare: 5 * 60_000, legendary: 5 * 60_000 } as const;
/** The avatar counts as next to a stove (its footprint centre) within this many px (step K1). */
export const STOVE_REACH_PX = 64;
/** A stove holds one batch at a time: 1 to this many dishes of ONE recipe. More stoves cook more batches in parallel. */
export const STOVE_BATCH_MAX = 4;
/**
 * How long a planted seed takes to be fully grown, by the rank of the thing it grows (step BG6). Real time, also
 * while the game is closed. The first harvest of a starter seed (common) is within about 2 minutes.
 */
export const SEED_GROW_MS = { common: 2 * 60_000, rare: 20 * 60_000, ultra_rare: 3 * 3_600_000, legendary: 12 * 3_600_000 } as const;
/** A harvest gives this many blocks or crops (min to max, both included), by rank. */
export const SEED_YIELD = {
  common: { min: 2, max: 4 },
  rare: { min: 2, max: 3 },
  ultra_rare: { min: 1, max: 2 },
  legendary: { min: 1, max: 1 },
} as const;
/** Splicing (step BG7): the cell grows for the longer of the two grow times plus this, ms. */
export const SPLICE_BONUS_MS = 60_000;
/** A spliced harvest may also give one block or crop of one of the two seeds (chance 0 to 1). */
export const SPLICE_BONUS_CHANCE = 0.25;
/** Chance that a harvest also gives the seed back. */
export const SEED_BACK_CHANCE = 0.3;
/** A plant is in its first stage (sprout) until this share of its time has passed, then the small plant, then fully grown. */
export const PLANT_SPROUT_SHARE = 0.5;
/** The ripe marker above a grown plant bobs this many px every this many ms (client). */
export const RIPE_MARKER_BOB_PX = 2;
export const RIPE_MARKER_BOB_MS = 400;
/** Seeds are bought in packs of 1 or this many (catalog Seeds tab). */
export const SEED_PACK = 5;
/** The lunch box: at most this many food items go into a run (next to the potions). */
export const LUNCH_BOX_MAX = 3;
/** The mine (section 10c, step 9c) opens at this player level; until then its travel card is locked. */
export const MINE_UNLOCK_LEVEL = 3;
/** Chance that an opened dungeon chest also holds one glowcap spore. */
export const GLOWCAP_SPORE_CHANCE = 0.05;
/**
 * Plants (step SG4, owner 16 Nov): a seed goes on a soil cell (food crops) or on any BLOCK cell (every seed; the block stays,
 * the plant sits on its top face) in these room kinds. At most PLANTS_ROOM_CAP plants per room kind (so a hotel or tavern stays usable).
 */
export const PLANT_ROOMS = ['hotel', 'shop', 'farm'] as const;
export const PLANTS_ROOM_CAP = { farm: 80, hotel: 16, shop: 8 } as const;
/** Why a seed was refused, in words (reading pace; the client shows them). */
export const PLANT_REFUSALS = {
  no_soil: 'Tap soil or any block to plant a seed.',
  needs_soil: 'Food crops need soil or a dirt block.',
  planted: 'A plant grows on this block. Harvest it first.',
  too_many_plants: 'This room cannot hold more plants.',
} as const;
/**
 * The GENERAL SPLICE RULE (step SG1, shared/src/spliceRule.ts): a pure hash of the sorted pair key picks the result. FROZEN once the content ships
 * (SG3): the salt, shared/data/spliceRules.json and the order of the pools decide every general result.
 */
export const SPLICE_SALT = 'pixel-hotel.splice.v1';
/** The highest rank a general splice can make; legendary seeds only come from special recipes (splice.json). */
export const SPLICE_RANK_CAP = 'ultra_rare' as const;
/** Two seeds of the same rank make one rank higher once in this many pairs (a hash of the pair; at most SPLICE_RANK_CAP). */
export const SPLICE_UP_ONE_IN = 8;
/** Gems per cell-minute of a splice harvest stay under this many times the best plain harvest's (SG2 gate, balance.test.ts). */
export const SPLICE_GEM_CAP = 2;
