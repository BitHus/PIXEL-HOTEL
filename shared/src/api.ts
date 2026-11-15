// The GameAPI interface. The client talks only to this.
// LocalGameAPI (steps 2-9) runs the shared rules in the browser; RemoteGameAPI (step 10) talks to the server.
// Methods are added in later steps as they are needed.

import type { BookTab } from './book.ts';
import type { BarId, CropId, FoodId, FurnitureItem, GearId, MaterialId, Player, Point, Facing, Rank, SaleRecord, SeedId, ShopSlot, StyleKind } from './types.ts';
import type { FishInput, FishSession } from './fishing.ts';
import type { ChopKind } from './woodcut.ts';
import type { RoomLevel } from './config.ts';
import type { Customer, ShopEvent } from './customers.ts';
import type { ShelfSlotRef, StockPick } from './shop.ts';
import type { NewPlayerChoice } from './newPlayer.ts';
import type { Avatar, AvatarLook } from './avatar.ts';
import type { Room } from './room.ts';
import type { ChatLine } from './gameState.ts';
import type { SeatSpot } from './seats.ts';
import type { BagLayout, BagTab, SlotLayout, SlotRef } from './bag.ts';
import type { DungeonInput, DungeonRun, RunBag, RunPlace } from './dungeon/run.ts';
import type { ShopGearId } from './gear.ts';
import type { GainList } from './gains.ts';
import type { BlockProblem } from './blocks.ts';

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

/** The walk to the spot behind the counter (step 7). */
export interface ServeResult {
  /** The path to the spot behind the counter (starts at the avatar). */
  path: Point[];
  /** The way the avatar faces once there (toward the customers). */
  facing: Facing;
}

/** What a Book reward gave (step BG4). `gains` is the gems as a gains list, for the popup. */
export interface BookClaim {
  gold: number;
  gems: number;
  gains: GainList;
}

export interface BuyResult {
  /** The new item in the bag. */
  uid: number;
  /** True for the first catalog purchase of the game (it goes straight into placing). */
  first: boolean;
  /** What the buy gave (step BG3). */
  gains: GainList;
}

/** The run in progress (step 9). `paused` after a reload until dungeonResume. */
export interface RunView {
  run: DungeonRun;
  paused: boolean;
}

/** How a run ended, after it was banked (step 9): for the death and leave screens. */
export interface RunResult {
  status: 'left' | 'dead';
  /** The crypt or (step 9c) the mine. */
  place: RunPlace;
  /** The mine: the visit ended because the lantern went out. */
  lanternOut: boolean;
  /** What came home (leaving, the boss, and half the bag's gold after death). */
  banked: RunBag;
  /** What died with the player or was left behind (full bag). */
  lost: RunBag;
  xpGained: number;
  levelBefore: number;
  levelAfter: number;
  /** The floor the run ended on. */
  floor: number;
  /** The enemy that dealt the last hit (death screen), or null. */
  lastHitBy: string | null;
}

/** The run after an input or a step; `result` is set once, when the run ended and was banked. */
export interface RunUpdate {
  run: DungeonRun;
  result: RunResult | null;
  /** What this call put in the run bag (chest, kill drop, mimic, rock), not what did not fit (step BG3). */
  gains: GainList;
}

/** The farm as the client sees it (step BG6): counts for the Map card. The plants themselves are in Room.plants. */
export interface FarmView {
  roomId: number;
  level: RoomLevel;
  /** Fully grown plants waiting to be punched. */
  ripe: number;
  growing: number;
  /** Soil cells with nothing planted. */
  free: number;
  at: number;
}

/** One tree as the client sees it (step 9f). */
export interface TreeView {
  hits: number;
  /** ms until a stump is a tree again, or null for a standing tree (worked out at `at`). */
  regrowInMs: number | null;
}

/** The lakeside's trees (step 9f). `at` is the API's clock when it was read. */
export interface LakesideView {
  roomId: number;
  trees: TreeView[];
  at: number;
}

/** One swing at a tree (step 9f). */
export interface ChopUpdate {
  kind: ChopKind;
  hits: number;
  /** What a felled tree gave. */
  loot?: Partial<Record<MaterialId, number>>;
  /** The same as loot, as a gains list (empty unless the tree fell; step BG3). */
  gains: GainList;
  lakeside: LakesideView;
}

/** Walking to a cast spot (step 9f): the path (starting at the avatar), the spot and where the bobber lands. */
export interface CastPlan {
  path: Point[];
  spot: Point;
  bobber: Point;
}

