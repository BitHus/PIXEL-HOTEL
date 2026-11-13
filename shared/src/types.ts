// Plain data types from the brief (sections 5, 7, 8, 9, 10). No logic here.

import type { EnemyKind, RoomLevel } from './config.ts';

// ---------- Common ----------
export type Facing = 'down' | 'right' | 'up' | 'left';
export interface Point {
  x: number;
  y: number;
}
/** Random number source passed into rules: returns a float in [0, 1). */
export type Rng = () => number;

// ---------- Rooms and styles (section 5) ----------
export type RoomKind = 'hotel' | 'shop';

export interface Room {
  id: number;
  kind: RoomKind;
  level: RoomLevel;
  /** Floor size in px. */
  w: number;
  h: number;
  floorStyle: string;
  wallStyle: string;
  ownerId: number;
  /** Owners can set a room to private (section 13). */
  private: boolean;
}

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

export interface ArtBox {
  dx: number;
  dy: number;
  w: number;
  h: number;
  color: string;
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
  baseValue: number;
  rarity: Rarity;
  inCatalog: boolean;
  art: FurnitureArt;
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
export interface AvatarLook {
  skin: number;
  hair: number;
  hairStyle: number;
  shirt: number;
  legs: number;
  shoes: number;
}

export type AvatarState = 'idle' | 'walk' | 'sit';

export interface Avatar {
  id: number;
  name: string;
  look: AvatarLook;
  roomId: number | null;
  /** The feet, in px. */
  x: number;
  y: number;
  facing: Facing;
  state: AvatarState;
}

// ---------- Economy (section 9) ----------
export type MaterialId = 'bone' | 'cloth' | 'crystal' | 'wood' | 'throne_piece';

export interface MaterialType {
  id: MaterialId;
  name: string;
  baseValue: number;
}

/** What a customer can want. */
export type ShopCategory = 'materials' | 'home_furniture' | 'shop_furniture' | 'crypt_furniture';

/** A thing that can be sold: a stack of a material, or one furniture item. */
export type LootRef =
  | { kind: 'material'; id: MaterialId; qty: number }
  | { kind: 'furniture'; uid: number };

export interface ShopSlot {
  /** uid of the shelf item that owns this slot. */
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

export interface Shop {
  roomId: number;
  slots: ShopSlot[];
  /** Time (ms) when the next customer arrives. */
  nextCustomerAt: number;
  /** Last sale prices per item type (SALE_HISTORY_LENGTH each). */
  saleHistory: Record<string, number[]>;
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
  | 'shelf';

export interface LedgerEntry {
  id: number;
  at: number;
  playerId: number;
  reason: LedgerReason;
  goldDelta: number;
  materials?: Partial<Record<MaterialId, number>>;
  furnitureUids?: number[];
  note?: string;
}

export type GearId = 'iron_sword' | 'leather_armor';

export interface Player {
  id: number;
  name: string;
  level: number;
  xp: number;
  wallet: Wallet;
  materials: Record<MaterialId, number>;
  unlockedStyles: string[];
  gear: GearId[];
  potions: number;
  hotelRoomId: number;
  shopRoomId: number;
}

// ---------- Dungeon (section 10) ----------
export type DungeonBlock = 'floor' | 'wall';

export interface DungeonRoomRect {
  /** In blocks. */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface DungeonFloor {
  seed: number;
  /** 1-based floor number. */
  n: number;
  w: number;
  h: number;
  /** Row-major, w * h blocks. */
  blocks: DungeonBlock[];
  rooms: DungeonRoomRect[];
  spawn: Point;
  /** The exit block, in block coordinates. */
  exit: Point;
}

export interface Enemy {
  id: number;
  kind: EnemyKind;
  isMimic: boolean;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  /** ms left in the wind-up, 0 when not winding up. */
  windupMs: number;
  /** ms left until it may start a new attack. */
  cooldownMs: number;
}

export type ChestKind = 'wooden' | 'golden';

export interface Chest {
  id: number;
  kind: ChestKind;
  isMimic: boolean;
  opened: boolean;
  x: number;
  y: number;
}

export interface BagSlot {
  loot: LootRef | { kind: 'furniture_type'; typeId: string };
}

export interface RunBag {
  slots: BagSlot[];
  gold: number;
  potions: number;
}

export interface DungeonPlayer {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  attackMin: number;
  attackMax: number;
  defense: number;
  attackCooldownMs: number;
  potionCooldownMs: number;
  target: Point | null;
  targetEnemyId: number | null;
}

export type RunStatus = 'active' | 'at_exit' | 'dead' | 'banked';

export interface DungeonRun {
  id: number;
  playerId: number;
  seed: number;
  floor: DungeonFloor;
  player: DungeonPlayer;
  enemies: Enemy[];
  chests: Chest[];
  bag: RunBag;
  xpGained: number;
  status: RunStatus;
  timeMs: number;
}

export type DungeonInput =
  | { t: 'walk'; x: number; y: number }
  | { t: 'attack'; enemyId: number }
  | { t: 'potion' }
  | { t: 'deeper' }
  | { t: 'leave' };

export interface LootDrop {
  item: string;
  min: number;
  max: number;
  weight: number;
}

export interface LootTable {
  id: string;
  rolls: number;
  drops: LootDrop[];
}

export interface RecipeInput {
  item: MaterialId;
  qty: number;
}

export interface Recipe {
  id: string;
  /** A furniture type id, or a style id. */
  makes: string;
  makesKind: 'furniture' | 'style';
  inputs: RecipeInput[];
}
