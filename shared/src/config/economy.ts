import { BUILD_CELL } from './world.ts';

// ---------- Economy (section 9) ----------
export const START_PLAYER_LEVEL = 1;
export const START_XP = 0;
export const START_GOLD = 100;
export const START_MATERIALS = { wood: 4, cloth: 2 } as const;

export const SLOTS_STALL_TABLE = 3;
export const SLOTS_SHELF = 3;
export const SLOTS_DISPLAY_CASE = 4;
export const SHELF_CATALOG_PRICE = 30;
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
/** The first customer of a new game arrives after this delay. */
export const FIRST_CUSTOMER_DELAY_MS = 10_000;
/** Chance that a customer wants a category that has stock in this shop. */
export const CUSTOMER_STOCKED_CATEGORY_CHANCE = 0.8;
export const CUSTOMER_TOLERANCE_MIN = 0.8;
export const CUSTOMER_TOLERANCE_MAX = 1.4;
/** Bought at price <= this * baseValue * tolerance: big smile (too cheap). */
export const REACTION_BIG_SMILE_MAX = 0.7;
/** Refused at price <= this * baseValue * tolerance: shrug. Above: frown. */
export const REACTION_SHRUG_MAX = 1.15;
/** The shop panel shows this many last sale prices per item type. */
export const SALE_HISTORY_LENGTH = 5;
/** The catch-up after a break (step 9d: it only fills the queue) looks back at most this many hours. */
export const OFFLINE_MAX_HOURS = 8;
export const OFFLINE_MAX_MS = OFFLINE_MAX_HOURS * 60 * 60 * 1000;

// ---------- Shop customers (step 7) ----------
/** The live shop simulation runs in fixed steps of this many ms. */
export const SHOP_TICK_MS = 100;
/** A gap longer than this (closed game, tab in the background) is caught up with maths only. */
export const SHOP_CATCH_UP_GAP_MS = 10_000;
/** A customer stands at the item this long while the reaction bubble shows. */
export const CUSTOMER_DECIDE_MS = 1200;
/** Paying takes this long once the player stands behind the counter (the till animation). */
export const CUSTOMER_PAY_MS = 900;
/** The shopkeeper's spot is this far behind the counter's back edge, px. */
export const CASHIER_BEHIND_PX = BUILD_CELL / 2;
/** At most this many customers wait with an item for the till (step 9d: was 5). While this many
 *  wait, no new customers come. They never leave on their own. */
export const QUEUE_MAX = 3;
/** At most this many customers are in the shop at the same time (fix after 7b). */
export const CUSTOMER_MAX_IN_SHOP = 5;
/** Customers walk calmer than the player: this many px per second, each one up to
 *  CUSTOMER_SPEED_VARIATION faster or slower (fix after 7b). */
export const CUSTOMER_WALK_SPEED = 72;
export const CUSTOMER_SPEED_VARIATION = 0.1;
/** A customer stops just inside the door this long before walking on, ms. */
export const CUSTOMER_ENTER_PAUSE_MS = 900;
/** A customer looks at an item (the "..." thought bubble) between these times, ms. */
export const CUSTOMER_BROWSE_MIN_MS = 2000;
export const CUSTOMER_BROWSE_MAX_MS = 5000;
/** After paying, a customer waits this long at the till before walking out, ms. */
export const CUSTOMER_AFTER_PAY_MS = 1000;
/** Queue spots behind the paying spot are this far apart, px: one cell each (BG1). */
export const QUEUE_SPACING_PX = BUILD_CELL;
/** Customers appear this far below the floor and walk in through the door, px. */
export const CUSTOMER_OUTSIDE_PX = 24;
/** Customer ids count down from -1 (players have positive ids). */
export const CUSTOMER_FIRST_ID = -1;
/** The floating "+12 gold" above the till rises and fades over this many ms. */
export const SALE_FLOAT_MS = 1400;
/** A customer's reaction bubble shows this long, ms. */
export const REACTION_BUBBLE_MS = 1800;