/** The fishing session after a call, and what it caught when it ended with a catch. */
export interface FishUpdate {
  session: FishSession;
  caught: { id: string; rank: Rank; cm: number | null; record: boolean } | null;
  /** What the catch put in the bag: the fish or the fished-up thing (empty without a catch; step BG3). */
  gains: GainList;
}

/**
 * What a block request did (step BG5). 'placed', 'cracked' and 'broken' carry the room with its new
 * block layer; 'walk' = the cell was out of reach, the avatar walks closer (the client asks again on
 * arrival); 'refused' says why (a 'cooldown' is not an error).
 */
export type BlockResult =
  | { kind: 'placed'; room: Room; c: number; r: number; gains: GainList }
  | { kind: 'cracked'; room: Room; c: number; r: number; hits: number; hardness: number; gains: GainList }
  | { kind: 'broken'; room: Room; c: number; r: number; gains: GainList }
  /** A seed went into a soil cell (step BG6). */
  | { kind: 'planted'; room: Room; c: number; r: number; gains: GainList }
  /** A grown plant was punched and harvested: `gains` has what grew, the seed back and gems. */
  | { kind: 'harvested'; room: Room; c: number; r: number; gains: GainList }
  /** A plant that is not fully grown was punched: nothing happens, leftMs says how long it still needs. */
  | { kind: 'unripe'; c: number; r: number; leftMs: number }
  | { kind: 'walk'; path: Point[] }
  | { kind: 'refused'; problem: BlockProblem };

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
  // ---------- Step 7b: a new player ----------
  /** True until the player made their character and picked the room shapes. */
  needsNewPlayer(): Promise<boolean>;
  /** Starts the game with the chosen name, look and room shapes. False = not allowed. */
  createPlayer(choice: NewPlayerChoice): Promise<boolean>;
  // ---------- Step 7: shop, catalog, rooms ----------
  /** The player's shop. */
  getShop(): Promise<ShopView>;
  /** Puts one unit from the bag on an empty slot with a price. Null = refused. */
  putOnShelf(slot: ShelfSlotRef, pick: StockPick, price: number): Promise<ShopView | null>;
  /** Takes the item on a slot back to the bag. */
  takeFromShelf(slot: ShelfSlotRef): Promise<ShopView | null>;
  setPrice(slot: ShelfSlotRef, price: number): Promise<ShopView | null>;
  /** Walk behind the shop's counter; while the avatar stands there, waiting customers pay. Null = no way there. */
  serve(uid: number): Promise<ServeResult | null>;
  /** Shop events (customers, reactions, sales at the till, slot changes). Returns an unsubscribe function. */
  onShop(listener: (e: ShopEvent) => void): () => void;
  /** Buys a catalog furniture item into the bag. Null = not in the catalog or not enough gold. */
  buyCatalog(typeId: string): Promise<BuyResult | null>;
  /** Buys a catalog style (unlocks it forever). False = refused. */
  buyStyle(kind: StyleKind, id: string): Promise<boolean>;
  /** Puts an unlocked style on one of the player's rooms (free). */
  applyStyle(roomId: number, kind: StyleKind, id: string): Promise<Room | null>;
  /** Paints the floor cells of a rectangle of cells (corners inclusive) with an unlocked floor style (free; step BG1). */
  paintFloor(roomId: number, from: { c: number; r: number }, to: { c: number; r: number }, id: string): Promise<Room | null>;
  /**
   * Puts a block from the bag into a cell of the current room (step BG5). Only the room's owner;
   * a cell beyond BLOCK_REACH answers 'walk' with the path to a spot near it.
   */
  placeBlock(c: number, r: number, blockId: string): Promise<BlockResult>;
  /** One punch at the block in a cell (cooldown BLOCK_HIT_COOLDOWN_MS; the last hit breaks it). */
  hitBlock(c: number, r: number): Promise<BlockResult>;
  /** Buys blocks from the Catalog into the bag. Null = not sold or not enough gold. */
  buyBlocks(blockId: string, qty: number): Promise<GainList | null>;
  /** Upgrades a room one level (the items keep their places). Null = max level or not enough gold. */
  upgradeRoom(roomId: number): Promise<Room | null>;
  getRoom(roomId: number): Promise<Room | null>;
  /** The first-run hint to show now, or null when all are done. */
  currentHint(): Promise<string | null>;
  /**
   * Gains the calls did not return themselves (step BG4: the gems a finished quest pays). Returns them once and
   * forgets them: the client calls it after every action that may finish a quest and shows the popups.
   */
  takeGains(): Promise<GainList>;
  // ---------- Step 9: the dungeon, crafting, the Blacksmith ----------
  /** The run in progress, or null. */
  getRun(): Promise<RunView | null>;
  /** Starts a run: pays the 10 gold key (free under 10 gold) and packs the lunch box (at most 3
   *  food items from the bag, step 9b). Null if a run is already going. */
  dungeonStart(lunch?: readonly FoodId[]): Promise<DungeonRun | null>;
  /** One player input (applied at once, at the exact run time). Null without a running run. */
  dungeonInput(input: DungeonInput): Promise<RunUpdate | null>;
  /**
   * Moves the run on by dtMs (fixed 100 ms ticks inside; the rest is kept for the next call, so no
   * tick is ever skipped). A paused run does not move. Null without a run.
   */
  dungeonAdvance(dtMs: number): Promise<RunUpdate | null>;
  /** Pauses the run (the tab was hidden); dungeonResume goes on. */
  dungeonPause(): Promise<void>;
  dungeonResume(): Promise<void>;
  /** Crafts a recipe (shared/data/recipes.json). Null without all ingredients; else what it made (a style recipe: empty list). */
  craft(recipeId: string): Promise<GainList | null>;
  /** Buys gear or a potion in the Blacksmith. Null if owned, at the potion limit, or gold is short. */
  buyGear(id: ShopGearId): Promise<GainList | null>;
  // ---------- Step 9b: the farm and cooking ----------
  /** Counts for the Map card (ripe, growing, free soil). */
  getFarm(): Promise<FarmView>;
  /** Plants one seed from the bag in a soil cell within BLOCK_REACH ('walk' when farther; 'refused' says why: no_soil, taken...). */
  plantSeed(c: number, r: number, seed: SeedId): Promise<BlockResult>;
  /** One punch at the plant in a cell (cooldown BLOCK_HIT_COOLDOWN_MS): a grown plant is harvested, an unripe one answers 'unripe' and is left alone. */
  hitPlant(c: number, r: number): Promise<BlockResult>;
  /** Buys seeds from the catalog. Null = not for sale or not enough gold. */
  buySeeds(seed: SeedId, qty: number): Promise<GainList | null>;
  /** Cooks one food at the pot. Null without all ingredients. */
  cook(food: FoodId): Promise<GainList | null>;
  // ---------- Step 9f: the lakeside (woodcutting and fishing) ----------
  getLakeside(): Promise<LakesideView>;
  /** One swing at a tree (the avatar must stand next to it, else null). 'cooldown' and 'regrowing' change nothing. */
  chopTree(index: number): Promise<ChopUpdate | null>;
  /** Walks to the shore or pier spot nearest to a tapped water point and returns the plan (null = no way). */
  castAt(target: Point): Promise<CastPlan | null>;
  /** Casts the line (rolls the catch with the player's rod). Null if not on the lakeside; a running session is kept. */
  fishStart(): Promise<FishSession | null>;
  /** Moves the session on: the inputs first, then dtMs (100 ms ticks). A catch is banked at once. Null without a session. */
  fishStep(inputs: readonly FishInput[], dtMs: number): Promise<FishUpdate | null>;
  /** Stops fishing without a result (the player walked away). */
  fishStop(): Promise<void>;
  // ---------- Step 9e: the collection book (what was found is Player.seen) ----------
  /** The Book was opened: nothing is "New!" any more. */
  bookOpened(): Promise<void>;
  /** Takes a Book reward that is ready: the gold and the gems (step BG4), or null if it is not ready. */
  claimBookReward(tab: BookTab, percent: number): Promise<BookClaim | null>;
  // ---------- Step 9c: the mine and the forge ----------
  /** Starts a mine visit (free; from player level 3). Null if locked or a run is already going.
   *  The visit runs through getRun / dungeonInput / dungeonAdvance like a dungeon run. */
  mineStart(): Promise<DungeonRun | null>;
  /** Smelts one bar (3 ore + the fee). Null without the ore or the gold. */
  smelt(bar: BarId): Promise<GainList | null>;
  /** Makes the next gear piece at the forge (it replaces the one before). Null if it cannot. */
  forge(piece: GearId): Promise<GainList | null>;
}
