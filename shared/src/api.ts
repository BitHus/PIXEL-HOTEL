// The GameAPI interface. The client talks only to this.
// LocalGameAPI (steps 2-9) runs the shared rules in the browser; RemoteGameAPI (step 10) talks to the server.
// Methods are added in later steps as they are needed.

import type { FurnitureItem, MaterialId, Player, Point, Facing, SaleRecord, ShopSlot, StyleKind } from './types.ts';
import type { Customer, ShopEvent } from './customers.ts';
import type { ShelfSlotRef, StockPick } from './shop.ts';
import type { Avatar, AvatarLook } from './avatar.ts';
import type { Room } from './room.ts';
import type { ChatLine } from './gameState.ts';
import type { SeatSpot } from './seats.ts';
import type { BagLayout, BagTab, SlotLayout, SlotRef } from './bag.ts';

export interface RoomState {
  room: Room;
  /** The items placed in this room. */
  items: FurnitureItem[];
  avatars: Avatar[];
}

export interface Inventory {
  /** Furniture not placed in any room (roomId null). */
  furniture: FurnitureItem[];
  materials: Partial<Record<MaterialId, number>>;
  /** Furniture type ids per hotbar slot (null = empty). */
  hotbar: (string | null)[];
  /** Which type sits in which bag slot (Furniture and Materials tabs). */
  bag: BagLayout;
}

/** Where a ghost was put when the player pressed ✓ (the same input the ghost was planned from). */
export interface PlaceAt {
  /** Footprint center the ghost aims at, world px (unsnapped). */
  center: Point;
  facing: Facing;
  /** False while Shift is held (no 4 px snap). */
  snap: boolean;
}

export interface SitResult {
  /** Path to the seat's nearest reachable approach point (starts at the avatar). */
  path: Point[];
  /** The seat the avatar slides onto on arrival (SEAT_SLIDE_MS), and its pose (sit or lie). */
  seat: SeatSpot;
}

/**
 * Item results are the player's items in the current room plus the inventory furniture.
 * null = refused (the request did not fit the rules).
 */
export type ItemsResult = FurnitureItem[] | null;

/** The shop as the client sees it (step 7). */
export interface ShopView {
  roomId: number;
  /** Filled slots (empty slots are not listed). */
  slots: ShopSlot[];
  /** The last 5 sale prices per material / furniture type id. */
  saleHistory: Record<string, number[]>;
  appeal: number;
  customers: Customer[];
}

/** What sold while the player was away (offline catch-up). */
export interface AwaySummary {
  /** How long the shop was simulated (at most 8 hours), ms. */
  simulatedMs: number;
  sales: SaleRecord[];
  total: number;
}

export interface BuyResult {
  /** The new item in the bag. */
  uid: number;
  /** True for the first catalog purchase of the game (it goes straight into placing). */
  first: boolean;
}

export interface GameAPI {
  /** The current player (gold, materials, rooms). */
  getPlayer(): Promise<Player>;
  /** The room the player was in last (a new player starts in the hotel room). */
  currentRoomId(): Promise<number>;
  /** Enter a room and get its full state. The own avatar stands in the door zone. */
  enterRoom(roomId: number): Promise<RoomState>;
  /** Ask to walk to a world point. Returns the path (world points, starting at the avatar) or null. */
  walk(to: Point): Promise<Point[] | null>;
  /**
   * Walk to an item with seats and sit or lie on it: the free seat nearest to `tap` (world px),
   * reached from its nearest reachable side. Null if no free seat can be reached.
   */
  sit(uid: number, tap?: Point): Promise<SitResult | null>;
  /** The current room's items and the inventory furniture (see ItemsResult). */
  getItems(): Promise<FurnitureItem[]>;
  /** Place an inventory item in the current room. */
  placeItem(uid: number, at: PlaceAt): Promise<ItemsResult>;
  /** Move a placed item (items standing on it come along). */
  moveItem(uid: number, at: PlaceAt): Promise<ItemsResult>;
  /** Turn a placed item to its next facing where it stands. */
  rotateItem(uid: number): Promise<ItemsResult>;
  /** Put a placed item (and what stands on it) back in the inventory. */
  pickUpItem(uid: number): Promise<ItemsResult>;
  getInventory(): Promise<Inventory>;
  /** Move a stack from one slot to another (they swap if both are full). Null = refused. */
  moveSlot(from: SlotRef, to: SlotRef): Promise<SlotLayout | null>;
  /** Move a hotbar stack to the first free bag slot. Null = the slot was empty. */
  hotbarToBag(index: number): Promise<SlotLayout | null>;
  /** Sort a bag tab (catalog order) or Stack it (merge equal items, close the gaps). */
  tidyBag(tab: BagTab, how: 'sort' | 'stack'): Promise<SlotLayout>;
  setLook(look: AvatarLook): Promise<AvatarLook>;
  /** Say something in the current room. Null if the text is empty. */
  chat(text: string): Promise<ChatLine | null>;
  /** Chat lines said in the current room (also your own). Returns an unsubscribe function. */
  onChat(listener: (line: ChatLine) => void): () => void;
  // ---------- Step 7: shop, catalog, rooms ----------
  /** The player's shop. */
  getShop(): Promise<ShopView>;
  /** Puts one unit from the bag on an empty slot with a price. Null = refused. */
  putOnShelf(slot: ShelfSlotRef, pick: StockPick, price: number): Promise<ShopView | null>;
  /** Takes the item on a slot back to the bag. */
  takeFromShelf(slot: ShelfSlotRef): Promise<ShopView | null>;
  setPrice(slot: ShelfSlotRef, price: number): Promise<ShopView | null>;
  /** Shop events (customers, reactions, sales at the till, slot changes). Returns an unsubscribe function. */
  onShop(listener: (e: ShopEvent) => void): () => void;
  /** Buys a catalog furniture item into the bag. Null = not in the catalog or not enough gold. */
  buyCatalog(typeId: string): Promise<BuyResult | null>;
  /** Buys a catalog style (unlocks it forever). False = refused. */
  buyStyle(kind: StyleKind, id: string): Promise<boolean>;
  /** Puts an unlocked style on one of the player's rooms (free). */
  applyStyle(roomId: number, kind: StyleKind, id: string): Promise<Room | null>;
  /** Upgrades a room one level (the items keep their places). Null = max level or not enough gold. */
  upgradeRoom(roomId: number): Promise<Room | null>;
  getRoom(roomId: number): Promise<Room | null>;
  /** The first-run hint to show now, or null when all are done. */
  currentHint(): Promise<string | null>;
  /** What sold while the player was away (once; null when nothing sold). */
  takeAwaySummary(): Promise<AwaySummary | null>;
  /** Debug (until the dungeon in step 9): a few random materials and maybe a furniture item. */
  debugGiveRandomLoot(): Promise<string>;
}
