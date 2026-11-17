// ---------- Atmosphere (lighting, shadows, dust, sound); drawing and sound only, no rules ----------
/**
 * The ambient shade per room kind: this palette color lies over the room with `strength` as its
 * alpha (0 = off). Kept low: the room is bright and warm everywhere, lights only add a soft halo
 * (the owner approved this indoor look after 9d: keep it). Outdoors (OUTDOOR_KINDS: the farm,
 * later the lakeside) it is day: no shade and no light pools from furniture.
 */
export const AMBIENT_LIGHT = {
  hotel: { color: 5, strength: 0.14 },
  shop: { color: 5, strength: 0.14 },
  farm: { color: 23, strength: 0 },
  lakeside: { color: 23, strength: 0 },
  kitchen: { color: 5, strength: 0.1 },
  cellar: { color: 24, strength: 0.3 },
} as const;
export const OUTDOOR_KINDS: readonly string[] = ['farm', 'lakeside'];
/** The light map is drawn in blocks of this many art px (cheap, and the halos stay a bit chunky). */
export const LIGHT_PIXEL = 2;
/** At the flame a light takes this part of the ambient shade away (fading smoothly to the edge). */
export const LIGHT_CUT = 0.9;
/** At the flame a light adds this much of its own color to the room (additive, fading to the edge). */
export const LIGHT_GLOW = 0.3;
/** The light map is redrawn this often (the candle flicker steps with it), ms. */
export const LIGHT_STEP_MS = 120;
/** A full flicker changes the radius and the brightness by at most these parts. */
export const FLICKER_RADIUS = 0.07;
export const FLICKER_BRIGHTNESS = 0.16;
/** Dust specks per light pool, and the most on screen at once. */
export const DUST_PER_LIGHT = 4;
export const DUST_MAX = 28;
/** The puff at the feet when an avatar starts walking lasts this long, ms. */
export const WALK_PUFF_MS = 320;
/** A standing customer shifts 1 px to a side for IDLE_SHIFT_HOLD_MS, once every IDLE_SHIFT_EVERY_MS. */
export const IDLE_SHIFT_EVERY_MS = 2600;
export const IDLE_SHIFT_HOLD_MS = 700;
/** Sound: the volume a new player starts with (0 to 1; quiet on purpose). */
export const SOUND_DEFAULT_VOLUME = 0.35;
/** Where the device settings (sound, volume, lighting) are stored. */
export const PREFS_KEY = 'pixel-hotel.prefs';
/** Device storage key of the first-ten-minutes guide state (FP-1; not part of the save). */
export const FIRST_TEN_KEY = 'pixel-hotel.first-ten';

// ---------- Logo splash on every page load (client only) ----------
/** The logo pops in (scale SPLASH_POP_FROM -> 1 with a small bounce) over this many ms. */
export const SPLASH_POP_MS = 400;
export const SPLASH_POP_FROM = 0.8;
/** It stays this long after the pop, then the logo and the background fade out over SPLASH_FADE_MS. */
export const SPLASH_HOLD_MS = 1500;
export const SPLASH_FADE_MS = 500;
/** The logo art is SPLASH_LOGO_PX square; it is shown x2 when that fits with SPLASH_MARGIN_PX free on each side. */
export const SPLASH_LOGO_PX = 256;
export const SPLASH_MARGIN_PX = 16;
