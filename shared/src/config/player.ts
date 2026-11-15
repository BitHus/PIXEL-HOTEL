// ---------- Player, inventory and saving (step 5) ----------
/** The local player's id and name (one player per browser until accounts exist). */
export const LOCAL_PLAYER_ID = 1;
export const LOCAL_PLAYER_NAME = 'You';
/** The Inn's default name (MB-1); the player can pick another at the start (same rules as the display name). */
export const DEFAULT_INN_NAME = 'The Inn';
/** Room ids of a new local player's two rooms. */
export const START_HOTEL_ROOM_ID = 1;
export const START_SHOP_ROOM_ID = 2;
export const START_FARM_ROOM_ID = 3;
export const START_LAKESIDE_ROOM_ID = 4;
/** The starting avatar look (palette indices; styles are clothing.json ids). */
export const START_LOOK = { skin: 30, hair: 5, hairStyle: 'short', top: 'long_sleeve', shirt: 7, bottoms: 'trousers', legs: 23, shoes: 6 } as const;
/** Colour choices per look slot (palette indices), for character creation and the Avatar panel. */
export const LOOK_COLORS = {
  skin: [30, 31, 3, 4, 5],
  hair: [5, 6, 0, 1, 10, 2, 24, 20],
  top: [7, 13, 16, 27, 0, 14, 9, 22, 2],
  bottoms: [23, 5, 24, 15, 6, 14, 27, 7],
  shoes: [6, 5, 25, 4, 23],
} as const;
/** Display names: at most this many letters, digits and spaces. */
export const DISPLAY_NAME_MAX = 16;
/** Slots in the hotbar at the bottom of the screen. */
export const HOTBAR_SLOTS = 6;
/** Slots in each bag tab (Furniture, Materials). Empty slots stay visible. If a new item type
 *  finds no free slot, the tab grows by one slot so nothing is ever lost. */
export const BAG_SLOTS = 36;
/** Bag grid columns: on a wide screen, and on a phone (bottom sheet). */
export const BAG_COLUMNS = 9;
export const BAG_COLUMNS_PHONE = 6;
/** Version of the save format. Bump it (and add a migration in save.ts) when GameState changes. */
export const SAVE_VERSION = 27;
/** localStorage key of the save: SAVE_KEY_PREFIX + version. */
export const SAVE_KEY_PREFIX = 'pixel-hotel.save.v';
/** One automatic backup: the save as it was when the game was opened (or before an import). */
export const SAVE_BACKUP_KEY = 'pixel-hotel.save.backup';

// ---------- Chat (step 5) ----------
/** A chat bubble stays at least this long (ms; longer texts: readingMs), fading out during the
 *  last CHAT_BUBBLE_FADE_MS. */
export const CHAT_BUBBLE_MS = 6000;
export const CHAT_BUBBLE_FADE_MS = 900;
/** Gap between stacked bubbles and above the head, screen px. */
export const CHAT_BUBBLE_GAP_PX = 4;
/** One avatar shows at most this many bubbles at once (the oldest goes). */
export const CHAT_BUBBLES_PER_AVATAR = 3;
/** The chat log keeps this many lines. */
export const CHAT_LOG_MAX = 100;
/** Reading pace (fix after 7b): every text on screen (toasts, chat bubbles) stays at least
 *  TEXT_MIN_MS plus TEXT_MS_PER_WORD per word (readingMs), then fades out over TEXT_FADE_MS. */
export const TEXT_MIN_MS = 4000;
export const TEXT_MS_PER_WORD = 350;
export const TEXT_FADE_MS = 900;

