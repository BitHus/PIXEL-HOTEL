import { type EnemyKind } from './dungeon.ts';

// ---------- The mine (section 10c, step 9c) ----------
// The mine reuses the dungeon: the same 32 px blocks, the same step() in DUNGEON_TICK_MS ticks,
// a new small layout from a seed every visit.
/** The lantern burns this long (ms of run time); then the player walks out with everything. */
export const MINE_LANTERN_MS = 4 * 60 * 1000;
export const MINE_ROOMS_MIN = 2;
export const MINE_ROOMS_MAX = 3;
/** Weak enemies only: 0 to 1 per room (not the spawn room). */
export const MINE_ENEMIES: readonly EnemyKind[] = ['slime', 'bat'];
export const MINE_ENEMIES_PER_ROOM_MAX = 1;
/** Rocks per room (the spawn room too). */
export const MINE_ROCKS_PER_ROOM_MIN = 2;
export const MINE_ROCKS_PER_ROOM_MAX = 4;
export type RockKind = 'copper' | 'iron' | 'mithril';
/** Hits a rock needs (a steel pickaxe swing counts double). */
export const ROCK_HITS: Record<RockKind, number> = { copper: 3, iron: 5, mithril: 8 };
/** Rock kinds by weight; mithril only from mine visit MITHRIL_FROM_VISIT on. */
export const ROCK_WEIGHTS: Record<RockKind, number> = { copper: 55, iron: 35, mithril: 20 };
export const MITHRIL_FROM_VISIT = 5;
/** A broken rock drops this many ore (both ends included)... */
export const ROCK_ORE_MIN = 1;
export const ROCK_ORE_MAX = 2;
/** ...and with this chance a gem. */
export const GEM_CHANCE = 0.05;
/** The pickaxe: one swing per tap, at most every this many ms. */
export const PICKAXE_COOLDOWN_MS = 400;
/** The player can swing at a rock whose middle is this close (px). */
export const MINE_REACH = 40;
/** At 0 hp the player is carried out and loses this part of the visit's ore (rounded down, per ore). */
export const MINE_DEATH_ORE_LOSS = 0.5;

// ---------- XP and levels ----------
// The level thresholds (levels 1 to 8) live in shared/data/levels.json (levels.ts).
export const HP_PER_LEVEL = 3;
/** Every even level adds this to both ends of the attack range. */
export const ATTACK_PER_EVEN_LEVEL = 1;

// ---------- The dig mine (MG-3, docs/PLAN-MINIGAMES.md section 1; owner 17 Nov: no lantern timer) ----------
// A cave of blocks you pickaxe your way through to the exit. Block kinds are data (shared/data/mineBlocks.json).
/** The cave's size in blocks (DUNGEON_BLOCK px each). */
export const DIG_COLS = 48;
export const DIG_ROWS = 64;
/** The top rows are a dirt / clay band. */
export const DIG_DIRT_BAND = 3;
/** Open pockets (the spawn pocket and the exit pocket included). */
export const DIG_POCKETS_MIN = 4;
export const DIG_POCKETS_MAX = 7;
/** The exit lies at least this many blocks (steps through open or breakable blocks) from the spawn. */
export const DIG_EXIT_MIN_DIST = 40;
/** The cheapest way to the exit costs at most this many hits (pickaxe hits of one: a steel pickaxe halves it). */
export const DIG_ROUTE_HITS_MAX = 160;
/** Nothing (enemy, hazard, rare block) lies within this many blocks of the spawn. */
export const DIG_SPAWN_CLEAR = 5;
/** Rare blocks (crystal, gold vein, diamond): 0 to this many per floor, from depth 2, at least DIG_RARE_ROUTE_GAP blocks off the main route. */
export const DIG_RARE_MAX = 2;
export const DIG_RARE_ROUTE_GAP = 6;
/** The deepest floor (owner 17 Nov: depth cap 10). */
export const DIG_DEPTH_MAX = 10;
/** Enemies (slime, bat) per pocket, not in the spawn pocket; their hp grows per depth like a crypt floor. */
export const DIG_ENEMIES_PER_POCKET_MAX = 2;
/** Cave-in tiles per pocket (floor tiles that crumble: a crack for DIG_CAVEIN_TELL_MS, then DIG_CAVEIN_DAMAGE if you still stand there). */
export const DIG_CAVEINS_PER_POCKET_MAX = 2;
export const DIG_CAVEIN_TELL_MS = 700;
export const DIG_CAVEIN_DAMAGE = 4;
/** Filler blocks (stone, dirt, clay) drop their block item only with this chance, and never when the bag is full (they must not push ore out). */
export const DIG_FILLER_DROP_CHANCE = 0.15;
/** The player digs a block whose middle is this close (px; one block + a bit, so a block next to the standing block counts). */
export const DIG_REACH_PX = 52;
/** How far the lantern shows the cave around the player (blocks) before light skills, and how far a rare block glints before ore-sense skills. */
export const DIG_LIGHT_BLOCKS = 7;
export const DIG_GLINT_BLOCKS = 3;
