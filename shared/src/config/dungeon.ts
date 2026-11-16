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
/** The dungeon keeps its own nav cells (2 per block side), whatever the rooms use. */
export const DUNGEON_NAV_CELL = 16;
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

/** Chests are spread: at least this many blocks from every other chest, and from the spawn room (diagonals count as 1). */
export const CHEST_SPACING = 3;
export const CHEST_SPAWN_ROOM_GAP = 3;
export const WOODEN_CHESTS_MIN = 3;
export const WOODEN_CHESTS_MAX = 5;
export const GOLDEN_CHEST_CHANCE = 0.4;
export const WOODEN_CHEST_ROLLS = 2;
export const GOLDEN_CHEST_ROLLS = 3;
/** 1 in MIMIC_ONE_IN wooden chests is a mimic. */
export const MIMIC_ONE_IN = 8;
export const BOSS_THRONE_PIECE_MIN = 1;
export const BOSS_THRONE_PIECE_MAX = 2;
/** Chance per kill of one drop from the enemy's own table (step 9e: the table decides the rank). */
export const RARE_DROP_CHANCE = 0.1;
// ---------- Effects (outdoors rework C11/C12): look and feel only, never rules ----------
/** All pooled particles together (dungeon and lakeside): a spawn over this cap is dropped. */
export const FX_MAX_PARTICLES = 160;
/** Hit-stop: the view freezes this long on a hit and on being hit (render only, the run keeps real time), ms. */
export const FX_HIT_STOP_MS = 50;
/** The screen shake is kicked again at most every FX_SHAKE_STEP_MS (the noise changes this often), ms. */
export const FX_SHAKE_STEP_MS = 40;
/** An enemy hit is pushed back this many px (decays), and squashes for FX_SQUASH_MS. */
export const FX_KNOCKBACK_PX = 3;
export const FX_KNOCKBACK_MS = 140;
export const FX_SQUASH_MS = 160;
/** Spark particles per hit, and bits per kill burst. */
export const FX_SPARK_COUNT = 5;
export const FX_BURST_COUNT = 9;
/** A killed enemy fades out over this long instead of vanishing, ms. */
export const FX_DEATH_FADE_MS = 200;
/** A damage number pops in (scale) over this long, ms; a "big hit" is damage at the top of the attack range. */
export const FX_DAMAGE_POP_MS = 140;
/** The wind-up telegraph ring grows to this radius (px) over the enemy's wind-up. */
export const FX_TELEGRAPH_RADIUS = 40;
/** The aggro "!" shows this long over an enemy that starts chasing, ms. */
export const FX_AGGRO_MS = 600;
/** The red edge pulse when the player is hit, ms; the heartbeat vignette shows under this fraction of max hp. */
export const FX_HURT_EDGE_MS = 320;
export const FX_LOW_HP_FRACTION = 0.3;
/** Footstep dust: one puff per this many px walked. */
export const FX_DUST_EVERY_PX = 24;
/** Loot popped out of a chest: how high it jumps (px), and how long the arc lasts, ms. */
export const FX_LOOT_POP_PX = 18;
export const FX_LOOT_POP_MS = 420;

// ---------- Crypt light layer (outdoors rework C14; look only) ----------
/** Light pools are drawn as LIGHT_RINGS stacked discs (additive), radii in whole steps of LIGHT_STEP_PX. */
export const LIGHT_RINGS = 5;
export const LIGHT_STEP_PX = 4;
/** The lantern pool around the player: radius (px), alpha of each ring. */
export const LIGHT_PLAYER_PX = 196;
export const LIGHT_PLAYER_ALPHA = 0.055;
/** Flicker: the radius shifts by up to LIGHT_FLICKER_PX (whole steps), re-rolled every LIGHT_FLICKER_MS. */
export const LIGHT_FLICKER_PX = 8;
export const LIGHT_FLICKER_MS = 120;
/** Pools of torches (and mine lanterns), the exit, a chest, a golden chest and the Bone King crown: radius px, ring alpha. */
export const LIGHT_TORCH_PX = 76;
export const LIGHT_TORCH_ALPHA = 0.05;
export const LIGHT_EXIT_PX = 68;
export const LIGHT_EXIT_ALPHA = 0.05;
export const LIGHT_CHEST_PX = 40;
export const LIGHT_GOLD_CHEST_PX = 60;
export const LIGHT_CHEST_ALPHA = 0.045;
export const LIGHT_CROWN_PX = 84;
export const LIGHT_CROWN_ALPHA = 0.05;
/** Screen vignette: darkest edge alpha, number of steps, and where it starts (fraction of the half-diagonal). */
export const LIGHT_VIGNETTE_ALPHA = 0.55;
export const LIGHT_VIGNETTE_STEPS = 5;
export const LIGHT_VIGNETTE_START = 0.55;
/** Below this frame rate (averaged over LIGHT_PERF_FRAMES frames) the light layer switches off for the old fog. */
export const LIGHT_MIN_FPS = 50;
export const LIGHT_PERF_FRAMES = 90;

// ---------- Dungeon layout (DG1, brief section 10 LAYOUT) ----------
/** Zones per side of the layout grid (3 x 3). */
export const DUNGEON_ZONES = 3;
/** A corridor between two rooms is at most this many blocks long. */
export const DUNGEON_CORRIDOR_MAX = 5;
/** The gap between two linked rooms (the corridor's length) is drawn from this range. */
export const DUNGEON_LINK_GAP_MIN = 1;
export const DUNGEON_LINK_GAP_MAX = 3;
/** Chance that a link is a 2 block wide hall. */
export const DUNGEON_WIDE_LINK_CHANCE = 0.2;
/** Extra links (loops) when a floor has 4 or more rooms: [min, max] per round. */
export const DUNGEON_LOOPS: Record<1 | 2, readonly [number, number]> = { 1: [1, 1], 2: [1, 2] };
/** Side nooks (1x2 or 2x2 pockets) and dead-end secrets per floor. */
export const DUNGEON_NOOKS_MAX = 3;
export const DUNGEON_SECRETS_MAX = 2;
/** A template is used at most this often per floor. */
export const DUNGEON_TEMPLATE_MAX_PER_FLOOR = 2;
/** Pacing: a beat (enemy, chest, prop, landmark) lies within PACE_GAP_BLOCKS of every point of the main route. */
export const PACE_GAP_BLOCKS = 7;
/** The fill pass adds a prop wherever a route point has no beat within this many blocks (stricter than the gap). */
export const PACE_NEAR_BLOCKS = 4;
/** No more than this many route blocks without an enemy nearby (enemies are moved, never added). */
export const PACE_ENEMY_GAP_BLOCKS = 16;
/** The main route (spawn to exit) is this many blocks long, at most and at least. */
export const ROUTE_LEN_MIN = 25;
export const ROUTE_LEN_MAX = 70;
/** How often the layout is drawn again when a floor breaks a rule (loop, route length). */
export const DUNGEON_LAYOUT_ATTEMPTS = 80;

