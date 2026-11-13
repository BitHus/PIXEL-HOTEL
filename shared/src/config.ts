// Every constant and number from the brief (CLAUDE.md). Code reads numbers from here only.

// ---------- World and screen (brief section 4) ----------
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 4;

// ---------- Rooms (section 5) ----------
/** Height of the back wall band along the top of a room, in px. */
export const WALL_BAND = 64;
/** Thin border on the sides and the bottom of a room, in px. */
export const SIDE_BORDER = 16;
/** Width of the door opening in the bottom wall, in px. */
export const DOOR_WIDTH = 64;
/** The door zone: a rectangle on the floor just inside the door. */
export const DOOR_ZONE_W = 64;
export const DOOR_ZONE_H = 48;

export type RoomLevel = 1 | 2 | 3;
export const ROOM_MAX_LEVEL: RoomLevel = 3;

/**
 * Room shapes and their floor rectangles per level live in shared/data/roomShapes.json (step 7b).
 * Shape rectangles, doors and walls are aligned to this grid, px.
 */
export const ROOM_GRID = 16;

/** Gold cost to upgrade a room TO this level (same for hotel and shop). */
export const ROOM_UPGRADE_COST = {
  2: 300,
  3: 800,
} as const;

/** Starting style for every room. */
export const START_FLOOR_STYLE = 'bare';
export const START_WALL_STYLE = 'bare';

/**
 * Fixed starting furniture in a new shop (step 7). Anchor positions (bottom center of the
 * footprint): the counter near the back wall (with room behind it for the shopkeeper), left of
 * center; the stall_table in the middle.
 */
export const SHOP_START_ITEMS = [
  { typeId: 'counter', x: 176, y: 88, facing: 'down' },
  { typeId: 'stall_table', x: 288, y: 184, facing: 'down' },
] as const;

// ---------- Movement (section 6) ----------
/** Internal navigation grid cell size, in px. Never shown. */
export const NAV_CELL = 16;
/** Footprints are made bigger by this radius when building the nav grid. */
export const AVATAR_RADIUS = 12;
/** Walking speed in the hotel and the shop, px per second. */
export const HOTEL_WALK_SPEED = 128;

// ---------- Furniture (section 7) ----------
/** Placement snap, in px. Holding Shift turns it off. */
export const SNAP = 4;
/** Default point where a customer stands, relative to an item's anchor. */
export const DEFAULT_STAND_POINT = { dx: 0, dy: 24 } as const;
/** Catalog price = baseValue * CATALOG_PRICE_MULT. Also used for styles. */
export const CATALOG_PRICE_MULT = 3;

// ---------- Avatars (section 8) ----------
export const AVATAR_W = 32;
export const AVATAR_H = 64;
/** While walking without walk frames, the idle sprite bobs this many px. */
export const WALK_BOB_PX = 2;
export const WALK_FRAMES = 4;
/** The walk bob switches between up and down every this many ms. */
export const WALK_BOB_MS = 150;
/** Where a new avatar stands: this far above the bottom of the floor, centered (in the door zone). */
export const AVATAR_START_FROM_BOTTOM = 24;

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
/** Offline customer simulation is capped at this many hours. */
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
export const CASHIER_BEHIND_PX = 20;
/** No new customers come while this many are carrying something to the till. */
export const QUEUE_MAX = 5;
/** At most this many customers are in the shop at the same time (fix after 7b). */
export const CUSTOMER_MAX_IN_SHOP = 3;
/** Customers walk calmer than the player: this many px per second, each one up to
 *  CUSTOMER_SPEED_VARIATION faster or slower (fix after 7b). */
export const CUSTOMER_WALK_SPEED = 72;
export const CUSTOMER_SPEED_VARIATION = 0.1;
/** A customer stops just inside the door this long before walking on, ms. */
export const CUSTOMER_ENTER_PAUSE_MS = 900;
/** A customer looks at an item (the "..." thought bubble) between these times, ms. */
export const CUSTOMER_BROWSE_MIN_MS = 2000;
export const CUSTOMER_BROWSE_MAX_MS = 5000;
/** Chance that a customer also looks at a second table, shelf or case before deciding. */
export const CUSTOMER_SECOND_LOOK_CHANCE = 0.35;
/** After paying, a customer waits this long at the till before walking out, ms. */
export const CUSTOMER_AFTER_PAY_MS = 1000;
/** Queue spots behind the paying spot are this far apart, px. */
export const QUEUE_SPACING_PX = 24;
/** Customers appear this far below the floor and walk in through the door, px. */
export const CUSTOMER_OUTSIDE_PX = 24;
/** Customer ids count down from -1 (players have positive ids). */
export const CUSTOMER_FIRST_ID = -1;
/** Customer looks are picked from these palette indices. */
export const CUSTOMER_LOOKS = {
  skin: [30, 31, 3, 4, 5],
  hair: [5, 6, 0, 1, 10, 2, 24],
  shirt: [13, 7, 16, 27, 0, 14, 9, 22],
  legs: [23, 5, 24, 15, 6],
  shoes: [6, 5, 25],
} as const;
/** The floating "+12 gold" above the till rises and fades over this many ms. */
export const SALE_FLOAT_MS = 1400;
/** A customer's reaction bubble shows this long, ms. */
export const REACTION_BUBBLE_MS = 1800;

