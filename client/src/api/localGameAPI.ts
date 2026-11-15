// LocalGameAPI (steps 2-9): runs the shared rules in the browser and saves the whole game state
// through a SaveStorage (localStorage) under a versioned key after every change. It also keeps
// one automatic backup: the save as it was when the game was opened (or before an import).
// Local-only save tools (export, import, restore backup, new game) are in LocalSaves.
// Step 7: the shop runs here too. update() (main.ts calls it every SHOP_TICK_MS through
// startClock) steps the walking customers in SHOP_TICK_MS steps with the shared rules; a gap
// longer than SHOP_CATCH_UP_GAP_MS (and every time the game opens) is caught up with maths only
// (catchUpShop, step 9d: nothing is sold; the customers who would have come wait in the line, at
// most QUEUE_MAX, at their queue spots).

import {
  AVATAR_START_FROM_BOTTOM,
  gain,
  gainsFromRunEvents,
  completeQuest,
  GEMS_GAIN_ID,
  mergeGains,
  type BookClaim,
  gainsSince,
  type GainList,
  DUNGEON_HINT,
  HINTS,
  RECIPES,
  RUN_SAVE_EVERY_MS,
  FARM_HINT,
  forgePiece,
  smelt,
  startMine,
  type BarId,
  type GearId,
  MINE_HINT,
  MINE_UNLOCK_LEVEL,
  buySeeds,
  openPack,
  sellSpare,
  type PackOpenResult,
  buyBlocks,
  approachSpot,
  blockRects,
  placeBlock,
  hitBlock,
  type BlockResult,
  cook,
  claimBookReward,
  openBook,
  CHOP_REACH_PX,
  bankCatch,
  chop,
  fishDone,
  fishStep,
  growTrees,
  isStump,
  nearestCastSpot,
  bobberPoint,
  newFishSession,
  regrowInMs,
  treeAnchor,
  type CastPlan,
  type ChopUpdate,
  type FishInput,
  type FishSession,
  type FishUpdate,
  type LakesideView,
  type BookTab,
  hitPlant,
  inReach,
  plantSeed,
  SPLICE_HINT,
  PACK_HINT,
  spliceSeed,
  farmCounts,
  roomBlockers,
  type FarmView,
  type FoodId,
  type RoomLevel,
  type SeedId,
  buyGear,
  craft as craftRecipe,
  finishRun,
  startRun,
  step,
  type DungeonInput,
  type DungeonRun,
  type RunResult,
  type RunUpdate,
  type RunView,
  type ShopGearId,
  PALETTE,
  SHOP_CATCH_UP_GAP_MS,
  NAV_CELL,
  SHOP_TICK_MS,
  applyStyle,
  paintFloor,
  buyCatalog,
  canPickUp,
  catchUpShop,
  catchUpTavern,
  stepTavern,
  repathGuests,
  deliverOrder,
  requestServe,
  pickUpOrder,
  serveStops,
  cancelServe,
  collectCoins,
  clearDish,
  collectBrew,
  returnOrphanBrews,
  openOrders,
  GOLD_GAIN_ID,
  GUEST_SERVE_REACH_PX,
  type MaterialId,
  type TavernClientEvent,
  type TavernEvent,
  type TavernView,
  type TavernWorld,
  putOnShelf,
  repathCustomers,
  returnOrphanLoot,
  rngInt,
  setPrice,
  shopAppeal,
  stepShop,
  takeFromShelf,
  unlockStyle,
  upgradeRoom,
  validPrice,
  type BuyResult,
  type ShelfSlotRef,
  type ShopEvent,
  type ShopView,
  type ShopWorld,
  type StockPick,
  type StyleKind,
  type Rng,
  doorX,
  doorY,
  type NewPlayerChoice,
  configForChoice,
  lookAllowed,
  type ServeResult,
  type Facing,
  APPROACH_REACH_PX,
  behindPoint,
  SAVE_BACKUP_KEY,
  SAVE_VERSION,
  applyChange,
  buildNavGrid,
  cleanChatText,
  confirmPlacing,
  createNewPlayer,
  findPath,
  getFurnitureType,
  itemBlockers,
  pickUpItem,
  readSave,
  rotateInPlace,
  saveKey,
  onSeat,
  planSit,
  standUpSpot,
  arrangeState,
  hotbarToBag,
  moveSlot,
  sortBag,
  stackBag,
  startMovePlacing,
  startNewPlacing,
  toSaveText,
  walkAvatar,
  type Avatar,
  type AvatarLook,
  type BagTab,
  type SlotLayout,
  type SlotRef,
  type ChatLine,
  type FurnitureItem,
  type GameAPI,
  type GameState,
  type Inventory,
  type ItemsResult,
  type NavGrid,
  type PlaceAt,
  type PlacingSession,
  type Player,
  type Point,
  type SeatSpot,
  type Rect,
  type Room,
  type RoomState,
  type SaveProblem,
  type SitResult,
} from '@pixel-hotel/shared';
import type { SaveStorage } from './saveStorage.ts';

export type SaveResult = { ok: true } | { ok: false; message: string };

/** Save tools that only exist for a local game (the settings panel uses them). */
export interface LocalSaves {
  /** The save as text, for a downloaded file. */
  exportSave(): string;
  /** Checks the version, then loads the save (the current one becomes the backup). */
  importSave(text: string): SaveResult;
  hasBackup(): boolean;
  /** Swaps the current save and the backup. */
  restoreBackup(): SaveResult;
  /** Starts over (the current save becomes the backup). */
  newGame(): void;
}

export function problemMessage(problem: SaveProblem): string {
  switch (problem) {
    case 'bad_json':
    case 'not_a_save':
      return 'That is not a Pixel Hotel save file.';
    case 'too_new':
      return 'That save is from a newer version of the game.';
    case 'too_old':
      return 'That save is from an old version that cannot be updated.';
    case 'invalid':
      return 'That save file is damaged.';
  }
}

/** The own avatar's walk, tracked by time: where it was at `at` and what was left to walk. */
interface WalkState {
  avatar: Avatar;
  path: Point[];
  at: number;
  /** Sits (or lies) on this seat when the path ends. */
  sitOn: { uid: number; seat: SeatSpot } | null;
  /** Walking to the spot behind the counter (step 7): the counter's uid and where it stood. */
  serveAt?: { uid: number; x: number; y: number; facing: Facing } | null;
  /** Standing behind the counter, taking payments: the counter's uid and where it stood. */
  serving?: { uid: number; x: number; y: number; facing: Facing } | null;
  /** The item and seat index the avatar is sitting or lying on. */
  seated: { uid: number; index: number } | null;
  /** Step 9t: what this walk is for while serving or tidying a table (a new walk of any other kind drops it). */
  task?: TavernTask | undefined;
}

