/**
 * Ripening (step K2): mugs in a cask on a keg rack become AGED and then VINTAGE. A tier item (`<drink>_aged`) is worth valueMult times the plain drink and its
 * coin tip share grows by tipMult; after RIPEN_AFTER_MIN[rank of the plain drink] minutes in the cask a mug is aged, after the second number vintage.
 * A vintage drink is one rank higher than the plain one (at most legendary). Starting values, tuned in `npm run simulate`.
 */
export const RIPEN = [
  { tier: 'aged', valueMult: 1.6, tipMult: 1.2 },
  { tier: 'vintage', valueMult: 3, tipMult: 1 },
] as const;
export const RIPEN_AFTER_MIN = {
  common: { aged: 30, vintage: 180 },
  rare: { aged: 120, vintage: 480 },
  ultra_rare: { aged: 240, vintage: 960 },
  legendary: { aged: 480, vintage: 1920 },
} as const;
/** A keg rack holds this many casks. */
export const CASK_SLOTS = 3;
/** The share of guests with a taste for aged and vintage drinks: they order one when a tap has it. */
export const TASTE_AGED_CHANCE = 0.25;