// ---------- Catalog, rooms and hints (step 7) ----------
/** The first catalog purchase pops into placing: the ghost grows in over this many ms. */
export const FIRST_BUY_POP_MS = 220;
/** First-run hints, shown one at a time (GameState.hintsDone counts the finished ones). */
export const HINTS = [
  'Open the Catalog and buy something with your 100 gold.',
  'Place it in your room.',
  'Earn gold in your tavern: tap a guest who waits with an order to serve them, then tap the coins they leave. Brew root ale at the barrel and load it on a tap (tap the tap stand on the bar), or cook a roasted turnip at the stove. Tap the register for the menu.',
  'Tap the Dungeon button for a run: chests and slimes give gold and loot to cook, brew, craft and build with. What you will not use, sell at the bar: tap the bar and open the Sell tab.',
  'Open the Map and go to your farm. Buy turnip seeds in the Catalog (Seeds), pick them in the hotbar, tap a soil cell to plant, and punch the plant when it is fully grown (about 2 minutes). Punching blocks, plants and chests, and catching fish, drop gems.',
  'Gems buy packs. With 30 gems open the Catalog, the Packs tab, and open a Basic Seeds Pack: its odds are on the card.',
  'Level 3: the mine is open! Open the Map and go mining. Smelt the ore into bars at the Workshop (Forge).',
  'Splice: plant one seed, then use a different seed on the same planted cell. Some pairs make a brand new seed (see the Book, Splice tab).',
] as const;
/** The one-time toast for an old save (TavernState.introSeen false): the shop became a tavern (step 9t). */
export const TAVERN_INTRO_OLD =
  'Your shop is a tavern now! Guests sit at a table, order from your menu, and wait for you: tap a guest to carry the order from the bar. Place the round table, the stools and the brewing barrel from your bag, tap the barrel to brew drinks from crops and tap the bar to set the menu. Cooking moved here too: dishes come from the stove.';
/** A new game gets this short line after the intro. */
export const TAVERN_INTRO_NEW = 'Welcome to your tavern! Guests sit and order: tap them to serve. Tap the register for the menu and the tap stand to load drinks; tap the barrel to brew.';
/** The one-time hint at the first Inn door (step MB-3). */
export const INN_DOOR_HINT = 'Doors lead to the tavern and the garden. Walk onto the doorway to step through.';
/**
 * The opening notice of an old save (step T1, version below 24): the bar got a register and taps, and the tavern a kitchen.
 * Drinks in the bag stay there until you load them on a tap (guests only order what is on a tap).
 */
export const TAVERN_BAR_NOTICE =
  'Your bar has a register and beer taps now: tap the tap stand and load a brewed drink onto a tap, because guests only order drinks that are on a tap. Tap the register for the menu. The tavern has a kitchen corner too, where guests never go: a prep table next to the stove makes bigger batches.';
/**
 * The opening notice of an old save (step MB-2, version below 27): the rooms have Inn doors now. `n` things that stood on a door spot went back to the bag.
 */
export function innDoorNotice(n: number): string {
  return `Your rooms have doors to each other now (suite, tavern, garden). ${n} ${n === 1 ? 'thing' : 'things'} that stood on a door spot went back to your bag.`;
}
/** The index of the dungeon hint in HINTS: it shows while no run is going. */
export const DUNGEON_HINT = 3;
/** The index of the farm hint (step 9b): done by planting anything. */
export const FARM_HINT = 4;
/** The index of the pack hint (step BG9): done by opening any pack. It sits before the mine hint so a level 1 player sees it. */
export const PACK_HINT = 5;
/** The index of the mine hint (step 9c): shows from MINE_UNLOCK_LEVEL on, done by going in. */
export const MINE_HINT = 6;
/** The index of the splice hint (step BG7): done by splicing two seeds. */
export const SPLICE_HINT = 7;

// ---------- New game intro (step 7b) ----------
/** The bar and the other start items pop in: scale 0 -> 1.2 -> 0.9 -> 1 over this many ms. */
export const POP_MS = 500;
/** The intro waits this long at the overview before the first pop, ms. */
export const INTRO_FIRST_POP_MS = 700;
/** Time between the intro's steps (pops, the walk in, the coins), ms. */
export const INTRO_STEP_MS = 650;
/** The start gold flies in as this many coins, one every INTRO_COIN_EVERY_MS, each flight INTRO_COIN_FLY_MS. */
export const INTRO_COINS = 10;
export const INTRO_COIN_EVERY_MS = 140;
export const INTRO_COIN_FLY_MS = 600;
