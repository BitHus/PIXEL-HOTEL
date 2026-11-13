// LocalGameAPI (steps 2-9): runs the shared rules in the browser and saves the whole game state
// through a SaveStorage (localStorage) under a versioned key after every change. It also keeps
// one automatic backup: the save as it was when the game was opened (or before an import).
// Local-only save tools (export, import, restore backup, new game) are in LocalSaves.
// Step 7: the shop runs here too. update() (main.ts calls it every SHOP_TICK_MS through
// startClock) steps the walking customers in SHOP_TICK_MS steps with the shared rules; a gap
// longer than SHOP_CATCH_UP_GAP_MS (and every time the game opens) is caught up with maths only
// (catchUpShop: at most 8 hours), and what sold is kept for the "while you were away" summary.

import {
  AVATAR_START_FROM_BOTTOM,
  DUNGEON_HINT,
  HINTS,
  RECIPES,
  RUN_SAVE_EVERY_MS,
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
  SHOP_TICK_MS,
  applyStyle,
  buyCatalog,
  canPickUp,
  catchUpShop,
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
  type AwaySummary,
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
}

export class LocalGameAPI implements GameAPI, LocalSaves {
  private state: GameState;
  private walkState: WalkState;
  private grid: NavGrid;
  private debugRects: Rect[] = [];
  private chatId = 0;
  private readonly chatListeners = new Set<(line: ChatLine) => void>();
  private readonly shopListeners = new Set<(e: ShopEvent) => void>();
  /** The shop room's navigation grid (customers), rebuilt when its furniture changes. */
  private shopGrid: NavGrid | null = null;
  private away: AwaySummary | null = null;
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
      if (r.ok) return start(r.state, 'Your save was updated to the new version of the game.');
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
    this.away = null;
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
    const avatar = this.avatarNow();
    const path = findPath(this.grid, avatar, to);
    if (!path) return null;
    this.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seated: null };
    return path;
  }

  async sit(uid: number, tap?: Point): Promise<SitResult | null> {
    const item = this.roomItem(uid);
    if (!item || (tap !== undefined && !finitePoint(tap))) return null;
    const type = getFurnitureType(item.typeId);
    const avatar = this.avatarNow();
    // Seats taken by other avatars (only the own avatar exists until step 10).
    const taken: number[] = [];
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
    const avatar = this.avatarNow();
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
    this.commit(this.hintDone(next, 0));
    return { uid, first };
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
    if (i === DUNGEON_HINT) return !this.state.run && !this.state.shop.slots.some((s) => s.loot) ? (HINTS[i] ?? null) : null;
    return HINTS[i] ?? null;
  }

  async takeAwaySummary(): Promise<AwaySummary | null> {
    const a = this.away;
    this.away = null;
    return a;
  }

  // ---------- The dungeon (step 9) ----------

  async getRun(): Promise<RunView | null> {
    const run = this.state.run;
    return run ? { run, paused: this.runPaused } : null;
  }

  async dungeonStart(): Promise<DungeonRun | null> {
    if (this.state.run) return null;
    const seed = rngInt(this.rng, 1, 2 ** 31 - 1);
    const r = startRun(this.state, seed, this.now());
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
    if (this.runPaused || !(dtMs > 0)) return { run, result: null };
    return this.applyRun(step(run, [], dtMs, this.rng));
  }

  async dungeonPause(): Promise<void> {
    if (this.state.run) this.runPaused = true;
  }

  async dungeonResume(): Promise<void> {
    this.runPaused = false;
  }

  async craft(recipeId: string): Promise<boolean> {
    const recipe = RECIPES.find((r) => r.id === recipeId);
    const next = recipe ? craftRecipe(recipe, this.state, this.now()) : null;
    if (!next) return false;
    this.commit(next);
    return true;
  }

  async buyGear(id: ShopGearId): Promise<boolean> {
    const next = buyGear(this.state, id, this.now());
    if (!next) return false;
    this.commit(next);
    return true;
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
        banked: next.banked,
        lost: next.lost,
        xpGained: next.xpGained,
        levelBefore: before.level,
        levelAfter: banked.player.level,
        floor: next.floor,
        lastHitBy: next.lastHitBy,
      };
      return { run: next, result };
    }
    const worth = next.events.some((e) => e.t !== 'windup') || next.status !== this.state.run?.status;
    if (worth || next.timeMs - this.runSavedAt >= RUN_SAVE_EVERY_MS) {
      this.runSavedAt = next.timeMs;
      this.commit({ ...this.state, run: next });
    } else {
      this.state = { ...this.state, run: next };
    }
    return { run: next, result: null };
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
    const shop = this.state.shop;
    if (now - shop.updatedAt > SHOP_CATCH_UP_GAP_MS) {
      this.catchUp();
      this.save();
      this.emit({ t: 'customers', customers: [] });
      this.emit({ t: 'slots' });
      return;
    }
    const events: ShopEvent[] = [];
    let s = this.state;
    while (s.shop.updatedAt + SHOP_TICK_MS <= now) {
      const at = s.shop.updatedAt + SHOP_TICK_MS;
      const r = stepShop(s, this.shopWorld(s), SHOP_TICK_MS, this.rng, at);
      s = { ...r.state, shop: { ...r.state.shop, updatedAt: at } };
      events.push(...r.events);
    }
    if (s === this.state) return;
    // Only events change what is worth saving; walking positions are not saved every step.
    if (events.length > 0) this.commit(s);
    else this.state = s;
    for (const e of events) this.emit(e);
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

  /** Marks hint `index` done when it is the one showing (hints go one at a time). */
  private hintDone(state: GameState, index: number): GameState {
    return state.hintsDone === index ? { ...state, hintsDone: index + 1 } : state;
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
    this.shopGrid ??= buildNavGrid(room, itemBlockers(state.items, room.id));
    return { room, items: state.items, grid: this.shopGrid, cashier: this.isServing() };
  }

  /** Customers pay at once and the gap is done with maths (catchUpShop); keeps the summary. */
  private catchUp(): void {
    const r = catchUpShop(this.state, this.now(), this.rng);
    this.state = r.state;
    if (r.sales.length === 0) return;
    const was = this.away;
    this.away = was
      ? { simulatedMs: was.simulatedMs + r.simulatedMs, sales: [...was.sales, ...r.sales], total: was.total + r.total }
      : { simulatedMs: r.simulatedMs, sales: r.sales, total: r.total };
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
    let next = returnOrphanLoot({ ...this.state, items }, this.now());
    if (this.state.currentRoomId === next.shop.roomId) {
      this.shopGrid = null;
      next = repathCustomers(next, this.shopWorld(next));
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

  private buildGrid(): NavGrid {
    return buildNavGrid(this.room(), [...this.debugRects, ...itemBlockers(this.state.items, this.state.currentRoomId)]);
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
