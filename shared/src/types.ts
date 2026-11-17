// Plain data types from the brief (sections 5, 7, 8, 9, 10). No logic here.

import type { Icon } from './icons.ts';

// ---------- Common ----------
export type Facing = 'down' | 'right' | 'up' | 'left';
export interface Point {
  x: number;
  y: number;
}
/** Axis-aligned rectangle in world px: top-left corner plus size. */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Random number source passed into rules: returns a float in [0, 1). */
export type Rng = () => number;

// ---------- Rooms and styles (section 5) ----------
// Room and RoomKind live in room.ts.

export type StyleKind = 'floor' | 'wall';

export interface StyleType {
  id: string;
  kind: StyleKind;
  name: string;
  baseValue: number;
  inCatalog: boolean;
  appeal: number;
}

// ---------- Furniture (section 7) ----------
export type PlaceIn = 'hotel' | 'shop' | 'both';
/** The four ranks of every item, material, crop, food, ore, gem and furniture type (step 9e). */
export type Rank = 'common' | 'rare' | 'ultra_rare' | 'legendary';

/**
 * A placeholder box, for the 'down' facing. (dx, dy) is the front-left corner of the box on the
 * floor, relative to the anchor (dy <= 0 goes back). w and d are its size on the floor, z its
 * height above the floor and h the height of its front face. It is drawn as a front face (w by
 * h, darker) with a top face (w by d, lighter) above it. color is a palette index.
 */
export interface ArtBox {
  dx: number;
  dy: number;
  w: number;
  d: number;
  z: number;
  h: number;
  color: number;
  /** Optional part name: 'pillow' (where a lying head goes), 'cover' (drawn again over a lying avatar). */
  role?: 'pillow' | 'cover';
}

export type FurnitureArt = { boxes: ArtBox[] } | { sprite: string };

/** What a tap on a placed piece does (step 9g-2): switch a light or fire, play a tune, show the time, open the Avatar panel, the cat's basket, or a pastime (darts, dice). */
export type UseKind = 'toggle' | 'fire' | 'music' | 'clock' | 'mirror' | 'pet' | 'darts' | 'dice' | 'none';

