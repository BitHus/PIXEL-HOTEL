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
/** The door zone: 2 x 2 cells on the floor just inside the door (BG1). */
export const DOOR_ZONE_W = 64;
export const DOOR_ZONE_H = 64;

export type RoomLevel = 1 | 2 | 3;
export const ROOM_MAX_LEVEL: RoomLevel = 3;

/** The build grid (step BG1): rooms, floors and furniture footprints are whole cells of this size, px. */
export const BUILD_CELL = 32;
/**
 * Room shapes and their floor rectangles per level live in shared/data/roomShapes.json in CELLS
 * (BUILD_CELL px each). This grid (px) is only the size of the thin border pieces that are drawn
 * around the floor.
 */
export const ROOM_GRID = 16;

/** Gold cost to upgrade a room TO this level (same for hotel and shop). */
export const ROOM_UPGRADE_COST = {
  2: 300,
  3: 800,
} as const;

/** Starting style for every room. */
export const START_FLOOR_STYLE = 'bare';
/** The floor of the tavern's kitchen annex (owner 18 Nov): always this style, whatever the room's floor. */
export const KITCHEN_FLOOR_STYLE = 'kitchen_tiles';
export const START_WALL_STYLE = 'bare';

/**
 * Fixed starting furniture in a new shop (step 7). Anchor positions (bottom center of the
 * footprint): the counter near the back wall (with room behind it for the shopkeeper), left of
 * center; the stall_table in the middle.
 */
export const SHOP_START_ITEMS = [
  { typeId: 'counter', x: 80, y: 96, facing: 'down' },
  { typeId: 'stall_table', x: 304, y: 192, facing: 'down' },
] as const;

// ---------- Movement (section 6) ----------
/** Navigation grid cell size in rooms, px: the build grid (step BG1). Blockers are whole cells. */
export const NAV_CELL = BUILD_CELL;
/** Walking speed in the hotel and the shop, px per second. */
export const HOTEL_WALK_SPEED = 128;

// ---------- Furniture (section 7) ----------
/** Snap of WALL items (they stay free along the back wall band), px. Shift turns it off. Floor items snap to cells. */
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
/** U1/C17: the layered avatar picks its walk frame by DISTANCE walked: one frame per this many px (guests and the player never skate). */
export const WALK_FRAME_PX = 12;
/** The walk bob switches between up and down every this many ms. */
export const WALK_BOB_MS = 150;
/** CH1: the face blinks (the closed-eye picture) for BLINK_CLOSED_MS every BLINK_MIN_MS to BLINK_MAX_MS (a fixed interval per avatar, seeded). */
export const BLINK_CLOSED_MS = 120;
export const BLINK_MIN_MS = 3000;
export const BLINK_MAX_MS = 5000;
/** Where a new avatar stands: this far above the bottom of the floor, centered (in the door zone). */
export const AVATAR_START_FROM_BOTTOM = 24;

/** A walker already moving keeps its shown position when the model's differs by less than this, px (a tick is up to 13 px at 128 px/s); only a bigger gap jumps. */
export const WALK_RESYNC_PX = 24;