// ---------- Dungeon (section 10) ----------
/** 1 = small first round, 2 = the full dungeon. */
export const DUNGEON_ROUND: 1 | 2 = 1;

export interface DungeonRoundRules {
  /** How many floors a run has. */
  maxFloors: number;
  roomsMin: number;
  roomsMax: number;
  /** The normal enemy kinds that spawn in rooms. */
  enemies: readonly EnemyKind[];
  mimics: boolean;
  boss: boolean;
}

export const DUNGEON_ROUNDS: Record<1 | 2, DungeonRoundRules> = {
  1: { maxFloors: 1, roomsMin: 3, roomsMax: 4, enemies: ['slime'], mimics: false, boss: false },
  2: { maxFloors: 3, roomsMin: 5, roomsMax: 8, enemies: ['slime', 'skeleton', 'bat'], mimics: true, boss: true },
};

export const DUNGEON_TICK_MS = 100;
export const DUNGEON_BLOCK = 32;
export const DUNGEON_BLOCKS_W = 40;
export const DUNGEON_BLOCKS_H = 40;
export const DUNGEON_ROOM_BLOCKS_MIN = 4;
export const DUNGEON_ROOM_BLOCKS_MAX = 8;
export const DUNGEON_CORRIDOR_WIDTH = 1;
/** The floor that has the boss (round 2). */
export const BOSS_FLOOR = 3;

export const PLAYER_BASE_HP = 30;
export const PLAYER_BASE_ATTACK_MIN = 4;
export const PLAYER_BASE_ATTACK_MAX = 6;
export const PLAYER_BASE_DEFENSE = 0;
export const PLAYER_DUNGEON_SPEED = 80;
export const PLAYER_ATTACK_COOLDOWN_MS = 350;

export type EnemyKind = 'slime' | 'skeleton' | 'bat' | 'bone_king';

export interface EnemyStats {
  hp: number;
  hitMin: number;
  hitMax: number;
  attackEveryMs: number;
  speed: number;
  /** Fraction of moves made in a random direction. */
  randomMoveChance: number;
  xp: number;
}

export const ENEMIES: Record<EnemyKind, EnemyStats> = {
  slime: { hp: 8, hitMin: 2, hitMax: 3, attackEveryMs: 1600, speed: 40, randomMoveChance: 0, xp: 3 },
  skeleton: { hp: 12, hitMin: 3, hitMax: 5, attackEveryMs: 1200, speed: 64, randomMoveChance: 0, xp: 5 },
  bat: { hp: 6, hitMin: 2, hitMax: 4, attackEveryMs: 900, speed: 92, randomMoveChance: 0.5, xp: 4 },
  bone_king: { hp: 60, hitMin: 5, hitMax: 8, attackEveryMs: 1500, speed: 54, randomMoveChance: 0, xp: 40 },
};
/** A mimic opens like a chest, then waits this long before its first wind-up (step 9: fair). */
export const MIMIC_WAKE_MS = 700;
// ---------- The dungeon in the client (step 9) ----------
/**
 * The dungeon camera's zoom: at least DUNGEON_DEVICE_PX_PER_ART_PX device px per art px (closer
 * would hide enemies on a monitor), and on dense phone screens about DUNGEON_CSS_PX_PER_ART_PX
 * CSS px per art px, so enemies stay big enough to tap.
 */