export interface FurnitureType {
  id: string;
  name: string;
  /** The inventory icon (step BG2). */
  icon: Icon;
  category: string;
  theme: string;
  placeIn: PlaceIn;
  /** Shop decoration value, else 0. */
  appeal: number;
  /** Footprint on the floor in px. */
  w: number;
  d: number;
  /** For drawing only, px. */
  height: number;
  blocks: boolean;
  sittable: boolean;
  surface: boolean;
  onSurface: boolean;
  /** True for small decor on a surface (candle, lamp, plant, jug): it stands at ANY point on the top of the surface item (4 px snap), not on a cell. Register and tap stand leave it off. */
  freeOnSurface?: boolean;
  wall: boolean;
  facings: Facing[];
  /** Where a customer stands, relative to the anchor. Default { dx: 0, dy: 24 }. */
  standPoint: { dx: number; dy: number };
  /** Places to sit or lie (step 5b), relative to the anchor for the 'down' facing; turned with the item. */
  seats: Seat[];
  baseValue: number;
  rank: Rank;
  inCatalog: boolean;
  /** True for the shop counter (step 7): it can be moved and rotated, never picked up or sold. */
  noPickup?: boolean;
  /** True for the counter: the shopkeeper stands behind it (behindPoint) to take payments, so that
   *  spot must stay reachable from the door (canPlace). */
  servedFromBehind?: boolean;
  /** OA-6: a bar extension piece (one cell, surface): it must touch the counter or another piece in a straight line, same facing (barExtension.ts). Register, taps and mugs may stand on it; it is picked up freely. */
  barExtension?: boolean;
  /** Where each slot's goods stand when the item faces down (bottom middle of the good, drawn px
   *  from the anchor: on a shelf board, inside a case). Other facings and types without it: spread
   *  along the top. */
  slotSpots?: { dx: number; dy: number }[];
  /** OA-2: the safe area of the DRAWN table top for dishes, mugs and coins, in footprint coordinates from the anchor (dx, dy = its top-left, w, d). A round table's
   *  art top is only its front part of the square footprint. Missing = the footprint. Used by tableSpots.ts. */
  topFace?: { dx: number; dy: number; w: number; d: number };
  /** True for the brewing barrel (step 9t): crops go in, mugs come out (brewing.ts). */
  brews?: boolean;
  /** True for the keg rack (step K2): it holds CASK_SLOTS casks, each ripening mugs of one drink (casks.ts). */
  casks?: boolean;
  /** True for the stove (step K1): crops go in, dishes come out in real time (cooking.ts). */
  cooks?: boolean;
  /** True for the tap stand (step T1): TAP_SLOTS taps, each holds one brewed drink (taps.ts). It stands ON the bar. */
  taps?: boolean;
  /** True for the register (step T1): the till on the bar; a tap opens Serve / Menu / Sell and collected coins fly into it. */
  till?: boolean;
  /** True for the prep table (step T1): inside the kitchen zone and next to a stove it adds dishes to a batch (kitchen.ts). */
  preps?: boolean;
  /** True for kitchen furniture (step T1): pantry, sink, serving hatch, prep table. Only for the Room panel and the Book text; no rule. */
  kitchen?: boolean;
  /** A light source (atmosphere step): the client draws a warm pool around the item. Drawing only. */
  light?: LightSource;
  /** What a tap does in play mode (step 9g-2). Absent = nothing. 'toggle' and 'fire' keep an on/off state on the item (FurnitureItem.on). */
  use?: UseKind;
  /** For use 'music': the tune id in shared/data/tunes.json. */
  tune?: string;
  /** A small fish swimming in the item (the fish tank; step 9f). Drawing only: dx and z (px) of its start, size, how far it swims, colour. */
  swim?: { dx: number; z: number; w: number; h: number; range: number; color: number };
  art: FurnitureArt;
}

/** A light pool: radius in world px, color a palette index, flicker 0 (steady) to 1 (a candle). */
export interface LightSource {
  radius: number;
  color: number;
  flicker: number;
}

export type SeatPoseKind = 'sit' | 'lie';

/** A seat for the 'down' facing: (dx, dy) from the anchor; for 'lie' it is the middle of the body. */
export interface Seat {
  dx: number;
  dy: number;
  pose: SeatPoseKind;
}

export interface FurnitureItem {
  uid: number;
  typeId: string;
  ownerId: number;
  /** null = in the inventory. */
  roomId: number | null;
  /** Anchor: bottom center of the footprint, world px. */
  x: number;
  y: number;
  facing: Facing;
  /** null, or the uid of the surface item it stands on. */
  onItemUid: number | null;
  /** On/off state of a usable piece (use 'toggle' or 'fire', step 9g-2, save 28). Absent = on (isOn in itemUse.ts). */
  on?: boolean;
}

// ---------- Avatars (section 8) ----------
// Avatar, AvatarLook and AvatarState live in avatar.ts.

// ---------- Economy (section 9) ----------
/** Dungeon materials (section 10). */
/** The blocks (shared/data/blocks.json, step BG5). They stack in the bag like materials. */
export type BlockId = 'dirt' | 'clay' | 'thatch' | 'planks' | 'stone' | 'glass' | 'brick' | 'lantern_block' | 'mossy_stone' | 'cinder_block'
  | 'sandstone' | 'hay_bale' | 'wicker' | 'copper_plate' | 'rich_soil' | 'marble' | 'frost_brick' | 'rune_stone' | 'amber_block' | 'lava_glass' | 'quartz' | 'obsidian';
export type BaseMaterialId =
  | 'bone'
  | 'cloth'
  | 'crystal'
  | 'wood'
  | 'throne_piece'
  // Enemy drops (step 9e): one per rank for every enemy type.
  | EnemyDropId
  // The mine and the forge (section 10c, step 9c).
  | OreId
  | BarId
  | 'gem';
