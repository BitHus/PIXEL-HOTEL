// The GameAPI interface. The client talks only to this.
// LocalGameAPI (steps 2-9) runs the shared rules in the browser; RemoteGameAPI (step 10) talks to the server.
// Methods are added in later steps as they are needed.

import type { FurnitureItem, MaterialId, Player, Point, Facing } from './types.ts';
import type { Avatar, AvatarLook } from './avatar.ts';
import type { Room } from './room.ts';
import type { ChatLine } from './gameState.ts';
import type { Pose } from './furniture.ts';
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
  /** Path to the front of the seat (starts at the avatar). */
  path: Point[];
  /** Where the avatar sits on arrival. */
  seat: Pose;
}

/**
 * Item results are the player's items in the current room plus the inventory furniture.
 * null = refused (the request did not fit the rules).
 */
export type ItemsResult = FurnitureItem[] | null;

export interface GameAPI {
  /** The current player (gold, materials, rooms). */
  getPlayer(): Promise<Player>;
  /** The room the player was in last (a new player starts in the hotel room). */
  currentRoomId(): Promise<number>;
  /** Enter a room and get its full state. The own avatar stands in the door zone. */
  enterRoom(roomId: number): Promise<RoomState>;
  /** Ask to walk to a world point. Returns the path (world points, starting at the avatar) or null. */
  walk(to: Point): Promise<Point[] | null>;
  /** Walk to the front of a sittable item and sit. Null if it cannot be reached. */
  sit(uid: number): Promise<SitResult | null>;
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
  /** Debug (until the catalog in step 7): one of each home furniture type into the inventory. */
  debugGiveTestFurniture(): Promise<void>;
}