export const DUNGEON_DEVICE_PX_PER_ART_PX = 2;
export const DUNGEON_CSS_PX_PER_ART_PX = 1.25;
/** Blocks whose middle is this close to the player are lit (px); seen blocks stay dim. */
export const DUNGEON_LIGHT_PX = 224;
/** How dark a seen but unlit block is (0 = lit, 1 = black). */
export const DUNGEON_SEEN_DARK = 0.6;
/** Screen shake (screen px) when the player lands a hit, and when the player is hit. */
export const HIT_SHAKE_PX = 2;
export const HURT_SHAKE_PX = 5;
export const SCREEN_SHAKE_MS = 160;
/** A hit enemy flashes white this long; the player flashes red when hit. */
export const HIT_FLASH_MS = 120;
/** A chest's lid opens in this many ms. */
export const CHEST_OPEN_MS = 300;
/** Floating text (damage, drops, xp) rises and fades in this many ms; drops of one chest come this far apart. */
export const FLOAT_TEXT_MS = 1100;
export const FLOAT_STAGGER_MS = 180;
/** The level-up flash over the whole screen, ms. */
export const LEVEL_FLASH_MS = 600;
/** LocalGameAPI saves a going run at least this often (run time, ms), and whenever something happens. */
export const RUN_SAVE_EVERY_MS = 2000;
/** A mimic fights as a skeleton but gives this xp. */
export const MIMIC_XP = 8;

export const ENEMY_CHASE_RANGE = 192;
export const ATTACK_REACH = 40;
export const ENEMY_WINDUP_MS = 300;
/** An attack misses if the player is farther than this at the end of the wind-up. */
export const ENEMY_MISS_RANGE = 48;
export const ENEMIES_PER_ROOM_MIN = 0;
export const ENEMIES_PER_ROOM_MAX = 2;
/** Enemy hp on floor n = ceil(hp * (1 + ENEMY_HP_PER_FLOOR * (n - 1))). */
export const ENEMY_HP_PER_FLOOR = 0.25;
/**
 * Whether the Bone King's hp is also multiplied by the floor. Owner's decision after step 8: no,
 * the Bone King always has 60 hp (the simulation's survival targets need it).
 */
export const BOSS_HP_FLOOR_SCALING = false;

export const RUN_BAG_SLOTS = 12;
export const MATERIAL_STACK_MAX = 10;
/** Fraction of run gold lost on death. */
export const DEATH_GOLD_LOSS = 0.5;
export const DUNGEON_KEY_COST = 10;
/** Fraction of max hp healed when going down the stairs. */
export const STAIRS_HEAL = 0.3;

// Gear and potions (prices, effects, the carry limit) live in shared/data/gear.json (gear.ts).

/** The player can hit an enemy whose center is this close (px). */
export const PLAYER_ATTACK_REACH = 40;
/** A chest opens (or a mimic wakes) when the player's feet come this close to it (px). */
export const CHEST_OPEN_REACH = 20;
/** Enemies stop walking when this close to the player (px); they never stand on the player. */
export const ENEMY_STOP_PX = 24;
/** A chasing enemy without line of sight finds a new path this often (ms). */
export const ENEMY_REPATH_MS = 500;

export const WOODEN_CHESTS_MIN = 3;
export const WOODEN_CHESTS_MAX = 5;
export const GOLDEN_CHEST_CHANCE = 0.4;
export const WOODEN_CHEST_ROLLS = 2;
export const GOLDEN_CHEST_ROLLS = 3;
/** 1 in MIMIC_ONE_IN wooden chests is a mimic. */
export const MIMIC_ONE_IN = 8;
export const BOSS_THRONE_PIECE_MIN = 1;
export const BOSS_THRONE_PIECE_MAX = 2;
/** Chance per kill of one rare drop. */
export const RARE_DROP_CHANCE = 0.1;
/** Of a rare drop: chance it is a crystal (else a random crypt furniture item). */
export const RARE_DROP_CRYSTAL_CHANCE = 0.7;

// ---------- Farm and cooking (section 10b, step 9b) ----------
/** Gold cost to upgrade the farm TO this level (rooms use ROOM_UPGRADE_COST). */
export const FARM_UPGRADE_COST = {
  2: 200,
  3: 600,
} as const;
/** The farm's ground and fence (styles.json, not in the catalog; the farm always uses them). */
export const FARM_FLOOR_STYLE = 'grass';
export const FARM_WALL_STYLE = 'hedge';
/** A soil plot is a square of this size, px. */
export const FARM_PLOT_SIZE = 32;
/**
 * Every plot's top-left corner, in order; level n has the first FARM_PLOTS_PER_LEVEL[n - 1]. All of
 * them lie inside the level 1 farm, in neat rows, so an upgrade only adds plots. 48 px apart.
 */
