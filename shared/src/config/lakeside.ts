// ---------- Lakeside: woodcutting and fishing (section 10d, step 9f) ----------
/** The lake: three water rectangles around the pier (floor px). The lake is about a third of the 576 x 384 lakeside. */
export const LAKE_WATER: readonly { x: number; y: number; w: number; h: number }[] = [
  { x: 288, y: 32, w: 256, h: 128 },
  { x: 288, y: 192, w: 256, h: 96 },
  { x: 384, y: 160, w: 160, h: 32 },
];
/** The wooden pier (walkable) reaching into the lake from the shore. */
export const LAKE_PIER = { x: 256, y: 160, w: 128, h: 32 } as const;
/** The 8 trees: anchor = the bottom middle of the trunk. They stay (a stump) when felled. */
export const LAKE_TREES: readonly { x: number; y: number }[] = [
  { x: 48, y: 96 }, { x: 112, y: 64 }, { x: 176, y: 96 }, { x: 48, y: 224 },
  { x: 144, y: 256 }, { x: 208, y: 288 }, { x: 432, y: 352 }, { x: 528, y: 320 },
];
/** A tree's trunk footprint (blocks walking), px: it sits in the bottom half of one cell (the anchors are on cell centres). */
export const TREE_FOOTPRINT = { w: 24, d: 16 } as const;
/** Bushes: decoration only (drawn, never in the way). */
export const LAKE_BUSHES: readonly { x: number; y: number }[] = [
  { x: 24, y: 160 }, { x: 96, y: 150 }, { x: 250, y: 60 }, { x: 310, y: 300 }, { x: 366, y: 312 },
  { x: 470, y: 304 }, { x: 556, y: 352 }, { x: 24, y: 330 }, { x: 170, y: 330 },
];
/** A tree falls after this many hits (a swing counts hitsPerSwing hits: the steel axe 2). */
export const TREE_HITS = 5;
/** The axe cooldown, ms: each tap is one swing, taps during the cooldown are ignored. */
export const AXE_COOLDOWN_MS = 400;
/** A felled tree gives this much wood (both ends included), plus a rolled rank drop (resin, amber, golden acorn). */
export const TREE_WOOD_MIN = 2;
export const TREE_WOOD_MAX = 3;
/** A felled tree grows back after this long of real time (also while the game is closed), ms. */
export const TREE_REGROW_MS = 5 * 60_000;
/** The avatar stands within this distance (feet to the tree's base) to swing, px. */
export const CHOP_REACH_PX = 40;
/** The avatar casts from a free spot within this distance of the water, px. */
export const CAST_REACH_PX = 24;
/** The bobber lands at least this far from the avatar (a cast goes out into the lake; more than the avatar is tall, so it is not hidden behind it), px. */
export const CAST_MIN_PX = 80;
/** The fishing session runs in fixed ticks, like the dungeon, ms (finer than the dungeon's 100: the reel is a moving bar). */
export const FISH_TICK_MS = 50;
/** The bobber floats this long before a bite (random between), ms. */
export const FISH_WAIT_MIN_MS = 2000;
export const FISH_WAIT_MAX_MS = 8000;
/** The "!" stays this long (tap in time to hook), by the rank of the fish: the rarer, the shorter. */
export const FISH_BITE_MS = { common: 700, rare: 650, ultra_rare: 550, legendary: 450 } as const;
/**
 * THE REEL (owner's change after the first playtest, like Stardew Valley's bar): a bar from 0 to
 * FISH_BAR (positions are in bar units). A fish swims back and forth in it; the player moves a
 * green catch box that follows the fish: HOLD (or tap) pushes the box to the right, and it falls
 * back to the left by itself. While the fish is inside the box the catch bar fills; outside it
 * drains. Full = caught, empty = it escapes.
 */
export const FISH_BAR = 100;
/** The catch bar (0 to FISH_REEL_FULL) starts here when the fish is hooked. */
export const FISH_REEL_START = 30;
export const FISH_REEL_FULL = 100;
/** The box: how hard holding pushes it right and how hard it falls left (units/s^2), a tap's kick (units/s), the slowdown per second, the top speed (units/s) and how much of its speed a wall gives back. */
export const FISH_THRUST = 300;
export const FISH_GRAVITY = 170;
export const FISH_TAP_KICK = 24;
export const FISH_BOX_DRAG = 1.1;
export const FISH_BOX_MAX_SPEED = 80;
export const FISH_BOX_BOUNCE = 0.25;
/** The width of the catch box with the basic rod, bar units (a better rod adds boxBonus and makes it fall slower: gravityScale). */
export const FISH_BOX_BASE = 26;
/**
 * By rank (the rarer, the harder): how fast the fish swims (units/s), how long it keeps one
 * direction (ms, min and max), the chance that it darts (suddenly 2.4 x as fast) at a new
 * direction, how fast the catch bar fills while the fish is in the box and how fast it drains
 * while it is out (per second).
 */
