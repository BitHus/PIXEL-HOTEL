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
