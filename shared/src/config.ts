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

/** Floor size in px per room kind and level. */
export const ROOM_SIZES = {
  hotel: {
    1: { w: 576, h: 384 },
    2: { w: 704, h: 480 },
    3: { w: 832, h: 576 },
  },
  shop: {
    1: { w: 576, h: 320 },
    2: { w: 704, h: 384 },
    3: { w: 832, h: 448 },
  },
} as const;

/** Gold cost to upgrade a room TO this level (same for hotel and shop). */
export const ROOM_UPGRADE_COST = {
  2: 300,
  3: 800,
} as const;

/** Starting style for every room. */
export const START_FLOOR_STYLE = 'bare';
export const START_WALL_STYLE = 'bare';

/** Fixed starting furniture in a new shop. Anchor positions (bottom center of footprint). */
export const SHOP_START_ITEMS = [
  { typeId: 'counter', x: 288, y: 96, facing: 'down' },
  { typeId: 'stall_table', x: 288, y: 208, facing: 'down' },
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

// ---------- Economy (section 9) ----------
export const START_PLAYER_LEVEL = 1;
export const START_XP = 0;
export const START_GOLD = 100;
export const START_MATERIALS = { wood: 4, cloth: 2 } as const;

export const SLOTS_STALL_TABLE = 3;
export const SLOTS_SHELF = 3;
export const SLOTS_DISPLAY_CASE = 4;
export const SHELF_CATALOG_PRICE = 30;

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

// ---------- Dungeon (section 10) ----------
/** 1 = small first round, 2 = the full dungeon. */
export const DUNGEON_ROUND: 1 | 2 = 1;

export const DUNGEON_ROUNDS = {
  1: { MAX_FLOORS: 1, ROOMS_MIN: 3, ROOMS_MAX: 4, enemies: ['slime'], mimics: false, boss: false },
  2: {
    MAX_FLOORS: 3,
    ROOMS_MIN: 5,
    ROOMS_MAX: 8,
    enemies: ['slime', 'skeleton', 'bat'],
    mimics: true,
    boss: true,
  },
} as const;

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

export const RUN_BAG_SLOTS = 12;
export const MATERIAL_STACK_MAX = 10;
/** Fraction of run gold lost on death. */
export const DEATH_GOLD_LOSS = 0.5;
export const DUNGEON_KEY_COST = 10;
/** Fraction of max hp healed when going down the stairs. */
export const STAIRS_HEAL = 0.3;

export const GEAR = {
  iron_sword: { price: 150, attackMin: 6, attackMax: 8 },
  leather_armor: { price: 120, damageReduction: 1, minDamage: 1 },
} as const;

export const POTION_PRICE = 20;
export const POTION_HEAL = 15;
export const POTION_COOLDOWN_MS = 1000;
export const POTION_CARRY_MAX = 3;

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

// ---------- XP and levels ----------
export const PLAYER_MAX_LEVEL = 8;
/** Total xp needed for levels 2..8 (also in shared/data/levels.json later). */
export const LEVEL_XP = [15, 40, 80, 140, 220, 320, 450] as const;
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
/** Floor textures are seamless squares of this size, in px. */
export const FLOOR_TEXTURE_SIZE = 64;
/** A press is a tap (click/walk) only if it moved less than this many screen px... */
export const TAP_MAX_MOVE_PX = 8;
/** ...and was held less than this many ms. Otherwise it is a drag (pan). */
export const TAP_MAX_MS = 300;