/** The player's tavern errand: to the bar for an order, to the guest's table with it, or to a table spot to tidy it. */
export type TavernTask =
  | { stage: 'bar' }
  | { stage: 'table'; guestId: number }
  | { stage: 'mess'; messId: number; what: 'coins' | 'dish' };

export class LocalGameAPI implements GameAPI, LocalSaves {
  private state: GameState;
  private walkState: WalkState;
  private grid: NavGrid;
  private debugRects: Rect[] = [];
  private chatId = 0;
  private readonly chatListeners = new Set<(line: ChatLine) => void>();
  private readonly shopListeners = new Set<(e: ShopEvent) => void>();
  private readonly tavernListeners = new Set<(e: TavernClientEvent) => void>();
  /** True while the own avatar is on a tavern errand (walkState.task); a walk of any other kind ends it. */
  private errand = false;
  /** The shop room's navigation grid (customers), rebuilt when its furniture changes. */
  private shopGrid: NavGrid | null = null;
  private clock = 0;
  /** A run loaded from a save waits for dungeonResume (the player taps Resume). */
  private runPaused: boolean;
  /** Run time of the last run save. */
  private runSavedAt = 0;

  private constructor(
    private readonly storage: SaveStorage,
    private readonly now: () => number,
    state: GameState,
    private readonly rng: Rng,
  ) {
    this.state = arrangeState(state);
    this.runPaused = this.state.run !== null;
    this.runSavedAt = this.state.run?.timeMs ?? 0;
    this.walkState = this.doorWalk();
    this.grid = this.buildGrid();
    // Customers do not walk while the game is closed: catch up with maths only.
    this.catchUp();
  }

  /**
   * Opens the saved game (or a new one). `notice` is a message for the player when the save was
   * migrated, damaged or too old.
   */
  static open(
    storage: SaveStorage,
    now: () => number = Date.now,
    rng: Rng = Math.random,
  ): { api: LocalGameAPI; notice: string | null } {
    const start = (state: GameState, notice: string | null): { api: LocalGameAPI; notice: string | null } => {
      const api = new LocalGameAPI(storage, now, state, rng);
      api.save();
      return { api, notice };
    };
    const raw = storage.get(saveKey());
    if (raw !== null) {
      const r = readSave(raw);
      if (r.ok) {
        storage.set(SAVE_BACKUP_KEY, raw);
        return start(r.state, null);
      }
      storage.set(`${saveKey()}.damaged`, raw);
      const backup = storage.get(SAVE_BACKUP_KEY);
      const b = backup !== null ? readSave(backup) : null;
      if (b?.ok) return start(b.state, 'Your save could not be read, so the automatic backup was loaded.');
      return start(createNewPlayer(undefined, now()), 'Your save could not be read. A new game was started.');
    }
    // An older save under an older versioned key: migrate it, or reset with a message.
    for (let v = SAVE_VERSION - 1; v >= 1; v--) {
      const old = storage.get(saveKey(v));
      if (old === null) continue;
      storage.set(SAVE_BACKUP_KEY, old);
      const r = readSave(old);
      if (r.ok) {
        const back = r.returnedToBag;
        const extra = back > 0 ? ` ${back} ${back === 1 ? 'item' : 'items'} did not fit the new building grid and went back to your bag.` : '';
        const farm = r.farmChanged
          ? ' The farm is free-form now: your old plots are soil cells. Select a seed and tap soil to plant, punch a grown plant to harvest it.'
          : '';
        return start(r.state, `Your save was updated to the new version of the game.${extra}${farm}`);
      }
      return start(
        createNewPlayer(undefined, now()),
        'Your save is from an old version that cannot be updated. A new game was started (the old save is kept as the backup).',
      );
    }
    return start(createNewPlayer(undefined, now()), null);
  }

  async needsNewPlayer(): Promise<boolean> {
    return !this.state.playerCreated;
  }

  async createPlayer(choice: NewPlayerChoice): Promise<boolean> {
    if (this.state.playerCreated) return false;
    const config = configForChoice(choice);
    if (!config) return false;
    this.commit({ ...createNewPlayer(config, this.now()), playerCreated: true });
    this.walkState = this.doorWalk();
    this.grid = this.buildGrid();
    this.shopGrid = null;
    return true;
  }

  /** A copy of the whole state (tests, debugging). */
  snapshot(): GameState {
    return structuredClone(this.state);
  }

  // ---------- GameAPI ----------

  async getPlayer(): Promise<Player> {
    return structuredClone(this.state.player);
  }

  async currentRoomId(): Promise<number> {
    return this.state.currentRoomId;
  }

  async enterRoom(roomId: number): Promise<RoomState> {
    const room = this.state.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error(`no room ${roomId}`);
    if (this.state.currentRoomId !== roomId) this.commit({ ...this.state, currentRoomId: roomId });
    this.debugRects = [];
    this.fish = null;
    this.walkState = this.doorWalk();
    this.grid = this.buildGrid();
    return {
      room: { ...room },
      items: this.state.items.filter((i) => i.roomId === roomId).map((i) => ({ ...i })),
      avatars: [{ ...this.walkState.avatar }],
    };
  }