export const FISH_REEL = {
  common: { speed: 16, turnMin: 1600, turnMax: 3000, dart: 0, gain: 22, drain: 9 },
  rare: { speed: 24, turnMin: 1300, turnMax: 2500, dart: 0.08, gain: 20, drain: 12 },
  ultra_rare: { speed: 31, turnMin: 1000, turnMax: 2100, dart: 0.15, gain: 19, drain: 14 },
  legendary: { speed: 38, turnMin: 800, turnMax: 1700, dart: 0.25, gain: 17, drain: 17 },
} as const;
/** FISH-1: how fast the fish speeds up and slows down while it swims (units/s^2, by rank): it turns smoothly, never at once. */
export const FISH_SWIM_ACCEL = { common: 70, rare: 120, ultra_rare: 220, legendary: 400 } as const;
/** FISH-1: in the last FISH_NIBBLE_MS before the bite the fish nibbles 2 to 3 times (a gap of min to max ms between nibbles; a nibble pulse lasts FISH_NIBBLE_PULSE_MS). */
export const FISH_NIBBLE_MS = 1800;
export const FISH_NIBBLE_GAP_MIN_MS = 350;
export const FISH_NIBBLE_GAP_MAX_MS = 700;
export const FISH_NIBBLE_PULSE_MS = 250;
/** A reel that lasts longer than this is lost (the fish gets away), ms. A safety limit. */
export const FISH_REEL_MAX_MS = 45_000;
// ---------- Effects (outdoors rework C13/C15; the shared FX_* numbers are in dungeon.ts) ----------
/** Tree crowns sway this many px at most (whole px, off with reduce effects), and a hit puffs this many leaves. */
export const FX_TREE_SWAY_PX = 1;
export const FX_LEAF_PUFF = 5;
/** C13: fishing and tree juice (look only, never rules). The reel shows "draining" when the catch bar is under this fraction of full and falling. */
export const FX_REEL_DRAIN_FRACTION = 0.15;
/** Wait nibbles: a dip of the bobber may start in every window of FX_NIBBLE_EVERY_MS (chance FX_NIBBLE_CHANCE), lasts FX_NIBBLE_MS. Cosmetic: the real bite is fishing.ts. */
export const FX_NIBBLE_EVERY_MS = 1800;
export const FX_NIBBLE_CHANCE = 0.45;
export const FX_NIBBLE_MS = 160;
/** The cast: the bobber flies from the rod to the water in FX_CAST_MS (arc FX_CAST_ARC_PX high). */
export const FX_CAST_MS = 360;
export const FX_CAST_ARC_PX = 26;
/** A bite: the bobber dunks and the "!" pops in this long, ms. */
export const FX_BITE_MS = 260;
/** Ring ripples on the water live this long, ms. */
export const FX_RING_MS = 700;
/** The catch: the fish flies to the avatar in FX_CATCH_FLY_MS, then is held up for FX_CATCH_HOLD_MS. */
export const FX_CATCH_FLY_MS = 500;
export const FX_CATCH_HOLD_MS = 600;
export const FX_CATCH_ARC_PX = 30;
/** A lost fish: the line goes slack and the bobber shakes this long, ms. */
export const FX_SLACK_MS = 450;
/** The catch flash (ultra rare, legendary), ms. */
export const FX_CATCH_FLASH_MS = 500;

// ---------- Lakeside ambient life (outdoors rework C15; look only) ----------
/** Grass and shore decor: how many spots decorSpots asks for, the least distance between two (px) and from a tree, a bush, the pier, the water edge, the door zone and the start (px). */
export const LAKE_DECOR_COUNT = 34;
export const LAKE_DECOR_GAP_PX = 18;
export const LAKE_DECOR_TREE_PX = 30;
export const LAKE_DECOR_BUSH_PX = 22;
export const LAKE_DECOR_PIER_PX = 14;
export const LAKE_DECOR_GRASS_EDGE_PX = 14;
export const LAKE_DECOR_DOOR_PAD_PX = 32;
export const LAKE_DECOR_START_PX = 40;
/** Ambient caps. */
export const LAKE_BIRDS = 2;
export const LAKE_BUTTERFLIES = 3;
export const LAKE_FISH_SHADOWS = 4;
export const LAKE_FALLING_LEAVES = 4;
/** A perched bird flies off when the avatar is within this many px, and comes back after a wait between the two times (ms) once the avatar is away. */
export const LAKE_BIRD_FLEE_PX = 80;
export const LAKE_BIRD_RETURN_MIN_MS = 8000;
export const LAKE_BIRD_RETURN_MAX_MS = 16000;
export const LAKE_BIRD_SPEED = 90;
/** Fish shadows drift at this speed (px/s); a cast within LAKE_FISH_FLEE_PX scares them for LAKE_FISH_FLEE_MS at LAKE_FISH_FLEE_SPEED. */
export const LAKE_FISH_SPEED = 10;
export const LAKE_FISH_FLEE_PX = 90;
export const LAKE_FISH_FLEE_MS = 1200;
export const LAKE_FISH_FLEE_SPEED = 70;
/** A falling leaf takes this long (ms) to fall this far (px) from a tree crown, and a leaf waits up to LAKE_LEAF_GAP_MS between falls. */
export const LAKE_LEAF_FALL_MS = 3200;
export const LAKE_LEAF_FALL_PX = 56;
export const LAKE_LEAF_GAP_MS = 6000;
