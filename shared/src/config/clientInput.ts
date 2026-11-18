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
export const APPROACH_REACH_PX = 16;
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

// ---------- Tap forgiveness (owner 18 Nov, shared/src/tapPick.ts) ----------
/** A tap that misses everything picks the nearest thing within this many screen px of its drawn bounds (a finger is less exact than a mouse). */
export const TAP_TOLERANCE_PX = { touch: 28, mouse: 20 } as const;
/** A thing counts as at least this big for a tap (touch: a 44 px box; mouse: a bit smaller), screen px. */
export const TAP_MIN_SIZE_PX = { touch: 44, mouse: 28 } as const;

// ---------- Camera intro (step 5, section 4) ----------
/** When a room opens: wait this long at the overview zoom... */
export const INTRO_WAIT_MS = 600;
/** ...then zoom in over this long, centered on the avatar... */
export const INTRO_ZOOM_MS = 800;
/** ...to the settled zoom nearest to this many real screen px per art px. */
export const INTRO_DEVICE_PX_PER_ART_PX = 3;