  async walk(to: Point): Promise<Point[] | null> {
    if (!finitePoint(to)) return null;
    const avatar = this.standingAvatar(to);
    const path = findPath(this.grid, avatar, to);
    if (!path) return null;
    this.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seated: null };
    return path;
  }

  async sit(uid: number, tap?: Point): Promise<SitResult | null> {
    const item = this.roomItem(uid);
    if (!item || (tap !== undefined && !finitePoint(tap))) return null;
    const type = getFurnitureType(item.typeId);
    const avatar = this.standingAvatar(item);
    // Seats taken by others: shop customers waiting on a seat (other players come in step 10).
    const taken = this.state.currentRoomId === this.state.shop.roomId ? [...this.state.shop.customers, ...this.state.tavern.guests].flatMap((c) => (c.seat?.uid === uid ? [c.seat.index] : [])) : [];
    const plan = planSit(this.grid, avatar, item, type, tap ?? null, taken);
    if (!plan) return null;
    const { path, seat } = plan;
    this.walkState = { avatar: { ...avatar, state: 'walk' }, path: path.slice(1), at: this.now(), sitOn: { uid, seat }, seated: null };
    return { path, seat };
  }

  async serve(uid: number): Promise<ServeResult | null> {
    const counter = this.roomItem(uid);
    if (!counter) return null;
    const type = getFurnitureType(counter.typeId);
    if (!type.servedFromBehind) return null;
    const avatar = this.standingAvatar(counter);
    const spot = behindPoint(counter, type);
    const path = findPath(this.grid, avatar, spot);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x - spot.x, end.y - spot.y) > APPROACH_REACH_PX) return null;
    const facing = counter.facing;
    const at = { uid, x: counter.x, y: counter.y, facing };
    this.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seated: null, serveAt: at };
    return { path, facing };
  }

  /** True while the own avatar stands behind the shop's counter (customers pay then). */
  isServing(): boolean {
    if (this.state.currentRoomId !== this.state.shop.roomId) return false;
    this.avatarNow();
    const sv = this.walkState.serving;
    if (!sv) return false;
    const c = this.roomItem(sv.uid);
    // The counter was moved or turned: no longer behind it.
    return !!c && c.x === sv.x && c.y === sv.y && c.facing === sv.facing;
  }

  async getItems(): Promise<FurnitureItem[]> {
    return this.visibleItems();
  }

  async placeItem(uid: number, at: PlaceAt): Promise<ItemsResult> {
    const item = this.state.items.find((i) => i.uid === uid && i.roomId === null);
    if (!item || !this.validAt(item.typeId, at)) return null;
    const s: PlacingSession = { ...startNewPlacing(item.typeId, at.center, uid), facing: at.facing };
    return this.place(s, at.snap);
  }

  async moveItem(uid: number, at: PlaceAt): Promise<ItemsResult> {
    const item = this.roomItem(uid);
    if (!item || !this.validAt(item.typeId, at)) return null;
    const s: PlacingSession = { ...startMovePlacing(item), center: at.center, facing: at.facing };
    return this.place(s, at.snap);
  }

  async rotateItem(uid: number): Promise<ItemsResult> {
    const next = rotateInPlace(this.room(), this.state.items, uid);
    return next ? this.setItems(next) : null;
  }

  async pickUpItem(uid: number): Promise<ItemsResult> {
    const item = this.roomItem(uid);
    // The counter is never picked up (there is always exactly one).
    if (!item || !canPickUp(item)) return null;
    return this.setItems(pickUpItem(this.state.items, uid));
  }

  async getInventory(): Promise<Inventory> {
    return {
      furniture: this.state.items.filter((i) => i.roomId === null).map((i) => ({ ...i })),
      materials: { ...this.state.player.materials },
      hotbar: [...this.state.hotbar],
      bag: structuredClone(this.state.bag),
    };
  }

  async moveSlot(from: SlotRef, to: SlotRef): Promise<SlotLayout | null> {
    return this.setLayout(moveSlot(this.layout(), from, to));
  }

  async hotbarToBag(index: number): Promise<SlotLayout | null> {
    return this.setLayout(hotbarToBag(this.layout(), index));
  }

  async tidyBag(tab: BagTab, how: 'sort' | 'stack'): Promise<SlotLayout> {
    const l = this.layout();
    if (tab !== 'furniture' && tab !== 'materials') return l;
    return this.setLayout(how === 'sort' ? sortBag(l, tab) : stackBag(l, tab)) ?? l;
  }

  async setLook(look: AvatarLook): Promise<AvatarLook> {
    // Free or unlocked clothing and colours from the lists only (step 7b).
    if (lookAllowed(look, this.state.player.unlockedClothing)) this.commit({ ...this.state, look: { ...look } });
    return { ...this.state.look };
  }

  async chat(text: string): Promise<ChatLine | null> {
    const clean = cleanChatText(text);
    if (clean === null) return null;
    const p = this.state.player;
    const line: ChatLine = { id: ++this.chatId, avatarId: p.id, name: p.name, text: clean, at: this.now() };
    for (const l of this.chatListeners) l(line);
    return line;
  }

  onChat(listener: (line: ChatLine) => void): () => void {
    this.chatListeners.add(listener);
    return () => this.chatListeners.delete(listener);
  }

  // ---------- Shop, catalog and rooms (step 7) ----------

  async getShop(): Promise<ShopView> {
    return this.shopView();
  }

  async putOnShelf(slot: ShelfSlotRef, pick: StockPick, price: number): Promise<ShopView | null> {
    const next = putOnShelf(this.state, slot, pick, price, this.now());
    if (!next) return null;
    this.commit(this.hintDone(next, 2));
    return this.shopView();
  }

  async takeFromShelf(slot: ShelfSlotRef): Promise<ShopView | null> {
    const next = takeFromShelf(this.state, slot, this.now());
    if (!next) return null;
    this.commit(next);
    return this.shopView();
  }

  async setPrice(slot: ShelfSlotRef, price: number): Promise<ShopView | null> {
    if (!validPrice(price)) return null;
    const next = setPrice(this.state, slot, price);
    if (!next) return null;
    this.commit(next);
    return this.shopView();
  }

  onShop(listener: (e: ShopEvent) => void): () => void {
    this.shopListeners.add(listener);
    return () => this.shopListeners.delete(listener);
  }

  async buyCatalog(typeId: string): Promise<BuyResult | null> {
    const first = !this.state.ledger.some((e) => e.reason === 'catalog' || e.reason === 'style');
    const next = buyCatalog(this.state, typeId, this.now());
    if (!next) return null;
    const uid = next.ledger.at(-1)?.furnitureUids?.[0];
    if (uid === undefined) return null;
    const gains = gainsSince(this.state, next);
    this.commit(this.hintDone(next, 0));
    return { uid, first, gains };
  }

  async buyStyle(kind: StyleKind, id: string): Promise<boolean> {
    const next = unlockStyle(this.state, kind, id, this.now());
    if (!next) return false;
    // A style as the first buy counts for the first hint, and skips the second (nothing to place).
    this.commit(this.state.hintsDone === 0 ? { ...next, hintsDone: 2 } : next);
    return true;
  }

  async applyStyle(roomId: number, kind: StyleKind, id: string): Promise<Room | null> {
    const next = applyStyle(this.state, roomId, kind, id);
    if (!next) return null;
    this.commit(next);
    return this.roomById(roomId);
  }

  async paintFloor(roomId: number, from: { c: number; r: number }, to: { c: number; r: number }, id: string): Promise<Room | null> {
    const next = paintFloor(this.state, roomId, from, to, id);
    if (!next) return null;
    this.commit(next);
    return this.roomById(roomId);
  }

  async placeBlock(c: number, r: number, blockId: string): Promise<BlockResult> {
    const room = this.room();
    const me = this.avatarNow();
    const res = placeBlock(this.state, room.id, c, r, blockId, this.now(), { standing: this.standingPoints(), from: me });
    if (!res.ok) return res.problem === 'reach' ? this.walkCloser(me, c, r) : { kind: 'refused', problem: res.problem };
    this.commitBlocks(res.state);
    return { kind: 'placed', room: this.roomById(room.id)!, c, r, gains: [] };
  }

  async hitBlock(c: number, r: number): Promise<BlockResult> {
    const room = this.room();
    const me = this.avatarNow();
    const now = this.now();
    const res = hitBlock(this.state, room.id, c, r, now, this.lastBlockHitAt, this.rng, me);
    if (!res.ok) return res.problem === 'reach' ? this.walkCloser(me, c, r) : { kind: 'refused', problem: res.problem };
    this.lastBlockHitAt = now;
    if (res.kind === 'cracked') {
      this.commit(res.state);
      return { kind: 'cracked', room: this.roomById(room.id)!, c, r, hits: res.hits, hardness: res.hardness, gains: [] };
    }
    const gains = gainsSince(this.state, res.state);
    this.commitBlocks(res.state);
    return { kind: 'broken', room: this.roomById(room.id)!, c, r, gains };
  }

  async buyBlocks(blockId: string, qty: number): Promise<GainList | null> {
    const next = buyBlocks(this.state, blockId, qty, this.now());
    return next ? this.commitGains(next) : null;
  }

  async upgradeRoom(roomId: number): Promise<Room | null> {
    const next = upgradeRoom(this.state, roomId, this.now());
    if (!next) return null;
    this.commit(next);
    this.grid = this.buildGrid();
    this.shopGrid = null;
    return this.roomById(roomId);
  }

  async getRoom(roomId: number): Promise<Room | null> {
    return this.roomById(roomId);
  }

  async currentHint(): Promise<string | null> {
    const i = this.state.hintsDone;
    // The dungeon hint only shows while the shop has nothing for sale (and no run is going).
    // The mine hint (step 9c) waits until the mine opens.
    if (i === MINE_HINT && this.state.player.level < MINE_UNLOCK_LEVEL) return null;
    if (i === DUNGEON_HINT) return !this.state.run && !this.state.shop.slots.some((s) => s.loot) ? (HINTS[i] ?? null) : null;
    return HINTS[i] ?? null;
  }

  // ---------- The dungeon (step 9) ----------

  async getRun(): Promise<RunView | null> {
    const run = this.state.run;
    return run ? { run, paused: this.runPaused } : null;
  }

  async dungeonStart(lunch: readonly FoodId[] = []): Promise<DungeonRun | null> {
    if (this.state.run) return null;
    const seed = rngInt(this.rng, 1, 2 ** 31 - 1);
    const r = startRun(this.state, seed, this.now(), undefined, lunch);
    // The dungeon hint is done once the player goes in.
    this.commit({ ...this.hintDone(r.state, DUNGEON_HINT), run: r.run });
    this.runPaused = false;
    this.runSavedAt = 0;
    return r.run;
  }

  async dungeonInput(input: DungeonInput): Promise<RunUpdate | null> {
    const run = this.state.run;
    if (!run || this.runPaused) return null;
    return this.applyRun(step(run, [input], 0, this.rng));
  }

  async dungeonAdvance(dtMs: number): Promise<RunUpdate | null> {
    const run = this.state.run;
    if (!run) return null;
    if (this.runPaused || !(dtMs > 0)) return { run, result: null, gains: [] };
    return this.applyRun(step(run, [], dtMs, this.rng));
  }

  async dungeonPause(): Promise<void> {
    if (this.state.run) this.runPaused = true;
  }

  async dungeonResume(): Promise<void> {
    this.runPaused = false;
  }

  async craft(recipeId: string): Promise<GainList | null> {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    const next = recipe ? craftRecipe(recipe, this.state, this.now()) : null;
    return next ? this.commitGains(next) : null;
  }

  async buyGear(id: ShopGearId): Promise<GainList | null> {
    const next = buyGear(this.state, id, this.now());
    if (!next) return null;
    this.commit(next);
    // Gear and potions are not in the ledger's materials: the piece itself is the gain.
    return [gain(id)];
  }

  // ---------- The mine and the forge (step 9c) ----------

  async mineStart(): Promise<DungeonRun | null> {
    if (this.state.run) return null;
    const seed = rngInt(this.rng, 1, 2 ** 31 - 1);
    const r = startMine(this.state, seed);
    if (!r) return null;
    this.commit({ ...this.hintDone(r.state, MINE_HINT), run: r.run });
    this.runPaused = false;
    this.runSavedAt = 0;
    return r.run;
  }

  async smelt(bar: BarId): Promise<GainList | null> {
    const next = smelt(this.state, bar, this.now());
    return next ? this.commitGains(next) : null;
  }

  async forge(piece: GearId): Promise<GainList | null> {
    const next = forgePiece(this.state, piece, this.now());
    if (!next) return null;
    this.commit(next);
    return [gain(piece)];
  }

  // ---------- The farm and cooking (step 9b) ----------

  async getFarm(): Promise<FarmView> {
    return this.farmView();
  }

  /** Plants a seed in a soil cell (step BG6): within reach, else the avatar walks closer first. */
  async plantSeed(c: number, r: number, seed: SeedId): Promise<BlockResult> {
    const room = this.room();
    const me = this.avatarNow();
    const res = plantSeed(this.state, room.id, c, r, seed, this.now(), { standing: this.standingPoints(), from: me });
    if (!res.ok) return res.problem === 'reach' ? this.walkCloser(me, c, r) : { kind: 'refused', problem: res.problem };
    // The farm quest: plant your first seed (any seed counts).
    this.commitBlocks(this.hintDone(res.state, FARM_HINT));
    return { kind: 'planted', room: this.roomById(room.id)!, c, r, gains: [] };
  }

  /** One punch at a plant (step BG6): a grown one is harvested, an unripe one is left alone. */
  async hitPlant(c: number, r: number): Promise<BlockResult> {
    const room = this.room();
    const me = this.avatarNow();
    const now = this.now();
    const res = hitPlant(this.state, room.id, c, r, now, this.lastBlockHitAt, this.rng, me);
    if (!res.ok) {
      if (res.problem === 'reach') return this.walkCloser(me, c, r);
      if (res.problem === 'unripe') return { kind: 'unripe', c, r, leftMs: res.leftMs ?? 0 };
      return { kind: 'refused', problem: res.problem };
    }
    this.lastBlockHitAt = now;
    const gains = gainsSince(this.state, res.state);
    const clothing = res.state.player.unlockedClothing.find((id) => !this.state.player.unlockedClothing.includes(id));
    const recipe = res.state.player.splicesFound.find((k) => !this.state.player.splicesFound.includes(k));
    this.commitBlocks(res.state);
    return { kind: 'harvested', room: this.roomById(room.id)!, c, r, gains, ...(clothing ? { clothing } : {}), ...(recipe ? { recipe } : {}) };
  }

  /** A second seed on a planted cell (step BG7): within reach, else the avatar walks closer first. */
  async spliceSeed(c: number, r: number, seed: SeedId): Promise<BlockResult> {
    const room = this.room();
    const me = this.avatarNow();
    const res = spliceSeed(this.state, room.id, c, r, seed, this.now());
    if (!res.ok) return { kind: 'refused', problem: res.problem };
    if (!inReach(me, c, r)) return this.walkCloser(me, c, r);
    this.commitBlocks(this.hintDone(res.state, SPLICE_HINT));
    return { kind: 'spliced', room: this.roomById(room.id)!, c, r, gains: [] };
  }

  async openPack(packId: string): Promise<PackOpenResult | null> {
    const res = openPack(this.state, packId, this.rng, this.now());
    if (!res) return null;
    this.commit(this.hintDone(res.state, PACK_HINT));
    return { packId, finds: res.finds, gains: res.gains };
  }

  async sellSpare(clothingId: string, qty: number): Promise<number | null> {
    const next = sellSpare(this.state, clothingId, qty, this.now());
    if (!next) return null;
    const paid = next.player.wallet.gold - this.state.player.wallet.gold;
    this.commit(next);
    return paid;
  }

  async buySeeds(seed: SeedId, qty: number): Promise<GainList | null> {
    const next = buySeeds(this.state, seed, qty, this.now());
    return next ? this.commitGains(next) : null;
  }

  // ---------- The tavern (step 9t) ----------

  async getTavern(): Promise<TavernView> {
    const t = this.state.tavern;
    return structuredClone({ roomId: t.roomId, guests: t.guests, mess: t.mess, serveQueue: t.serveQueue, holding: t.holding, brews: t.brews, at: this.now() });
  }

  onTavern(listener: (e: TavernClientEvent) => void): () => void {
    this.tavernListeners.add(listener);
    return () => this.tavernListeners.delete(listener);
  }

  async serveGuest(guestId: number): Promise<boolean> {
    if (!this.inTavern()) return false;
    const next = requestServe(this.state, guestId);
    if (!next) return false;
    this.commit(next);
    this.emitTavern({ t: 'queue', queue: [...next.tavern.serveQueue] });
    if (this.errand) return true; // The queue is worked off after the order the avatar is carrying.
    if (this.nextServe()) return true;
    this.dropServe();
    return false;
  }

  async tidyTable(messId: number, what: 'coins' | 'dish'): Promise<boolean> {
    if (!this.inTavern()) return false;
    const mess = this.state.tavern.mess.find((m) => m.id === messId);
    if (!mess || (what === 'coins' ? mess.coins <= 0 : mess.dish === null)) return false;
    // With an order in the hands, or orders queued, serving comes first.
    const t = this.state.tavern;
    if (t.holding || t.serveQueue.length > 0) return false;
    return this.startErrand({ x: mess.x, y: mess.y }, { stage: 'mess', messId, what });
  }

  async collectBrew(barrelUid: number): Promise<{ drink: MaterialId; mugs: number; gains: GainList } | null> {
    if (!this.inTavern()) return null;
    const r = collectBrew(this.state, barrelUid, this.now());
    if (!r) return null;
    const gains = gainsSince(this.state, r.state);
    this.commit(r.state);
    return { drink: r.drink, mugs: r.mugs, gains };
  }

  private inTavern(): boolean {
    return this.state.currentRoomId === this.state.tavern.roomId;
  }

  /** Walks the own avatar to a spot for an errand. False when there is no way within reach of it. */
  private startErrand(to: Point, task: TavernTask): boolean {
    const avatar = this.standingAvatar(to);
    const path = findPath(this.grid, avatar, to);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x - to.x, end.y - to.y) > GUEST_SERVE_REACH_PX) return false;
    this.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seated: null, task };
    this.errand = true;
    this.emitTavern({ t: 'walk', path });
    return true;
  }

  /** Starts the next queued order: to the bar. False when nobody waits any more or there is no way. */
  private nextServe(): boolean {
    const t = this.state.tavern;
    const open = openOrders(t).map((g) => g.id);
    const id = t.serveQueue.find((i) => open.includes(i));
    if (id === undefined) return false;
    const stops = serveStops(this.state, id);
    return stops !== null && this.startErrand(stops.bar, { stage: 'bar' });
  }

  /** Forgets the queue and the order in the hands (the orders stay open). */
  private dropServe(): void {
    this.errand = false;
    if (this.state.tavern.serveQueue.length === 0 && this.state.tavern.holding === null) return;
    this.commit(cancelServe(this.state));
    this.emitTavern({ t: 'queue', queue: [] });
    this.emitTavern({ t: 'holding', item: null });
  }

  /** Called every clock tick: an errand that arrived does its job (pick up, put down, collect) and the next one starts. */
  private runErrand(): void {
    if (!this.errand) return;
    this.avatarNow();
    const w = this.walkState;
    // Another kind of walk replaced the errand (a tap on the floor, a seat, another room): forget it.
    if (!w.task) return this.dropServe();
    if (w.path.length > 0) return;
    const task = w.task;
    this.walkState = { ...w, task: undefined };
    this.errand = false;
    const now = this.now();
    if (task.stage === 'bar') {
      const r = pickUpOrder(this.state);
      if (!r) {
        if (!this.nextServe()) this.dropServe();
        return;
      }
      this.commit(r.state);
      this.emitTavern({ t: 'holding', item: r.item });
      this.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
      const stops = serveStops(this.state, r.guestId);
      if (!stops || !this.startErrand(stops.table, { stage: 'table', guestId: r.guestId })) this.dropServe();
    } else if (task.stage === 'table') {
      const spot = serveStops(this.state, task.guestId)?.table;
      const d = deliverOrder(this.state, this.rng);
      if (d && spot) {
        this.commit(d.state);
        this.emitTavern({ t: 'served', guestId: d.guestId, item: d.item, spot });
      } else if (this.state.tavern.holding) {
        this.commit(cancelServe(this.state));
      }
      this.emitTavern({ t: 'holding', item: null });
      if (!this.nextServe()) this.dropServe();
    } else {
      const mess = this.state.tavern.mess.find((m) => m.id === task.messId);
      if (!mess) return;
      const spot = { x: mess.x, y: mess.y };
      if (task.what === 'coins') {
        const r = collectCoins(this.state, task.messId, now);
        if (!r) return;
        this.commit(r.state);
        this.emitTavern({ t: 'collected', messId: task.messId, coins: r.coins, spot, gains: [gain(GOLD_GAIN_ID, r.coins)] });
      } else {
        const next = clearDish(this.state, task.messId);
        if (!next) return;
        this.commit(next);
        this.emitTavern({ t: 'cleared', messId: task.messId, spot });
      }
    }
  }

  async getLakeside(): Promise<LakesideView> {
    return this.lakesideView();
  }

  async chopTree(index: number): Promise<ChopUpdate | null> {
    if (this.room().kind !== 'lakeside') return null;
    const tree = (() => {
      try {
        return treeAnchor(index);
      } catch {
        return null;
      }
    })();
    if (!tree) return null;
    // The avatar must stand next to the tree.
    const me = this.avatarNow();
    if (Math.hypot(me.x - tree.x, me.y - tree.y) > CHOP_REACH_PX) return null;
    const r = chop(this.state, index, this.now(), this.rng);
    if (!r) return null;
    const gains = gainsSince(this.state, r.state);
    if (r.state !== this.state) this.commit(r.state);
    return { kind: r.result.kind, hits: r.result.hits, ...(r.result.loot ? { loot: r.result.loot } : {}), gains, lakeside: this.lakesideView() };
  }

  async castAt(target: Point): Promise<CastPlan | null> {
    if (this.room().kind !== 'lakeside' || !finitePoint(target)) return null;
    const avatar = this.standingAvatar(target);
    const spot = nearestCastSpot(this.grid, avatar, target);
    if (!spot) return null;
    const path = findPath(this.grid, avatar, spot);
    if (!path) return null;
    this.fish = null;
    this.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seated: null };
    return { path, spot, bobber: bobberPoint(spot, target) };
  }

  async fishStart(): Promise<FishSession | null> {
    if (this.room().kind !== 'lakeside') return null;
    if (this.fish && !fishDone(this.fish)) return structuredClone(this.fish);
    this.fish = newFishSession(this.rng, this.state.player.gear);
    return structuredClone(this.fish);
  }

  async fishStep(inputs: readonly FishInput[], dtMs: number): Promise<FishUpdate | null> {
    if (!this.fish) return null;
    const next = fishStep(this.fish, inputs, dtMs, this.rng);
    this.fish = next;
    let caught: FishUpdate['caught'] = null;
    let gains: GainList = [];
    if (next.phase === 'done') {
      this.fish = null;
      if (next.outcome === 'caught') {
        const before = this.state.player.biggest[next.catchId] ?? 0;
        const banked = bankCatch(this.state, next, this.now(), this.rng);
        if (banked) {
          gains = gainsSince(this.state, banked);
          this.commit(banked);
          caught = { id: next.catchId, rank: next.rank, cm: next.cm, record: next.cm !== null && next.cm > before };
        }
      }
    }
    return { session: structuredClone(next), caught, gains };
  }

  async fishStop(): Promise<void> {
    this.fish = null;
  }

  async bookOpened(): Promise<void> {
    this.commit(openBook(this.state, this.now()));
  }

  async claimBookReward(tab: BookTab, percent: number): Promise<BookClaim | null> {
    const next = claimBookReward(this.state, tab, percent, this.now(), this.rng);
    if (!next) return null;
    const gold = next.player.wallet.gold - this.state.player.wallet.gold;
    const gems = next.player.wallet.gems - this.state.player.wallet.gems;
    this.commit(next);
    return { gold, gems, gains: gems > 0 ? [{ itemId: GEMS_GAIN_ID, count: gems, rank: 'common' }] : [] };
  }

  async cook(food: FoodId): Promise<GainList | null> {
    const next = cook(this.state, food, this.now());
    return next ? this.commitGains(next) : null;
  }

  /** Saves a new state and returns what it gave (the items the ledger wrote since the old state). */
  private commitGains(next: GameState): GainList {
    const gains = gainsSince(this.state, next);
    this.commit(next);
    return gains;
  }

  /** A fishing line that is cast (not saved: a reload loses it, and nothing is lost with it). */
  private fish: FishSession | null = null;

  private lakesideView(): LakesideView {
    const now = this.now();
    const lake = growTrees(this.state.lakeside, now);
    return {
      roomId: lake.roomId,
      trees: lake.trees.map((t) => ({ hits: t.hits, regrowInMs: isStump(t, now) ? regrowInMs(t, now) : null })),
      at: now,
    };
  }

  private farmView(): FarmView {
    const room = this.roomById(this.state.player.farmRoomId);
    const at = this.now();
    const counts = room ? farmCounts(room, at) : { ripe: 0, growing: 0, free: 0 };
    return { roomId: this.state.player.farmRoomId, level: (room?.level ?? 1) as RoomLevel, ...counts, at };
  }

  /**
   * Keeps a stepped run. A run that ended is banked at once (finishRun: the ledger, xp, potions)
   * and removed from the state, so it can never be banked twice. A going run is saved when
   * something happened, and at least every RUN_SAVE_EVERY_MS of run time.
   */
  private applyRun(next: DungeonRun): RunUpdate {
    if (next.status === 'left' || next.status === 'dead') {
      const before = this.state.player;
      const banked = finishRun({ ...this.state, run: null }, next, this.now()) ?? { ...this.state, run: null };
      this.commit(banked);
      const result: RunResult = {
        status: next.status,
        place: next.place,
        lanternOut: next.events.some((e) => e.t === 'lantern_out'),
        banked: next.banked,
        lost: next.lost,
        xpGained: next.xpGained,
        levelBefore: before.level,
        levelAfter: banked.player.level,
        floor: next.floor,
        lastHitBy: next.lastHitBy,
      };
      return { run: next, result, gains: gainsFromRunEvents(next.events) };
    }
    const worth = next.events.some((e) => e.t !== 'windup') || next.status !== this.state.run?.status;
    if (worth || next.timeMs - this.runSavedAt >= RUN_SAVE_EVERY_MS) {
      this.runSavedAt = next.timeMs;
      this.commit({ ...this.state, run: next });
    } else {
      this.state = { ...this.state, run: next };
    }
    return { run: next, result: null, gains: gainsFromRunEvents(next.events) };
  }

  /** Tests only: furniture of these types into the bag (ledger reason 'debug'). */
  debugGiveFurniture(typeIds: readonly string[]): void {
    const next = applyChange(this.state, { reason: 'debug', addFurniture: [...typeIds] }, this.now());
    if (next) this.commit(next);
  }

  /** Starts the shop clock (the browser calls it once; tests call update() themselves). */
  startClock(): void {
    if (this.clock) return;
    this.clock = window.setInterval(() => this.update(), SHOP_TICK_MS);
  }

  /**
   * Moves the shop on to now: walking customers in SHOP_TICK_MS steps, or (after a gap longer
   * than SHOP_CATCH_UP_GAP_MS) the maths-only catch-up. Sends the shop events.
   */
  update(): void {
    const now = this.now();
    this.runErrand();
    if (now - this.state.shop.updatedAt > SHOP_CATCH_UP_GAP_MS || now - this.state.tavern.updatedAt > SHOP_CATCH_UP_GAP_MS) {
      this.catchUp();
      this.save();
      this.emit({ t: 'customers', customers: this.state.shop.customers });
      this.emit({ t: 'slots' });
      this.emitTavern({ t: 'guests', guests: this.state.tavern.guests });
      return;
    }
    const events: ShopEvent[] = [];
    const tavernEvents: TavernEvent[] = [];
    let s = this.state;
    while (s.shop.updatedAt + SHOP_TICK_MS <= now) {
      const at = s.shop.updatedAt + SHOP_TICK_MS;
      const r = stepShop(s, this.shopWorld(s), SHOP_TICK_MS, this.rng, at);
      s = { ...r.state, shop: { ...r.state.shop, updatedAt: at } };
      events.push(...r.events);
    }
    // The guests (step 9t) step on the same clock.
    while (s.tavern.updatedAt + SHOP_TICK_MS <= now) {
      const at = s.tavern.updatedAt + SHOP_TICK_MS;
      const r = stepTavern(s, this.tavernWorld(s), SHOP_TICK_MS, this.rng, at);
      s = r.state;
      tavernEvents.push(...r.events);
    }
    if (s === this.state) return;
    // Only events change what is worth saving; walking positions are not saved every step.
    if (events.length > 0 || tavernEvents.length > 0) this.commit(s);
    else this.state = s;
    for (const e of events) this.emit(e);
    for (const e of tavernEvents) this.emitTavern(e);
  }

  /** Debug (Blockers mode): rectangles that block walking in the current room (not saved). */
  debugSetBlockers(rects: readonly Rect[]): void {
    this.debugRects = rects.map((r) => ({ ...r }));
    this.grid = this.buildGrid();
  }

  // ---------- LocalSaves ----------

  exportSave(): string {
    return toSaveText(this.state, this.now());
  }

  importSave(text: string): SaveResult {
    const r = readSave(text);
    if (!r.ok) return { ok: false, message: problemMessage(r.problem) };
    this.storage.set(SAVE_BACKUP_KEY, this.exportSave());
    this.commit(r.state);
    this.runPaused = r.state.run !== null;
    return { ok: true };
  }

  hasBackup(): boolean {
    const b = this.storage.get(SAVE_BACKUP_KEY);
    return b !== null && readSave(b).ok;
  }

  restoreBackup(): SaveResult {
    const b = this.storage.get(SAVE_BACKUP_KEY);
    const r = b !== null ? readSave(b) : null;
    if (!r) return { ok: false, message: 'There is no backup yet.' };
    if (!r.ok) return { ok: false, message: problemMessage(r.problem) };
    this.storage.set(SAVE_BACKUP_KEY, this.exportSave());
    this.commit(r.state);
    return { ok: true };
  }

  newGame(): void {
    this.storage.set(SAVE_BACKUP_KEY, this.exportSave());
    this.commit(createNewPlayer(undefined, this.now()));
    this.runPaused = false;
  }

  // ---------- inside ----------

  private save(): void {
    this.storage.set(saveKey(), toSaveText(this.state, this.now()));
  }

  private commit(state: GameState): void {
    this.state = arrangeState(state);
    this.save();
  }

  private emit(e: ShopEvent): void {
    for (const l of this.shopListeners) l(e);
  }

  private emitTavern(e: TavernClientEvent): void {
    for (const l of this.tavernListeners) l(e);
  }

  /** Marks hint `index` done when it is the one showing (hints go one at a time). */
  private hintDone(state: GameState, index: number): GameState {
    const next = completeQuest(state, index, this.now(), this.rng);
    // The quest's gems are handed to the client by takeGains (the call that finished the quest has its own result).
    if (next !== state) this.pendingGains = mergeGains(this.pendingGains, gainsSince(state, next));
    return next;
  }

  /** Gains nobody has been told about yet (quest gems, step BG4). */
  private pendingGains: GainList = [];

  async takeGains(): Promise<GainList> {
    const out = this.pendingGains;
    this.pendingGains = [];
    return out;
  }

  private roomById(roomId: number): Room | null {
    const r = this.state.rooms.find((x) => x.id === roomId);
    return r ? { ...r } : null;
  }

  private shopView(): ShopView {
    const shop = this.state.shop;
    const room = this.roomById(shop.roomId);
    return structuredClone({
      roomId: shop.roomId,
      slots: shop.slots,
      saleHistory: shop.saleHistory,
      appeal: room ? shopAppeal(room, this.state.items) : 0,
      customers: shop.customers,
    });
  }

  private shopWorld(state: GameState): ShopWorld {
    const room = state.rooms.find((r) => r.id === state.shop.roomId);
    if (!room) throw new Error('shop room missing');
    this.shopGrid ??= buildNavGrid(room, [...itemBlockers(state.items, room.id), ...blockRects(room)]);
    // The own avatar's seat in the shop (customers do not sit there).
    const seated = state.currentRoomId === room.id ? this.walkState.seated : null;
    return { room, items: state.items, grid: this.shopGrid, cashier: this.isServing(), seatsTaken: seated ? [seated] : [] };
  }

  /** The gap is done with maths (catchUpShop): no sales; the line fills up (at most QUEUE_MAX). */
  private catchUp(): void {
    this.state = catchUpShop(this.state, this.shopWorld(this.state), this.now(), this.rng).state;
    // Step 9t: the guests too (maths only: open orders wait, who was eating has paid).
    this.state = catchUpTavern(this.state, this.tavernWorld(this.state), this.now(), this.rng).state;
    this.errand = false;
  }

  private tavernWorld(state: GameState): TavernWorld {
    const w = this.shopWorld(state);
    return { room: w.room, items: state.items, grid: w.grid, playerHere: state.currentRoomId === w.room.id, ...(w.seatsTaken ? { seatsTaken: w.seatsTaken } : {}) };
  }

  private layout(): SlotLayout {
    return structuredClone({ hotbar: this.state.hotbar, bag: this.state.bag });
  }

  private setLayout(l: SlotLayout | null): SlotLayout | null {
    if (!l) return null;
    this.commit({ ...this.state, hotbar: l.hotbar, bag: l.bag });
    return this.layout();
  }

  private room(): Room {
    const room = this.state.rooms.find((r) => r.id === this.state.currentRoomId);
    if (!room) throw new Error('current room missing');
    return room;
  }

  private roomItem(uid: number): FurnitureItem | undefined {
    return this.state.items.find((i) => i.uid === uid && i.roomId === this.state.currentRoomId);
  }

  private visibleItems(): FurnitureItem[] {
    const id = this.state.currentRoomId;
    return this.state.items.filter((i) => i.roomId === id || i.roomId === null).map((i) => ({ ...i }));
  }

  private validAt(typeId: string, at: PlaceAt): boolean {
    return finitePoint(at.center) && getFurnitureType(typeId).facings.includes(at.facing);
  }

  private place(s: PlacingSession, snap: boolean): ItemsResult {
    const p = this.state.player;
    // Only inventory items are placed, so no new uid is ever needed.
    const next = confirmPlacing(this.room(), this.state.items, s, { ownerId: p.id, newUid: () => this.state.nextUid }, snap);
    if (!next) return null;
    // Hint 2: place something (after buying it).
    if (!s.origin) this.state = this.hintDone(this.state, 1);
    return this.setItems(next);
  }

  private setItems(items: FurnitureItem[]): FurnitureItem[] {
    // A table, shelf or case that left the shop gives its goods back to the bag.
    let next = returnOrphanBrews(returnOrphanLoot({ ...this.state, items }, this.now()), this.now());
    if (this.state.currentRoomId === next.shop.roomId) {
      this.shopGrid = null;
      next = repathGuests(repathCustomers(next, this.shopWorld(next)), this.tavernWorld(next));
    }
    const slotsBefore = this.state.shop.slots.length;
    this.commit(next);
    this.grid = this.buildGrid();
    if (next.shop.slots.length !== slotsBefore) this.emit({ t: 'slots' });
    // The seat moved or was picked up: stand up next to it on a free spot.
    this.avatarNow();
    const w = this.walkState;
    if (w.seated !== null) {
      const item = this.roomItem(w.seated.uid);
      const a = w.avatar;
      if (!onSeat(a, item, item && getFurnitureType(item.typeId), w.seated.index)) {
        const spot = standUpSpot(this.grid, a);
        this.walkState = { ...w, avatar: { ...a, ...spot, state: 'idle' }, seated: null };
      }
    }
    return this.visibleItems();
  }

  /** The last block punch (ms), for the cooldown. Not saved. */
  private lastBlockHitAt = -Infinity;

  /** Where avatars stand still in the current room: the own avatar, and the shop's customers and guests. */
  private standingPoints(): Point[] {
    const me = this.avatarNow();
    const out: Point[] = this.walkState.path.length === 0 ? [{ x: me.x, y: me.y }] : [];
    if (this.state.currentRoomId === this.state.shop.roomId) {
      for (const g of [...this.state.shop.customers, ...this.state.tavern.guests]) if (g.path.length === 0) out.push({ x: g.x, y: g.y });
    }
    return out;
  }

  /** A block cell is out of reach: walk to a spot near it; the client asks again on arrival. */
  private walkCloser(me: Avatar, c: number, r: number): BlockResult {
    const spot = approachSpot(this.grid, me, c, r);
    const path = spot && findPath(this.grid, me, spot);
    if (!path) return { kind: 'refused', problem: 'reach' };
    this.walkState = { avatar: { ...me, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seated: null };
    return { kind: 'walk', path };
  }

  /** A block was placed or broken: save, rebuild the grids and send the customers round the new walls. */
  private commitBlocks(next: GameState): void {
    this.commit(next);
    this.grid = this.buildGrid();
    this.shopGrid = null;
    if (this.state.currentRoomId === this.state.shop.roomId) {
      this.commit(repathGuests(repathCustomers(this.state, this.shopWorld(this.state)), this.tavernWorld(this.state)));
    }
  }

  private buildGrid(): NavGrid {
    // The furniture plus fixed blockers (the farm's cooking pot).
    return buildNavGrid(this.room(), [...this.debugRects, ...roomBlockers(this.room(), this.state.items)]);
  }

  /** The own avatar standing in the door zone of the current room. */
  private doorWalk(): WalkState {
    const room = this.room();
    const p = this.state.player;
    const avatar: Avatar = {
      id: p.id,
      name: p.name,
      look: { ...this.state.look },
      roomId: room.id,
      x: doorX(room),
      y: doorY(room) - AVATAR_START_FROM_BOTTOM,
      facing: 'up',
      state: 'idle',
    };
    return { avatar, path: [], at: this.now(), sitOn: null, seated: null };
  }

  /** Where the own avatar is now (it walks by time), and sits down when it reached a seat. */
  /**
   * The avatar ready to walk. Out of bed (fix after 9e): a lying avatar is in the middle of the
   * bed, so a walk that started there went on under the bed's drawing and the avatar was gone for
   * a second. It now stands up next to the bed at once: on the free spot nearest the bed, on the
   * side it is going to (`toward`).
   */
  private standingAvatar(toward: Point): Avatar {
    const a = this.avatarNow();
    if (a.state !== 'lie') return a;
    const d = Math.hypot(toward.x - a.x, toward.y - a.y) || 1;
    const lean = { x: a.x + ((toward.x - a.x) / d) * NAV_CELL, y: a.y + ((toward.y - a.y) / d) * NAV_CELL };
    const spot = standUpSpot(this.grid, lean);
    const standing: Avatar = { ...a, ...spot, state: 'idle' };
    this.walkState = { ...this.walkState, avatar: standing, path: [], at: this.now(), sitOn: null, seated: null };
    return standing;
  }

  private avatarNow(): Avatar {
    const w = this.walkState;
    const now = this.now();
    if (w.avatar.state === 'sit' || w.avatar.state === 'lie') return w.avatar;
    const r = walkAvatar(w.avatar, w.path, Math.max(0, now - w.at));
    let next: WalkState = { ...w, avatar: r.avatar, path: r.path, at: now };
    if (r.path.length === 0 && w.sitOn) {
      const { x, y, facing, pose, index } = w.sitOn.seat;
      next = { ...next, avatar: { ...r.avatar, x, y, facing, state: pose }, sitOn: null, seated: { uid: w.sitOn.uid, index } };
    }
    if (r.path.length === 0 && w.serveAt) {
      // Behind the counter: face it and take payments.
      next = { ...next, avatar: { ...next.avatar, facing: w.serveAt.facing }, serveAt: null, serving: w.serveAt };
    }
    this.walkState = next;
    return next.avatar;
  }
}

function finitePoint(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
