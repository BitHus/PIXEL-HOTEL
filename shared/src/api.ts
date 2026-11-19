// The GameAPI interface. The client talks only to this.
// LocalGameAPI (steps 2-9) runs the shared rules in the browser; RemoteGameAPI (step 10) talks to the server.
// Methods are added in later steps as they are needed.

import type { QuestBoard } from './questBoard.ts';
import type { SkillsView } from './skills.ts';
import type { BookTab } from './book.ts';
import type { BarId, CropId, DrinkId, DrinkTier, FoodId, FurnitureItem, GearId, MaterialId, Player, Point, Facing, Rank, SeedId, StyleKind } from './types.ts';
import type { FishInput, FishSession } from './fishing.ts';
import type { ChopKind } from './woodcut.ts';
import type { RoomLevel } from './config.ts';
import type { NewPlayerChoice } from './newPlayer.ts';
import type { Avatar, AvatarLook } from './avatar.ts';
import type { Room } from './room.ts';
import type { ActiveEmote } from './emotes.ts';
import type { UseResult } from './itemUse.ts';
import type { ChatLine } from './gameState.ts';
import type { SeatSpot } from './seats.ts';
import type { BagLayout, BagTab, SlotLayout, SlotRef } from './bag.ts';
import type { DungeonInput, DungeonRun, RunBag, RunPlace } from './dungeon/run.ts';
import type { ShopGearId } from './gear.ts';
import type { GainList } from './gains.ts';
import type { PackFind } from './packs.ts';
import type { BlockProblem } from './blocks.ts';
import type { Guest, Mess } from './tavern.ts';
import type { Brew } from './brewing.ts';
import type { Cook } from './cooking.ts';
import type { Cask, CaskView } from './casks.ts';
import type { Tap } from './taps.ts';
import type { TavernEvent } from './guests.ts';
import type { TrayMug } from './tray.ts';
import type { SplicePreview } from './splice.ts';

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

/** The tavern as the client sees it (step 9t). */
export interface TavernView {
  roomId: number;
  /** CEL-2: the tavern plus its attached cellar room (where machines work); the tavern is first. */
  workRooms: number[];
  /** The cellar room, when it is built. */
  cellarRoomId?: number;
  guests: Guest[];
  /** Coins and dishes left on table spots. */
  mess: Mess[];
  /** The guests whose orders the player will carry next, in order. */
  serveQueue: number[];
  /** COD-1: the waiter's tray (poured mugs and dishes, at most TRAY_MAX). */
  tray: TrayMug[];
  /** What brews in the barrels (barrel uid, drink, the time it is ready). */
  brews: Brew[];
  /** What cooks on the stoves (stove uid, dish, how many, the time it is ready; step K1). */
  cooks: Cook[];
  /** The drinks on the taps (stand uid, slot, drink, mugs; step T1). */
  taps: Tap[];
  /** The casks ripening on the keg racks (rack uid, slot, drink, mugs, start; step K2). */
  casks: Cask[];
  /** CEL-5: the highest tier of each keg rack (rack uid -> vintage or reserve; reserve only in a cellar of level 2 or more). */
  caskCaps: Record<number, 'vintage' | 'reserve'>;
  /** The tavern's appeal 0..100 (placed items, decor too, plus the styles; it sets how fast guests come). */
  appeal: number;
  /** The API's clock when this was read (to count down a brew). */
  at: number;
  /** False in an old save until markTavernIntroSeen (the one-time toast that explains the tavern). */
  introSeen: boolean;
  /** OA-14: the OPEN sign (false = closed: no new guests). */
  open: boolean;
}

/** One row of the Menu panel: a drink or dish the player owns or has set, with its menu choice and the last prices paid. */
export interface MenuRowView {
  id: MaterialId;
  on: boolean;
  price: number;
  baseValue: number;
  stock: number;
  /** The last prices guests paid (oldest first, at most MENU_HISTORY_LENGTH). */
  history: number[];
}

/**
 * What the tavern tells the client: the guests' events (tavern.ts TavernEvent) and what the own
 * avatar does while serving. The client animates paths and draws; it decides nothing.
 */