export const FARM_PLOTS: readonly { x: number; y: number }[] = [
  // Level 1: two rows of three.
  ...[48, 96, 144].flatMap((x) => [{ x, y: 48 }, { x, y: 96 }]),
  // Level 2: the rows get three more plots.
  ...[192, 240, 288].flatMap((x) => [{ x, y: 48 }, { x, y: 96 }]),
  // Level 3: a third row of eight.
  ...[48, 96, 144, 192, 240, 288, 336, 384].map((x) => ({ x, y: 144 })),
];
export const FARM_PLOTS_PER_LEVEL = [6, 12, 20] as const;
/** The cooking pot: a fixed spot in the farm (anchor = bottom middle of its footprint), w x d px. */
export const COOKING_POT = { x: 464, y: 120, w: 32, d: 24 } as const;
/** One harvest gives this many crops (random, both ends included). */
export const HARVEST_MIN = 1;
export const HARVEST_MAX = 2;
/** The ripe marker above a plot bobs this many px every this many ms (client). */
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

// ---------- XP and levels ----------
// The level thresholds (levels 1 to 8) live in shared/data/levels.json (levels.ts).
export const HP_PER_LEVEL = 3;
/** Every even level adds this to both ends of the attack range. */
export const ATTACK_PER_EVEN_LEVEL = 1;

// ---------- Network (section 11) ----------
export const CHAT_MAX_LENGTH = 120;
export const RATE_LIMIT_PER_SECOND = 10;

// ---------- Client camera input (step 2) ----------
/** Wheel: target zoom is multiplied by exp(-deltaY * WHEEL_ZOOM_SPEED). One notch is ~100 px. */
export const WHEEL_ZOOM_SPEED = 0.0015;
/** Wheel zoom glides to its target; time constant in ms (smaller = snappier). */
export const ZOOM_EASE_MS = 60;
/** When a zoom gesture ends, the zoom eases to the nearest integer (or overview) zoom in this many ms. */
export const ZOOM_SETTLE_MS = 150;
/** The wheel has no end event: a wheel gesture ends after this many ms without a wheel event. */
export const WHEEL_GESTURE_END_MS = 200;
/** Floor textures are seamless squares of this size, in px. */
export const FLOOR_TEXTURE_SIZE = 64;
/** A press is a tap (click/walk) only if it moved less than this many screen px... */
export const TAP_MAX_MOVE_PX = 8;
/** ...and was held less than this many ms. Otherwise it is a drag (pan). */
export const TAP_MAX_MS = 300;
/** A press held this long without moving is a long press (opens the item menu, step 4b). */
export const LONG_PRESS_MS = 500;

// ---------- Debug tools (step 3) ----------
/** Blockers mode: drawn rectangles smaller than this (px, either side) are dropped. */
export const DEBUG_BLOCKER_MIN_PX = 4;
/** Opacity of the blocked nav cell overlay. */
export const DEBUG_NAV_OVERLAY_ALPHA = 0.18;

// ---------- Furniture in the client (step 4) ----------
/** Opacity of the build mode ghost. */
export const GHOST_ALPHA = 0.75;

// ---------- Sitting and lying (step 5b) ----------
/** A seat's approach point counts as reached if the walk ends this close (px) to it. */
export const APPROACH_REACH_PX = 28;
/** Two approach routes within this many px of each other count as equal: the one nearer the tap wins. */
export const APPROACH_TIE_PX = 8;
/** On arrival the avatar slides onto the seat in this many ms (no pathfinding). */
export const SEAT_SLIDE_MS = 150;
/** Lying: from the middle of the body to the middle of the head, floor px. */
export const LIE_HEAD_PX = 23;

// ---------- Placing and the item menu (step 4b) ----------
/** Gap between the item (or ghost) and the floating menu or button bar above it, screen px. */
export const MENU_GAP_PX = 8;
/** Screen edge margin the floating menus keep, px. */
export const MENU_EDGE_PX = 8;
/** A refused rotate shakes the item for this many ms... */
export const SHAKE_MS = 300;
/** ...this many world px to each side. */
export const SHAKE_PX = 2;

// ---------- Camera intro (step 5, section 4) ----------
/** When a room opens: wait this long at the overview zoom... */
export const INTRO_WAIT_MS = 600;
/** ...then zoom in over this long, centered on the avatar... */
export const INTRO_ZOOM_MS = 800;
/** ...to the settled zoom nearest to this many real screen px per art px. */
export const INTRO_DEVICE_PX_PER_ART_PX = 3;

