// Home life (steps 9g-2 and 9g-3): usable furniture, the cat, the pastimes and the room stars.

/** Pieces worth no points for the stars beyond this count per type (a hall of ten lamps is not a home). */
export const STAR_MAX_PER_TYPE = 3;
/** Points a room needs for 1 to 5 stars (index 0 = 1 star). An empty room is 1 star. */
export const STAR_THRESHOLDS: readonly number[] = [0, 12, 26, 42, 60];
/** Points per rank of a placed piece, on top of baseValue / STAR_VALUE_DIV. */
export const STAR_RANK_POINTS = { common: 1, rare: 2, ultra_rare: 4, legendary: 6 } as const;
export const STAR_VALUE_DIV = 20;
/** Points for each different type, each different theme, a light, a rug, a wall item, a floor style, a wall style (each capped). */
export const STAR_VARIETY_POINTS = 1.5;
export const STAR_VARIETY_CAP = 12;
export const STAR_THEME_POINTS = 2;
export const STAR_THEME_CAP = 8;
export const STAR_LIGHT_POINTS = 2;
export const STAR_LIGHT_CAP = 6;
export const STAR_RUG_POINTS = 3;
export const STAR_WALL_POINTS = 2;
export const STAR_WALL_CAP = 6;
export const STAR_STYLE_POINTS = 3;
/** Hard cap of the whole score. */
export const STAR_SCORE_MAX = 100;

/** The cat (step 9g-2). Positions and times are in world px and ms; the cat is not saved (only adopted + name). */
export const PET_NAME_MAX = 16;
export const PET_DEFAULT_NAMES: readonly string[] = ['Mouser', 'Biscuit', 'Tankard', 'Sir Whiskers', 'Embers', 'Pippin'];
export const PET_SPEED = 40;
export const PET_FOLLOW_SPEED = 72;
export const PET_WANDER_RADIUS = 96;
export const PET_SIT_MS: readonly [number, number] = [3000, 8000];
export const PET_WALK_MS: readonly [number, number] = [2000, 5000];
export const PET_SLEEP_MS: readonly [number, number] = [15_000, 40_000];
export const PET_FOLLOW_MS: readonly [number, number] = [6000, 12_000];
/** The cat stops following this close to the player (px). */
export const PET_FOLLOW_GAP = 40;
/** After a tap the cat purrs (shows a heart) this long. */
export const PET_PURR_MS = 2500;
/** Chances (0 to 1) of what the cat does next after resting: sleep (only with a basket), follow, else wander. */
export const PET_NEXT = { sleep: 0.3, follow: 0.25 } as const;
