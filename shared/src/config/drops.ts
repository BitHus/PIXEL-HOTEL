// ---------- Ground drops (OB-8, docs/PLAN-OB-REWORK.md section 2) ----------
// Loot that pops out on the ground and flies to the avatar. Numbers marked OWNER OPEN are proposals.

/** The pop flight from the source to where the drop lands (ms). */
export const DROP_POP_MS = 140;
/** The highest point of the pop arc above the ground (display only, px). */
export const DROP_POP_HEIGHT_PX = 10;
/** How far a drop lands from its source (px, both ends included): inside a 32 px block (half = 16), so ore stays in the broken cell. */
export const DROP_SCATTER_MIN_PX = 4;
export const DROP_SCATTER_MAX_PX = 12;
/** OWNER OPEN: a drop waits this long after it spawned before it can fly to the avatar (so the pop is seen). */
export const DROP_PICKUP_DELAY_MS = 350;
/** OWNER OPEN: the avatar pulls a drop within this many px of its feet (plan proposal 48; 64 because the avatar stops at dig reach, up to about 48 px from the broken block, plus the scatter)... */
export const DROP_MAGNET_PX = 64;
/** ...and gold and gems from this far (they fly faster and on a curve). */
export const DROP_MAGNET_FAST_PX = 80;
/** A flying drop is picked up once it is this close to the avatar (px). */
export const DROP_TOUCH_PX = 12;
/** The magnet flight: start speed, acceleration and top speed (px/s, px/s^2). Always faster than any walk. */
export const DROP_MAGNET_SPEED = 160;
export const DROP_MAGNET_ACCEL = 900;
export const DROP_MAGNET_MAX_SPEED = 480;
/** Gold and gems curve in: the sideways share of the speed at the edge of the radius (0 = straight). */
export const DROP_MAGNET_CURVE = 0.5;
/** At most this many drops lie on one floor or room; past it new loot goes straight to the bag. */
export const DROP_CAP_PER_ROOM = 60;