// ---------- Player, inventory and saving (step 5) ----------
/** The local player's id and name (one player per browser until accounts exist). */
export const LOCAL_PLAYER_ID = 1;
export const LOCAL_PLAYER_NAME = 'You';
/** Room ids of a new local player's two rooms. */
export const START_HOTEL_ROOM_ID = 1;
export const START_SHOP_ROOM_ID = 2;
export const START_FARM_ROOM_ID = 3;
/** The starting avatar look (palette indices; styles are clothing.json ids). */
export const START_LOOK = { skin: 30, hair: 5, hairStyle: 'short', top: 'long_sleeve', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 } as const;
/** Colour choices per look slot (palette indices), for character creation and the Avatar panel. */
export const LOOK_COLORS = {
  skin: [30, 31, 3, 4, 5],
  hair: [5, 6, 0, 1, 10, 2, 24, 20],
  top: [7, 13, 16, 27, 0, 14, 9, 22, 2],
  bottoms: [23, 5, 24, 15, 6, 14, 27, 7],
  shoes: [6, 5, 25, 4, 23],
} as const;
/** Display names: at most this many letters, digits and spaces. */
export const DISPLAY_NAME_MAX = 16;
/** Slots in the hotbar at the bottom of the screen. */
export const HOTBAR_SLOTS = 6;
/** Slots in each bag tab (Furniture, Materials). Empty slots stay visible. If a new item type
 *  finds no free slot, the tab grows by one slot so nothing is ever lost. */
export const BAG_SLOTS = 36;
/** Bag grid columns: on a wide screen, and on a phone (bottom sheet). */
export const BAG_COLUMNS = 9;
export const BAG_COLUMNS_PHONE = 6;
/** Version of the save format. Bump it (and add a migration in save.ts) when GameState changes. */
export const SAVE_VERSION = 7;
/** localStorage key of the save: SAVE_KEY_PREFIX + version. */
export const SAVE_KEY_PREFIX = 'pixel-hotel.save.v';
/** One automatic backup: the save as it was when the game was opened (or before an import). */
export const SAVE_BACKUP_KEY = 'pixel-hotel.save.backup';

// ---------- Chat (step 5) ----------
/** A chat bubble stays at least this long (ms; longer texts: readingMs), fading out during the
 *  last CHAT_BUBBLE_FADE_MS. */
export const CHAT_BUBBLE_MS = 6000;
export const CHAT_BUBBLE_FADE_MS = 900;
/** Gap between stacked bubbles and above the head, screen px. */
export const CHAT_BUBBLE_GAP_PX = 4;
/** The chat log keeps this many lines. */
export const CHAT_LOG_MAX = 100;
/** Reading pace (fix after 7b): every text on screen (toasts, chat bubbles) stays at least
 *  TEXT_MIN_MS plus TEXT_MS_PER_WORD per word (readingMs), then fades out over TEXT_FADE_MS. */
export const TEXT_MIN_MS = 4000;
export const TEXT_MS_PER_WORD = 350;
export const TEXT_FADE_MS = 900;

// ---------- Catalog, rooms and hints (step 7) ----------
/** The first catalog purchase pops into placing: the ghost grows in over this many ms. */
export const FIRST_BUY_POP_MS = 220;
/** First-run hints, shown one at a time (GameState.hintsDone counts the finished ones). */
export const HINTS = [
  'Open the Catalog and buy something with your 100 gold.',
  'Place it in your room.',
  'Put an item on the table in your shop and set a price.',
  'Your shop has nothing left to sell. Tap the Dungeon button to find loot.',
  'Open the Map and go to your farm. Buy turnip seeds in the Catalog (Seeds) and plant your first turnip.',
] as const;
/** The index of the dungeon hint in HINTS: it only shows while the shop has nothing for sale. */
export const DUNGEON_HINT = 3;
/** The index of the farm hint (step 9b): done by planting anything. */
export const FARM_HINT = 4;

// ---------- New game intro (step 7b) ----------
/** The counter and stall_table pop in: scale 0 -> 1.2 -> 0.9 -> 1 over this many ms. */
export const POP_MS = 500;
/** The intro waits this long at the overview before the first pop, ms. */
export const INTRO_FIRST_POP_MS = 700;
/** Time between the intro's steps (pops, the walk in, the coins), ms. */
export const INTRO_STEP_MS = 650;
/** The start gold flies in as this many coins, one every INTRO_COIN_EVERY_MS, each flight INTRO_COIN_FLY_MS. */
export const INTRO_COINS = 10;
export const INTRO_COIN_EVERY_MS = 140;
export const INTRO_COIN_FLY_MS = 600;
