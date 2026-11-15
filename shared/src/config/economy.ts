import { BUILD_CELL } from './world.ts';

// ---------- Economy (section 9) ----------
export const START_PLAYER_LEVEL = 1;
export const START_XP = 0;
export const START_GOLD = 100;
export const START_MATERIALS = { wood: 4, cloth: 2 } as const;

/** Prices are whole gold from 1 to this. */
export const SHOP_PRICE_MAX = 99_999;

export const SHOP_APPEAL_MAX = 100;
/** Each furniture type counts at most this many times toward shop appeal. */
export const APPEAL_MAX_PER_TYPE = 3;
/** Appeal of a non-bare floor or wall style. Bare gives 0. */
export const STYLE_APPEAL = 4;

/** Customer spawn interval = CUSTOMER_BASE_INTERVAL_MS * 100 / (100 + shopAppeal). */
export const CUSTOMER_BASE_INTERVAL_MS = 60_000;
export const CUSTOMER_APPEAL_BASE = 100;
export const CUSTOMER_TOLERANCE_MIN = 0.8;
export const CUSTOMER_TOLERANCE_MAX = 1.4;
/** Bought at price <= this * baseValue * tolerance: big smile (too cheap). */
export const REACTION_BIG_SMILE_MAX = 0.7;
/** Refused at price <= this * baseValue * tolerance: shrug. Above: frown. */
export const REACTION_SHRUG_MAX = 1.15;
/** The catch-up after a break (step 9d: it only fills the queue) looks back at most this many hours. */
export const OFFLINE_MAX_HOURS = 8;
export const OFFLINE_MAX_MS = OFFLINE_MAX_HOURS * 60 * 60 * 1000;

// ---------- Shop customers (step 7) ----------
/** The live shop simulation runs in fixed steps of this many ms. */
export const SHOP_TICK_MS = 100;
/** A gap longer than this (closed game, tab in the background) is caught up with maths only. */
export const SHOP_CATCH_UP_GAP_MS = 10_000;
/** The shopkeeper's spot is this far behind the counter's back edge, px. */
export const CASHIER_BEHIND_PX = BUILD_CELL / 2;
/** Customers walk calmer than the player: this many px per second, each one up to
 *  CUSTOMER_SPEED_VARIATION faster or slower (fix after 7b). */
export const CUSTOMER_WALK_SPEED = 72;
export const CUSTOMER_SPEED_VARIATION = 0.1;
/** A customer stops just inside the door this long before walking on, ms. */
export const CUSTOMER_ENTER_PAUSE_MS = 900;
/** Customers appear this far below the floor and walk in through the door, px. */
export const CUSTOMER_OUTSIDE_PX = 24;
/** Customer ids count down from -1 (players have positive ids). */
export const CUSTOMER_FIRST_ID = -1;
/** A customer's reaction bubble shows this long, ms. */
export const REACTION_BUBBLE_MS = 1800;

// ---------- Shop life (step 9d) ----------
/** Customer kinds and how often each comes (weights). */
export const CUSTOMER_KIND_WEIGHTS = { hurried: 3, browser: 4, chatty: 3 } as const;
/** A hurried customer walks this much faster and looks at an item only this long, ms. */
export const HURRIED_SPEED_BONUS = 0.2;
/** Chance per moment that a customer says a line (shared/data/npcLines.json). Chatty customers
 *  multiply it by CHATTY_TALK, hurried ones by HURRIED_TALK (at most 1). */
export const TALK_CHANCE = {
  /** A guest's face and line when a menu price is cheap, fair, high or too high. */
  reaction: 0.45,
  /** A guest's thanks on the way out. */
  leave: 0.3,
  /** Guests at a table (step 9t). */
  table: 0.55,
} as const;
export const CHATTY_TALK = 2;
export const HURRIED_TALK = 0.5;
/** On the way in, a tavern with at least this much appeal gets "What a lovely tavern!" remarks. */
export const REMARK_APPEAL_MIN = 40;

/** Staff only: customers never enter the strip behind the counter, this deep and this much wider than the counter on each side, px. */
export const STAFF_ZONE_DEPTH_PX = BUILD_CELL;
export const STAFF_ZONE_SIDE_PX = 0;
/** Talk lines are at most this many characters (tested). */
export const NPC_LINE_MAX = 40;
/** Client only: the quest card pops in and out this long (like the panels), ms. */
export const QUEST_CARD_POP_MS = 120;
/** Client only: a reach, a nod and the shopkeeper's hand-over move last this long, ms. */
export const GESTURE_MS = 280;

// ---------- Ranks and the collection book (step 9e) ----------
/** The colour of each rank (palette indices: grey-brown, blue, purple, gold): slot borders and names. */
export const RANK_COLORS = { common: 5, rare: 16, ultra_rare: 27, legendary: 10 } as const;
/** The base odds when a loot table rolls a rank (a table's rankMultiplier shifts them). */
export const RANK_WEIGHTS = { common: 75, rare: 20, ultra_rare: 4.5, legendary: 0.5 } as const;
/** The sparkle on the drop text of an ultra_rare or legendary drop lasts this long, ms (client only). */
export const SPARKLE_MS = 900;
/** The Book's reward steps: this part of a tab found (percent). The gold is in shared/data/bookRewards.json. */
export const BOOK_REWARD_STEPS = [25, 50, 75, 100] as const;

// ---------- The trader (step S2, docs/INN-PLAN.md section 5) ----------
/** What the trader pays for a surplus thing: baseValue * SELL_RATE (at least 1 gold). Low on purpose: using a thing always beats selling it (balance.ts tests). */
export const SELL_RATE = 0.3;
/**
 * The trader's rate PER GROUP (step S3): baseValue * rate, at least 1 gold. Crops pay least (they are for brewing and cooking, and a seed costs gold),
 * ore and fish pay more (they cost time at the mine and the lake and are not cooked or brewed as much), loot and wood sit between. A thing made only
 * by SPLICING (its result seed, its furniture, its clothes) has its own low rate: its chain costs time and seeds, so selling it never beats keeping it.
 */
export const SELL_RATES = {
  block: SELL_RATE,
  material: 0.3,
  ore: 0.85,
  seed: 0.2,
  crop: 0.1,
  bar: 0.5,
  fish: 0.4,
  thing: 0.4,
  splice: 0.05,
} as const;
/** Selling MORE than this many pieces in one tap asks first (ui/confirmBuy.ts). Ultra rare and legendary things always ask. */
export const SELL_CONFIRM_QTY = 5;
/** The Bag counts as filling when this many different stacks are sellable; the first time, a hint says "Sell what you do not need at the bar". */
export const SELL_HINT_STACKS = 24;