export type TavernClientEvent =
  | TavernEvent
  /** The own avatar walks this path (to the bar, to a table). Starts at the avatar. */
  | { t: 'walk'; path: Point[] }
  /** COD-1: the tray changed (first mug = the one drawn in the hand; empty = hands free). */
  | { t: 'tray'; mugs: TrayMug[] }
  /** COD-1: the pour wait at the taps was dropped (the player went to serve a guest instead). */
  | { t: 'pour_cancel' }
  /** G2: the avatar stands at the taps and waits for the player to hold the pour (pourHeld). */
  | { t: 'pour_ready'; guestId: number; item: MaterialId; standUid: number }
  /** G2: the pour was released: the grade of the fill (a perfect one pays a tip on delivery). */
  | { t: 'poured'; grade: 'under' | 'perfect' | 'over' }
  /** The order was put on the guest's table spot. */
  | { t: 'served'; guestId: number; item: MaterialId; spot: Point }
  /** The player took the coins (and a tipped gem) of a table spot (`gains` = the gold and the gems, for the popup). */
  | { t: 'collected'; messId: number; coins: number; spot: Point; gains: GainList }
  /** The player cleared an empty mug or plate. */
  | { t: 'cleared'; messId: number; spot: Point }
  /** The serve queue changed (a tap was added or used). */
  | { t: 'queue'; queue: number[] }
  /** The avatar stands at the taps and pours one mug (step T1): `ms` long (POUR_MS), at the stand `standUid`; the clink and the pour animation. */
  | { t: 'pour'; guestId: number; item: MaterialId; standUid: number; ms: number }
  /** The tap holding the drink was empty when the avatar came to pour: the order stays open (step T1). */
  | { t: 'tap_empty'; guestId: number; item: MaterialId };

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