export type EnemyDropId =
  | 'slime_gel' | 'sticky_core' | 'royal_jelly' | 'slime_crown'
  | 'bat_wing' | 'echo_fang' | 'moon_membrane' | 'night_pearl'
  | 'bone_dust' | 'rusty_buckle' | 'grave_ring' | 'ancient_skull'
  | 'chest_hinge' | 'mimic_tongue' | 'gilded_lock' | 'greedy_heart'
  | 'royal_bone' | 'king_seal' | 'crown_shard' | 'kings_heart';
export type OreId = 'copper_ore' | 'iron_ore' | 'mithril_ore';
export type BarId = 'copper_bar' | 'iron_bar' | 'mithril_bar';
/** Farm goods (section 10b, step 9b): seeds (crops.json), crops (crops.json) and food (food.json). */
export type CropSeedId = 'turnip_seed' | 'potato_seed' | 'carrot_seed' | 'pumpkin_seed' | 'glowcap_spore'
  | 'beet_seed' | 'leek_seed' | 'onion_seed' | 'pepper_seed' | 'berry_seed' | 'brown_cap_seed' | 'sunmelon_seed' | 'honey_root_seed';
/** Every block has a seed (step BG6): `<block id>_seed`; planted, it grows blocks. */
export type BlockSeedId = `${BlockId}_seed`;
/** Seeds that only splicing makes (step BG7, shared/data/spliceSeeds.json): they grow drinks, furniture, clothes and rarer goods. */
export type SpliceSeedId =
  | 'flaxbloom_seed' | 'hopvine_seed' | 'honeybloom_seed' | 'vine_bench_seed' | 'mohawk_seed' | 'baggy_seed' | 'tunic_seed'
  | 'gilded_chair_seed' | 'honey_table_seed' | 'ember_lamp_seed' | 'amberbud_seed' | 'spiritbrew_seed' | 'heartwood_throne_seed'
  | 'sweetmead_seed' | 'nettle_wine_seed' | 'briar_beer_seed' | 'frost_cider_seed' | 'ember_stout_seed' | 'moonmilk_porter_seed'
  | 'belt_seed' | 'apron_seed' | 'braids_seed' | 'tabard_seed' | 'cloak_seed' | 'kilt_seed' | 'wayfarer_cloak_seed' | 'moonweave_seed' | 'top_knot_seed'
  | 'hearth_stool_seed' | 'cask_table_seed' | 'trestle_bench_seed' | 'rug_runner_seed' | 'candle_stand_seed' | 'banner_stand_seed' | 'candelabra_seed'
  | 'wine_rack_seed' | 'hunters_table_seed' | 'cushion_bench_seed' | 'coat_rack_seed' | 'lord_chair_seed' | 'feast_table_seed' | 'iron_brazier_seed';
export type SeedId = CropSeedId | BlockSeedId | SpliceSeedId;
export type CropId = 'turnip' | 'potato' | 'carrot' | 'pumpkin' | 'glowcap'
  | 'beet' | 'leek' | 'onion' | 'pepper' | 'berry' | 'brown_cap' | 'sunmelon' | 'honey_root';
export type FoodId = 'roasted_turnip' | 'potato_stew' | 'carrot_soup' | 'pumpkin_pie' | 'glowcap_broth' | 'grilled_perch' | 'carp_stew' | 'eel_pie'
  | 'pickled_beets' | 'beet_stew' | 'leek_broth' | 'onion_tart' | 'pepper_roast' | 'berry_pudding' | 'cap_skewers' | 'hearty_hotpot' | 'sunmelon_tart' | 'honeyed_roots';
/** The lakeside (section 10d, step 9f): fish (fish.json) and the things fished up (also fish.json), and what trees give besides wood. */
export type FishId =
  | 'mudfin' | 'reed_minnow' | 'pebble_perch' | 'silver_dace' | 'pond_loach'
  | 'lantern_carp' | 'stripe_pike' | 'moss_catfish' | 'copper_trout'
  | 'moonscale_eel' | 'glass_sturgeon' | 'old_king_barbel';
