// Every constant and number from the brief (CLAUDE.md). Code reads numbers from here only.
// The numbers live by topic in shared/src/config/*.ts and are re-exported here, so every import keeps working.
// The tavern numbers (step 9t) stay in this file.

export * from './config/world.ts';
export * from './config/economy.ts';
export * from './config/dungeon.ts';
export * from './config/farm.ts';
export * from './config/lakeside.ts';
export * from './config/mine.ts';
export * from './config/clientInput.ts';
export * from './config/player.ts';
export * from './config/atmosphere.ts';
export * from './config/blocks.ts';
export * from './config/packs.ts';
export * from './config/ripen.ts';


// ---------- The tavern (step 9t) ----------
/** What a new tavern starts with besides the bar (the old stall table is not in a new game any more, step S3: a bar stool takes its place
 *  in front of the bar, so a new tavern has 3 seats): `key` is the spot in the shop shape's shopStart (roomShapes.json); x and y here are the square shop's. */
export const TAVERN_START_ITEMS = [
  { key: 'stool_bar', typeId: 'bar_stool', x: 176, y: 128, facing: 'up' },
  { key: 'round_table', typeId: 'round_table', x: 448, y: 224, facing: 'down' },
  { key: 'stool_left', typeId: 'bar_stool', x: 400, y: 192, facing: 'right' },
  { key: 'stool_right', typeId: 'bar_stool', x: 496, y: 192, facing: 'left' },
  { key: 'brewing_barrel', typeId: 'brewing_barrel', x: 496, y: 64, facing: 'down' },
  { key: 'stove', typeId: 'stove', x: 240, y: 96, facing: 'down' },
] as const;
/**
 * What stands ON the bar in a new tavern (step T1): the register and a tap stand, side by side, as dx from the bar's anchor (px, bar facing down).
 * The bar is 3 cells wide; the third cell stays free for a second stand.
 */
export const TAVERN_START_RIDERS = [
  { typeId: 'register', dx: -32 },
  { typeId: 'tap_stand', dx: 0 },
] as const;
/** The drink that is ready in the start barrel (a new game starts with these mugs loaded on the first tap, step T1). */
export const TAVERN_START_DRINK = 'root_ale' as const;
/** The early dish a new tavern has on its menu (the stove cooks it in 20 s from one turnip, step S3). */
export const TAVERN_START_DISH = 'roasted_turnip' as const;
/** A group of guests comes every this many ms * 100 / (100 + appeal), like customers. */
export const GUEST_BASE_INTERVAL_MS = 45_000;
/** The first guests of a new game come after this delay. */
export const FIRST_GUEST_DELAY_MS = 8_000;
/** At most this many guests are in the tavern (and never more than it has seats at tables). */
export const GUEST_MAX = 8;
/** How often guests come alone, as a pair, or as a group of 3 (weights). */
export const GUEST_GROUP_WEIGHTS = [5, 4, 2] as const;
/** The members of a group walk in this far behind each other, px. */
export const GUEST_GROUP_GAP_PX = 16;
/**
 * A seat is a tavern seat when a table (a surface item, or the bar) is at most this far from the
 * seat's centre, px. On the 32 px cell grid (BG1) that is a stool on a cell right next to a table
 * cell (side by side, not diagonal): half a cell.
 */
export const GUEST_TABLE_NEAR_PX = 16;
/** The table spot of a seat lies this far inside the table's edge, px. */
export const TABLE_SPOT_INSET_PX = 8;
/** The avatar's errand (an order to a table, coins to take) counts as reachable when the walk ends this close to the spot, px. */
export const GUEST_SERVE_REACH_PX = 48;
/** A seat counts as reachable when the walk to it ends at most this far from it, px. */
export const GUEST_SEAT_REACH_PX = 48;
/** A seated guest orders after this long, ms. */
export const GUEST_ORDER_AFTER_MIN_MS = 3000;
export const GUEST_ORDER_AFTER_MAX_MS = 6000;
/** A tap on a brewing barrel acts at once when the avatar is this close (px) to its centre; else the avatar walks next to it first. */
export const BARREL_REACH_PX = 64;
/** A guest waits this long for the order (only while the player is in the tavern), then leaves unhappy. */
export const GUEST_PATIENCE_MS = 90_000;
/** With this much patience left the guest calls for the order once. */
export const GUEST_PATIENCE_WARN_MS = 35_000;
/** When the tavern's appeal is at least REMARK_APPEAL_MIN, small talk at the table is a remark about the room ("What a lovely tavern!") with this chance. */
export const GUEST_ROOM_REMARK_CHANCE = 0.3;
/** A guest eats or drinks for this long, ms. */
export const GUEST_EAT_MIN_MS = 20_000;
export const GUEST_EAT_MAX_MS = 40_000;
/** A sip or a bite every this many ms while eating. */
export const GUEST_SIP_MIN_MS = 3000;
export const GUEST_SIP_MAX_MS = 7000;
/** Guests who find no free seat stand around this long, then leave. */
export const GUEST_NO_SEAT_MS = 3500;
/** Guests at an empty menu sit and talk this long, then leave. */
export const GUEST_NO_MENU_MIN_MS = 8000;
export const GUEST_NO_MENU_MAX_MS = 15_000;
/** A guest who finds everything too expensive leaves after this long (the face shows meanwhile). */
export const GUEST_REFUSE_MS = 2500;
/** A seated guest may say something every this many ms. */
export const GUEST_TALK_MIN_MS = 6000;
export const GUEST_TALK_MAX_MS = 14_000;
/** The player's taps on guests queue up: at most this many orders wait to be carried. */
export const SERVE_QUEUE_MAX = 3;
/** While the player is elsewhere (or the game is closed) at most this many guests sit with an open order. */
export const AWAY_ORDERS_MAX = 3;
/** The menu panel shows this many last prices paid per drink or dish. */
export const MENU_HISTORY_LENGTH = 5;
/** The Menu panel's price stepper moves by this share of the item's baseValue (at least 1 gold). */
export const MENU_PRICE_STEP = 0.1;
/** The stepper stops at this multiple of the baseValue (guests never pay that much; the panel says so). */
export const MENU_PRICE_MAX_MULT = 3;
/** The Menu panel's face for a price: the guest with the middle tolerance of CUSTOMER_TOLERANCE_MIN..MAX. */
export const MENU_FACE_TOLERANCE = 1.1;


// ---------- The bar with taps and the kitchen (step T1) ----------
/** Taps on one tap stand. */
export const TAP_SLOTS = 2;
/** Most mugs one tap holds. */
export const TAP_CAP = 12;
/** Pouring a mug at the taps takes this long, ms (then the avatar carries it). */
export const POUR_MS = 800;
/** A prep table inside the kitchen zone, cell-adjacent to a stove, adds this many dishes to its batch; at most `max` in all. */
export const PREP_BONUS = { perTable: 1, max: 2 } as const;