/** A pack that was opened (step BG8): what each roll gave (for the pop animation and the toasts) and the gains list for the popups. */
export interface PackOpenResult {
  packId: string;
  finds: PackFind[];
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
  | { kind: 'harvested'; room: Room; c: number; r: number; gains: GainList; /** Step BG7: a clothing piece this harvest unlocked (id). */ clothing?: string; /** Step BG7: a splice recipe found by this harvest (pair key). */ recipe?: string }
  /** A second seed went into a planted cell (step BG7): it now grows the pair's new seed. */
  | { kind: 'spliced'; room: Room; c: number; r: number; gains: GainList }
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
  /**
   * Step through an Inn door of the current room (step MB-2: suite - tavern - garden). The own avatar arrives on the matching door spot of the
   * other room and steps one cell down. Null = refused (no such door here, a dungeon or mine run is going, or the other room is missing).
   */
  useDoor(doorId: string): Promise<RoomState | null>;
  /** Ask to walk to a world point. Returns the path (world points, starting at the avatar) or null. */
  walk(to: Point): Promise<Point[] | null>;
  /** OWN-4: the client stopped the avatar where it stands (a pan cancelled the walk): the API forgets the old goal and stands there too, so the next walk starts from the same spot. */
  stopWalk(at: Point): Promise<void>;
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
  // ---------- Step 7: catalog, rooms ----------
  /** Walk behind the bar (the staff spot, where orders are carried from). Null = no way there. */
  serve(uid: number): Promise<ServeResult | null>;
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
  /** CEL-4: builds the cellar (player level CELLAR_UNLOCK_LEVEL, CELLAR_BUILD_COST gold, one free keg rack). Null when it cannot be built. */
  buildCellar(): Promise<Room | null>;
  getRoom(roomId: number): Promise<Room | null>;
  /** The first-run hint to show now, or null when all are done. */
  currentHint(): Promise<string | null>;
  /** Tutorial stove step: gives 2 turnips when nothing can be cooked (ledger 'start'). True = given. */
  ensureTutorialCookSupplies(): Promise<boolean>;
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
  // ---------- Step 9t: the tavern ----------
  /** The tavern's guests, table spots and the serve queue. */
  getTavern(): Promise<TavernView>;
  /** Tavern events (guests, orders, coins, the own avatar's serving walk). Returns an unsubscribe function. */
  onTavern(listener: (e: TavernClientEvent) => void): () => void;
  /**
   * The player tapped a guest with an open order (or the order bubble): the order joins the serve
   * queue (at most SERVE_QUEUE_MAX) and the avatar goes to the bar, picks it up, and puts it on the
   * guest's table, one tap. False = refused (no open order, queue full, not in the tavern, no way).
   */
  serveGuest(guestId: number): Promise<boolean>;
  /** G2: the avatar waits at the taps (event 'pour_ready'); the player held the pour for heldMs (capped) on the tap `pick` (default: the first tap holding the drink). Takes the mug; false = nothing to pour. */
  pourHeld(heldMs: number, pick?: { standUid: number; slot: number }): Promise<boolean>;
  /** COD-1: the player taps a guest who waits for something on the tray: the avatar carries exactly ONE matching mug to their table (a dish goes by itself). False = no matching mug or no way. */
  carryHeld(guestId: number): Promise<boolean>;
  /** COD-1: puts every mug of the tray back in the bag. False = the tray was empty. */
  returnTray(): Promise<boolean>;
  /** TF-5 GRAB ALL: queues one pour per open order of the most urgent item (up to the free tray slots); the avatar pours them back to back (each pour is still a hold). False = nothing to queue. */
  grabAll(): Promise<boolean>;
  /** TF-5 SERVE ALL: one tour with the tray: bar guests first (hand-over, nearest first), then the tables by distance (shared serveRoute). False = nothing on the tray matches an open order. */
  serveAll(): Promise<boolean>;
  /** TF-5: the avatar steps to the staff side of the bar and hands ONE mug of the tray to a BAR guest (same as carryHeld for a table guest). False = no matching mug, not a bar guest, or no way. */
  handOver(guestId: number): Promise<boolean>;
  /** Walks to a table spot and takes its coins (`what` 'coins') or clears its empty mug or plate ('dish'). False = refused. */
  tidyTable(messId: number, what: 'coins' | 'dish'): Promise<boolean>;
  /** Collects the mugs of a ready brew from a barrel in the tavern. Null if it is not ready. */
  collectBrew(barrelUid: number): Promise<{ drink: MaterialId; mugs: number; gains: GainList } | null>;
  /** Every slot of every keg rack in the tavern (step K2): the drink, mugs, the tier now and the time to the next tier (read against the API's clock). */
  getCasks(): Promise<CaskView[]>;
  /** Puts qty fresh mugs (1 to one brew's mugs) of a brewed drink from the bag into a free cask slot; it ripens in real time. False = refused. */
  fillCask(rackUid: number, slot: number, drink: DrinkId, qty: number): Promise<boolean>;
  /** Takes the mugs out at their CURRENT tier (fresh when too early); the slot is free again. Null = refused. */
  collectCask(rackUid: number, slot: number): Promise<{ item: MaterialId; mugs: number; tier: 'fresh' | DrinkTier; gains: GainList } | null>;
  /**
   * Starts a brew in an empty barrel that stands in the tavern: the crops leave the bag (ledger 'brew') and the drink
   * brews in real time, also while the game is closed. False = refused (not in the tavern, not a free barrel, not a
   * drink, crops short; nothing is taken).
   */
  startBrew(barrelUid: number, drink: DrinkId): Promise<boolean>;
  /** The Menu panel's rows: every drink and dish the player owns or has set (on or off, price, stock, last prices). */
  getMenu(): Promise<MenuRowView[]>;
  /** Puts a drink or dish on or off the menu and / or sets its price (whole gold). The new rows, or null = refused. */
  /** OA-14: flips the OPEN / CLOSED sign of the tavern (closed = no new guests, the ones inside finish). Returns the new state (true = open). */
  setTavernOpen(open: boolean): Promise<boolean>;
  setMenuEntry(id: string, change: { on?: boolean; price?: number }): Promise<MenuRowView[] | null>;
  /** Step T1: moves qty mugs of one drink from the bag onto a tap (a whole number from 1; the tap holds at most TAP_CAP of ONE drink). False = refused. */
  loadTap(standUid: number, slot: number, drink: DrinkId, qty: number): Promise<boolean>;
  /** Step T1: gives mugs back to the bag (qty, or 'all'). False = refused (an empty tap, too many). */
  unloadTap(standUid: number, slot: number, qty: number | 'all'): Promise<boolean>;
  /** The intro toast of the tavern was shown: it never shows again (also after a reload). */
  markTavernIntroSeen(): Promise<void>;
  // ---------- Step 9b: the farm and cooking ----------
  /** Counts for the Map card (ripe, growing, free soil). */
  getFarm(): Promise<FarmView>;
  /** Plants one seed from the bag in a soil cell within BLOCK_REACH ('walk' when farther; 'refused' says why: no_soil, taken...). */
  plantSeed(c: number, r: number, seed: SeedId): Promise<BlockResult>;
  /** One punch at the plant in a cell (cooldown BLOCK_HIT_COOLDOWN_MS): a grown plant is harvested, an unripe one answers 'unripe' and is left alone. */
  hitPlant(c: number, r: number): Promise<BlockResult>;
  /**
   * Uses a second seed on a planted cell (step BG7). 'spliced' = the cell now grows the new seed; refused with
   * 'nothing_happens' (pair not in the table or the same seed twice: nothing is taken), 'already_spliced',
   * 'ripe' (harvest it first) or 'no_plant'. Out of reach: the avatar walks closer first.
   */
  spliceSeed(c: number, r: number, seed: SeedId): Promise<BlockResult>;
  /** SG5: what splicing `seed` into the plant in this cell would do; changes nothing. A new mix hides its result (status 'new'), a found pair shows it ('known'). */
  previewSplice(c: number, r: number, seed: SeedId): Promise<SplicePreview>;
  // ---------- Step BG8: packs bought with gems ----------
  /** Opens a pack for gems. Null = unknown pack or not enough gems (nothing changes). */
  openPack(packId: string): Promise<PackOpenResult | null>;
  /** Buys a catalog hat for gold (step 9g-1, baseValue * 3) and unlocks it. Null = not sold, already owned or not enough gold. */
  buyHat(hatId: string): Promise<boolean>;
  /**
   * Plays an emote (step 9g-1): { kind, untilMs } (the game clock). Transient, never saved. Null = unknown kind or the avatar is not standing still.
   * Walking or sitting ends it: `currentEmote()` then gives null.
   */
  emote(kind: string): Promise<ActiveEmote | null>;
  /**
   * A tap on a usable placed piece (step 9g-2): toggles a lamp or fire (saved), plays a tune, tells the time, asks for the mirror's Avatar panel,
   * adopts the cat at the pet basket, or plays a pastime. Returns what happened (the client shows `text`), null = nothing to use. Never changes gold or items.
   */
  useItem(uid: number): Promise<UseResult | null>;
  /** Renames the adopted cat (letters, digits, spaces, at most PET_NAME_MAX). False = no cat or a bad name. */
  renamePet(name: string): Promise<boolean>;
  /** The emote playing now, or null. */
  currentEmote(): Promise<ActiveEmote | null>;
  /** Buys seeds from the catalog. Null = not for sale or not enough gold. */
  buySeeds(seed: SeedId, qty: number): Promise<GainList | null>;
  /**
   * Starts a batch on an empty stove in the tavern (step K1): `qty` dishes (1 to STOVE_BATCH_MAX) of one recipe; the
   * crops leave the bag and the batch cooks in real time, also while the game is closed. False = refused (not a free
   * stove in the tavern, unknown recipe, bad count, crops short).
   */
  startCook(stoveUid: number, food: FoodId, qty: number): Promise<boolean>;
  /** Collects the dishes of a ready batch from a stove (nothing is collected by itself). Null if it is not ready. */
  collectCook(stoveUid: number): Promise<{ food: FoodId; qty: number; gains: GainList } | null>;
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
  // ---------- SK-1: the skill tree v2 (shared/src/skills.ts; one linked graph, a separate point pool) ----------
  /** The tree with the player's ranks, the points (earned, spent, free) and why a node is locked. */
  getSkills(): Promise<SkillsView>;
  /** Buys one rank of a node (null when it cannot: unknown, maxed, locked, too few points). */
  buySkill(id: string): Promise<SkillsView | null>;
  /** Takes one rank of a leaf back: free when it was bought since the Skills panel opened (getSkills), else 10 gold x its ring (ledger 'respec'). Null when refused. */
  unlearnSkill(id: string): Promise<SkillsView | null>;
  /** Takes every rank back: the migration's free reset, then 3 free, then 25 gold x level (ledger 'respec'). Null without ranks or gold. */
  respecSkills(): Promise<SkillsView | null>;
  // ---------- TUT-2 part 3: daily quests, event quests, achievements (shared/src/questBoard.ts) ----------
  /** The quest board for the local day (tzOffsetMin = Date.getTimezoneOffset()). */
  getQuestBoard(tzOffsetMin: number): Promise<QuestBoard>;
  /** Takes the gold of one ready quest row (QuestRow.claimId). Null = not ready or taken already. */
  claimQuest(claimId: string, tzOffsetMin: number): Promise<{ gold: number } | null>;
  // ---------- Step 9c: the mine and the forge ----------
  /** Starts a mine visit (free; from player level 3). Null if locked or a run is already going.
   *  The visit runs through getRun / dungeonInput / dungeonAdvance like a dungeon run. */
  mineStart(): Promise<DungeonRun | null>;
  /** Smelts one bar (3 ore + the fee). Null without the ore or the gold. */
  smelt(bar: BarId): Promise<GainList | null>;
  /** Makes the next gear piece at the forge (it replaces the one before). Null if it cannot. */
  forge(piece: GearId): Promise<GainList | null>;
}