export type ThingId = 'old_boot' | 'driftwood' | 'shell' | 'glass_bottle' | 'pearl' | 'sunken_crown';
export type TreeDropId = 'resin' | 'amber' | 'golden_acorn';
/**
 * Every stackable good: the dungeon materials plus the farm's seeds, crops and food (step 9b). They
 * all live in Player.materials, stack in the bag's Materials tab and go through the ledger.
 */
/** The tavern's drinks (step 9t, shared/data/drinks.json): brewed in a barrel, served by the mug. */
/** The drinks drinks.json brews (fresh). */
export type BaseDrinkId = 'root_ale' | 'carrot_cider' | 'pumpkin_stout' | 'glowcap_tonic'
  | 'sweetmead' | 'nettle_wine' | 'briar_beer' | 'frost_cider' | 'ember_stout' | 'moonmilk_porter';
/** How far a drink has ripened in a cask (step K2): fresh is the plain drink. */
export type DrinkTier = 'aged' | 'vintage';
/** A drink item: the plain drink, or its aged / vintage tier (`root_ale_aged`, built from drinks.json by materials.ts). */
export type DrinkId = BaseDrinkId | `${BaseDrinkId}_${DrinkTier}`;
export type MaterialId = BaseMaterialId | BlockId | SeedId | CropId | FoodId | FishId | ThingId | TreeDropId | DrinkId;
/** What kind of stackable good it is. */
export type MaterialGroup = 'block' | 'material' | 'seed' | 'crop' | 'food' | 'fish' | 'thing' | 'drink';

export interface MaterialType {
  id: MaterialId;
  name: string;
  baseValue: number;
  /** Old placeholder colour (palette index); the icon below is what items show since BG2. */
  color: number;
  /** The item's square icon (step BG2). */
  icon: Icon;
  rank: Rank;
  group: MaterialGroup;
}

/** One thing: a unit of a material, or one furniture item (a drawn item in the hand, a hop, an icon). */
export type LootRef =
  | { kind: 'material'; id: MaterialId; qty: number }
  | { kind: 'furniture'; uid: number; typeId: string };

export type Reaction = 'big_smile' | 'smile' | 'shrug' | 'frown';

export interface Wallet {
  gold: number;
  /** The second currency (step BG5 starts it; BG4 adds the other sources). Never traded, never sold. */
  gems: number;
}

export type LedgerReason =
  | 'start'
  | 'sale'
  | 'catalog'
  | 'room_upgrade'
  | 'dungeon_key'
  | 'dungeon_bank'
  | 'blacksmith'
  | 'potion'
  | 'craft'
  | 'shelf'
  | 'shop_closed'
  | 'style'
  | 'seeds'
  | 'plant'
  | 'harvest'
  | 'splice'
  | 'cook'
  | 'lunch_box'
  | 'smelt'
  | 'forge'
  | 'mine_bank'
  | 'book_reward'
  | 'quest'
  | 'chop'
  | 'fish'
  // Blocks (step BG5): a block put in a cell, a block broken (it comes back, maybe a seed and gems).
  | 'block_place'
  | 'block_break'
  | 'block_return'
  // Inn doors (step MB-2): things that stood on a door spot go back to the bag.
  | 'door_spot'
  // The tavern (step 9t): brewing, an order taken out of the bag (and put back when the guest
  // leaves unserved), the coins collected from a table, the furniture an old save gets.
  | 'brew'
  | 'tavern_order'
  // Casks (step K2): fresh mugs into a cask on a keg rack, and the ripened mugs out.
  | 'cask_fill'
  | 'cask_collect'
  | 'tavern'
  | 'tavern_gift'
  // Taps (step T1): mugs moved from the bag onto a tap and back (nothing is found or lost).
  | 'tap'
  // Packs (step BG8): a pack opened for gems; a spare piece of clothing sold for gold.
  | 'pack'
  | 'spare_sale'
  // The trader at the bar (step S2): surplus things sold for gold, only when the player taps.
  | 'sell'
  | 'debug';