// ---------- Shop life (step 9d) ----------
/** Customer kinds and how often each comes (weights). */
export const CUSTOMER_KIND_WEIGHTS = { hurried: 3, browser: 4, chatty: 3 } as const;
/** A hurried customer walks this much faster and looks at an item only this long, ms. */
export const HURRIED_SPEED_BONUS = 0.2;
export const HURRIED_BROWSE_MIN_MS = 900;
export const HURRIED_BROWSE_MAX_MS = 1600;
/** How long a customer looks at a decoration, ms. */
export const DECOR_LOOK_MIN_MS = 1500;
export const DECOR_LOOK_MAX_MS = 3000;
/** Chance that a waiting customer (not the one paying) sits on a free seat near their queue spot. */
export const CUSTOMER_SIT_CHANCE = 0.6;
/** A seat counts as near the queue spot within this many px. */
export const CUSTOMER_SEAT_NEAR_PX = 72;
/** The customer at the till calls out the first time after this long without service, then again
 *  every CUSTOMER_CALL_EVERY_MS (with the 'queue' talk chance). */
export const CUSTOMER_CALL_AFTER_MS = 12_000;
export const CUSTOMER_CALL_EVERY_MS = 30_000;
/** Chance per moment that a customer says a line (shared/data/npcLines.json). Chatty customers
 *  multiply it by CHATTY_TALK, hurried ones by HURRIED_TALK (at most 1). */
export const TALK_CHANCE = {
  enter: 0.3,
  browse: 0.2,
  reaction: 0.45,
  queue: 0.6,
  pay: 0.35,
  leave: 0.3,
  remark: 0.6,
  /** Guests at a table (step 9t). */
  table: 0.55,
} as const;
export const CHATTY_TALK = 2;
export const HURRIED_TALK = 0.5;
/** On the way in, a tavern with at least this much appeal gets "What a lovely tavern!" remarks. */
export const REMARK_APPEAL_MIN = 40;
/** On the way in, a shop with at most this part of its slots filled gets "Not much left..." remarks. */
export const REMARK_EMPTY_SHARE = 0.25;

// ---------- Natural customers (owner, after 9d): small behaviours instead of one fixed route ----------
/** The small things a visitor can do, with how often each is picked (weights). */
export const ACT_WEIGHTS = { wander: 3, decor: 3, goods: 3, talk: 2, remark: 2, sit: 1 } as const;
/** A kind likes some things more: its weight is multiplied by this (0 = never). */
export const ACT_KIND_BONUS = {
  hurried: { goods: 2, sit: 0, decor: 0.5 },
  browser: { decor: 2, goods: 2 },
  chatty: { talk: 2.5, remark: 2 },
} as const;
/** How many small things a buyer does before the goods they came for, per kind (min, max). */
export const BUYER_ACTS = { hurried: [0, 1], browser: [2, 3], chatty: [1, 3] } as const;
/** How many small things a window-shopper does before leaving, per kind (min, max). */
export const WINDOW_ACTS = { hurried: [1, 2], browser: [3, 4], chatty: [2, 4] } as const;
/** Chance that a visitor is a window-shopper: looks around and leaves without wanting anything. */
export const WINDOW_SHOPPER_CHANCE = 0.25;
/** While QUEUE_MAX buyers are in the shop, a visitor that comes is a window-shopper with this chance (else nobody comes). */
export const WINDOW_SHOPPER_WHEN_FULL_CHANCE = 0.5;
/** Chance that a visitor brings a friend (they walk near each other and talk). */
export const PAIR_CHANCE = 0.2;
/** A friend stands this far from the one they follow, px. */
export const PAIR_NEAR_PX = 20;
/** A wanderer stands at their spot this long, ms. */
export const WANDER_STAND_MIN_MS = 800;
export const WANDER_STAND_MAX_MS = 2500;
/** A visitor sits on a free seat this long, ms. */
export const VISIT_SIT_MIN_MS = 3000;
export const VISIT_SIT_MAX_MS = 6000;
/** A random remark: the visitor stands this long while saying it, ms. */
export const REMARK_STAND_MS = 1800;
/** Two customers talking: this many bubbles back and forth, one every TALK_GAP_MS, standing TALK_NEAR_PX apart. */
export const TALK_LINES_MIN = 2;
export const TALK_LINES_MAX = 3;
export const TALK_GAP_MS = 2200;
export const TALK_NEAR_PX = 20;
/** Staff only: customers never enter the strip behind the counter, this deep and this much wider than the counter on each side, px. */
export const STAFF_ZONE_DEPTH_PX = BUILD_CELL;
export const STAFF_ZONE_SIDE_PX = 0;
/** Two queue spots are never closer than this, px. */
export const QUEUE_MIN_GAP_PX = 16;
/** Talk lines are at most this many characters (tested). */
export const NPC_LINE_MAX = 40;
/** Client only: the item hops from the slot to the hands (and to the counter and back) this long, ms. */
export const ITEM_HOP_MS = 300;
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
