// Plain data types from the brief (sections 5, 7, 8, 9, 10). No logic here.

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
export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic';

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

export interface FurnitureType {
  id: string;
  name: string;
  category: string;
  theme: string;
  placeIn: PlaceIn;
  /** Shelves: how many items it holds, else 0. */
  slots: number;
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
  wall: boolean;
  facings: Facing[];
  /** Where a customer stands, relative to the anchor. Default { dx: 0, dy: 24 }. */
  standPoint: { dx: number; dy: number };
  /** Places to sit or lie (step 5b), relative to the anchor for the 'down' facing; turned with the item. */
  seats: Seat[];
  baseValue: number;
  rarity: Rarity;
  inCatalog: boolean;
  /** True for the shop counter (step 7): it can be moved and rotated, never picked up or sold. */
  noPickup?: boolean;
  /** True for the counter: the shopkeeper stands behind it (behindPoint) to take payments, so that
   *  spot must stay reachable from the door (canPlace). */
  servedFromBehind?: boolean;
  /** Where each slot's goods stand when the item faces down (bottom middle of the good, drawn px
   *  from the anchor: on a shelf board, inside a case). Other facings and types without it: spread
   *  along the top. */
  slotSpots?: { dx: number; dy: number }[];
  art: FurnitureArt;
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
}

// ---------- Avatars (section 8) ----------
// Avatar, AvatarLook and AvatarState live in avatar.ts.

// ---------- Economy (section 9) ----------
export type MaterialId = 'bone' | 'cloth' | 'crystal' | 'wood' | 'throne_piece';

export interface MaterialType {
  id: MaterialId;
  name: string;
  baseValue: number;
  /** Placeholder icon color (palette index) until real 32x32 icons exist. */
  color: number;
}

/** What a customer can want. */
export type ShopCategory = 'materials' | 'home_furniture' | 'shop_furniture' | 'crypt_furniture';

/** A thing for sale on a shop slot: one unit of a material, or one furniture item (taken out of
 *  GameState.items while it is on the slot, and put back when taken off). */
export type LootRef =
  | { kind: 'material'; id: MaterialId; qty: number }
  | { kind: 'furniture'; uid: number; typeId: string };

export interface ShopSlot {
  /** uid of the table, shelf or case that owns this slot. */
  shelfUid: number;
  index: number;
  /** null = empty slot. */
  loot: LootRef | null;
  price: number;
}

export type Reaction = 'big_smile' | 'smile' | 'shrug' | 'frown';

export interface SaleRecord {
  /** Material id or furniture type id. */
  typeId: string;
  price: number;
  at: number;
}

export interface Wallet {
  gold: number;
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
  | 'style'
  | 'debug';

export interface LedgerEntry {
  id: number;
  at: number;
  playerId: number;
  reason: LedgerReason;
  goldDelta: number;
  materials?: Partial<Record<MaterialId, number>>;
  /** Furniture added (new or back from a shop slot). */
  furnitureUids?: number[];
  /** Furniture taken out (put on a shop slot). */
  removedUids?: number[];
  note?: string;
}

export type GearId = 'iron_sword' | 'leather_armor';

export interface Player {
  id: number;
  name: string;
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
}

// ---------- Dungeon (section 10) ----------
// The dungeon types live in dungeon/run.ts; gear in gear.ts, recipes in crafting.ts, loot tables in
// dungeon/loot.ts.