export interface LedgerEntry {
  id: number;
  at: number;
  playerId: number;
  reason: LedgerReason;
  goldDelta: number;
  /** Gems added (negative = spent); absent = 0. */
  gemsDelta?: number;
  materials?: Partial<Record<MaterialId, number>>;
  /** Furniture added (new or back from a shop slot). */
  furnitureUids?: number[];
  /** Clothing copies gained (positive; the first unlocks the piece, the rest are spares) or spares sold (negative), by id (step BG8). */
  clothing?: Record<string, number>;
  /** Furniture taken out (put on a shop slot). */
  removedUids?: number[];
  note?: string;
}

/** Gear made at the forge (section 10c, shared/data/forge.json). Player.gear holds at most one
 *  piece per slot (weapon, armor, pickaxe): an upgrade replaces the piece before it. */
export type GearId = 'copper_sword' | 'iron_sword' | 'mithril_sword' | 'leather_armor' | 'iron_armor' | 'mithril_armor' | 'steel_pickaxe' | 'steel_axe' | 'copper_reel_rod' | 'mithril_rod';

export interface Player {
  id: number;
  name: string;
  /** The name of the player's Inn (MB-1, save 24): max DISPLAY_NAME_MAX letters, digits and spaces; shown in the info panel. */
  innName: string;
  level: number;
  xp: number;
  wallet: Wallet;
  /** Only materials the player has (missing = 0). */
  materials: Partial<Record<MaterialId, number>>;
  /** Unlocked styles as 'floor:<id>' and 'wall:<id>' (styleKey). */
  unlockedStyles: string[];
  gear: GearId[];
  potions: number;
  /** Clothing ids unlocked beyond the free ones (step 7b; none yet). */
  unlockedClothing: string[];
  hotelRoomId: number;
  shopRoomId: number;
  /** CEL-1: the attached kitchen room and the cellar room (missing = not built yet; see docs/PLAN-CELLAR.md). */
  kitchenRoomId?: number;
  cellarRoomId?: number;
  /** The farm (step 9b). */
  farmRoomId: number;
  /** The lakeside (step 9f). */
  lakesideRoomId: number;
  /** The biggest catch of each fish in cm (step 9f; the Book shows it). */
  biggest: Record<string, number>;
  /** How many mine visits were started (step 9c; mithril rocks from visit MITHRIL_FROM_VISIT on). */
  mineVisits: number;
  /**
   * The collection book (step 9e): everything the player ever found, by id (a material id, a
   * furniture type id, or 'enemy:<kind>' for enemies met; count = found in total / kills).
   * Kept right by the ledger function (applyChange) and by the kills of a finished run.
   */
  seen: SeenMap;
  /** When the Book was last opened (entries first seen after it show "New!"). */
  bookOpenedAt: number;
  /** Book rewards already taken, as '<tab>:<percent>'. */
  bookRewards: string[];
  /** Splice recipes found (step BG7): the pair keys of recipes whose result was harvested (splice.ts pairKey). */
  splicesFound: string[];
  /**
   * Spare copies of unlocked clothing (step BG8): a piece found again is not lost, the extra copies are kept here
   * (missing = 0; a piece owned twice has 1 spare). They can be sold (config SPARE_SELL).
   */
  clothingSpares: Record<string, number>;
  /** How many packs of each kind were opened (step BG8; for quests later). */
  packsOpened: Record<string, number>;
  /** The adopted cat (step 9g-2, save 28): null until the pet basket is used. Only the name is saved; the cat's place is not. */
  pet: { name: string } | null;
}

export interface SeenEntry {
  count: number;
  firstSeenAt: number;
}
export type SeenMap = Record<string, SeenEntry>;

// ---------- Dungeon (section 10) ----------
// The dungeon types live in dungeon/run.ts; gear in gear.ts, recipes in crafting.ts, loot tables in
// dungeon/loot.ts.
