// LocalGameAPI (steps 2-9): runs the shared rules in the browser and saves the whole game state
// through a SaveStorage (localStorage) under a versioned key after every change. It also keeps
// one automatic backup: the save as it was when the game was opened (or before an import).
// Local-only save tools (export, import, restore backup, new game) are in LocalSaves.
// The tavern runs here too. update() (main.ts calls it every SHOP_TICK_MS through startClock)
// steps the guests in SHOP_TICK_MS steps with the shared rules; a gap longer than
// SHOP_CATCH_UP_GAP_MS (and every time the game opens) is caught up with maths only (catchUpTavern:
// open orders wait, who was eating has paid). Step S1: nobody sells loot to customers any more.

import {
  gainsSince, smelt, buySeeds, openPack, sellSpare, buyBlocks, placeBlock, hitBlock, claimBookReward, fishStep,
  hitPlant, plantSeed, spliceSeed, buyGear, SHOP_CATCH_UP_GAP_MS, SHOP_TICK_MS, applyStyle, paintFloor, buyCatalog,
  catchUpTavern, stepTavern, collectBrew, upgradeRoom,
  configForChoice, SAVE_BACKUP_KEY, SAVE_VERSION, applyChange, cleanChatText, createNewPlayer, pickUpItem, readSave,
  saveKey, arrangeState, hotbarToBag, moveSlot, toSaveText, type BookClaim, type GainList, type BarId, type GearId,
  type PackOpenResult, type BlockResult, type CastPlan, type ChopUpdate, type FishInput, type FishSession,
  type FishUpdate, type LakesideView, type BookTab, type FarmView, type FoodId, type SeedId, type DungeonInput,
  type DungeonRun, type RunUpdate, type RunView, type ShopGearId, type MaterialId, type TavernClientEvent,
  type TavernEvent, type TavernView, type TavernWorld, type TapView, type DrinkId, type MenuRowView, type SellKind, type SellResult, type SellRow, type BuyResult,
  type StyleKind, type Rng, type NewPlayerChoice, type ServeResult,
  type Avatar, type AvatarLook, type BagTab, type SlotLayout, type SlotRef, type ChatLine, type FurnitureItem,
  type GameAPI, type GameState, type Inventory, type ItemsResult, type NavGrid, type PlaceAt, type PlacingSession,
  type Player, type Point, type Rect, type Room, type RoomState, type SitResult,
} from '@pixel-hotel/shared';
import type { SaveStorage } from './saveStorage.ts';
import { type SaveResult, type TavernTask, type WalkState } from './apiShared.ts';
import { walkApi } from './walkApi.ts';
import { roomsApi } from './roomsApi.ts';
import { catalogApi } from './catalogApi.ts';
import { blocksFarmApi } from './blocksFarmApi.ts';
import { dungeonApi } from './dungeonApi.ts';
import { lakesideApi } from './lakesideApi.ts';
import { packsApi } from './packsApi.ts';
import { traderApi } from './traderApi.ts';
import { progressApi } from './progressApi.ts';
import { savesApi } from './savesApi.ts';
import { tavernApi } from './tavernApi.ts';

export type { SaveResult, TavernTask } from './apiShared.ts';
export { problemMessage } from './savesApi.ts';

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

export class LocalGameAPI implements GameAPI, LocalSaves {
  state: GameState;
  walkState: WalkState;
  grid: NavGrid;
  debugRects: Rect[] = [];
  chatId = 0;
  readonly chatListeners = new Set<(line: ChatLine) => void>();
  readonly tavernListeners = new Set<(e: TavernClientEvent) => void>();
  /** True while the own avatar is on a tavern errand (walkState.task); a walk of any other kind ends it. */
  errand = false;
  /** The tavern's navigation grid (guests), rebuilt when its furniture changes. */
  tavernGrid: NavGrid | null = null;
  clock = 0;
  /** A run loaded from a save waits for dungeonResume (the player taps Resume). */
  runPaused: boolean;
  /** Run time of the last run save. */
  runSavedAt = 0;

  private constructor(
    readonly storage: SaveStorage,
    readonly now: () => number,
    state: GameState,
    readonly rng: Rng,
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
        const kitchen = r.kitchenChanged
          ? ` Cooking has moved: you cook on a stove in your tavern now (the farm has no pot any more).${r.state.items.some((i) => i.typeId === 'stove' && i.roomId === null) ? ' A stove is in your bag: place it in the tavern.' : ''}`
          : '';
        const closed = r.shopClosed ? ' Nobody buys loot at a stall any more: goods that were on your stall are back in your bag, and stalls, shelves and cases are decor. Earn gold by serving guests in your tavern.' : '';
        return start(r.state, `Your save was updated to the new version of the game.${extra}${farm}${kitchen}${closed}`);
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
    this.tavernGrid = null;
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

  async enterRoom(roomId: number): Promise<RoomState> { return roomsApi.enterRoom(this, roomId); }
  async walk(to: Point): Promise<Point[] | null> { return walkApi.walk(this, to); }
  async sit(uid: number, tap?: Point): Promise<SitResult | null> { return walkApi.sit(this, uid, tap); }
  async serve(uid: number): Promise<ServeResult | null> { return walkApi.serve(this, uid); }

  async getItems(): Promise<FurnitureItem[]> { return roomsApi.getItems(this); }
  async placeItem(uid: number, at: PlaceAt): Promise<ItemsResult> { return roomsApi.placeItem(this, uid, at); }
  async moveItem(uid: number, at: PlaceAt): Promise<ItemsResult> { return roomsApi.moveItem(this, uid, at); }
  async rotateItem(uid: number): Promise<ItemsResult> { return roomsApi.rotateItem(this, uid); }
  async pickUpItem(uid: number): Promise<ItemsResult> { return roomsApi.pickUpItem(this, uid); }
  async getInventory(): Promise<Inventory> { return roomsApi.getInventory(this); }
  async moveSlot(from: SlotRef, to: SlotRef): Promise<SlotLayout | null> { return roomsApi.moveSlot(this, from, to); }
  async hotbarToBag(index: number): Promise<SlotLayout | null> { return roomsApi.hotbarToBag(this, index); }
  async tidyBag(tab: BagTab, how: 'sort' | 'stack'): Promise<SlotLayout> { return roomsApi.tidyBag(this, tab, how); }
  async setLook(look: AvatarLook): Promise<AvatarLook> { return roomsApi.setLook(this, look); }

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

  // ---------- Catalog and rooms (step 7) ----------

  async buyCatalog(typeId: string): Promise<BuyResult | null> { return catalogApi.buyCatalog(this, typeId); }
  async buyStyle(kind: StyleKind, id: string): Promise<boolean> { return roomsApi.buyStyle(this, kind, id); }
  async applyStyle(roomId: number, kind: StyleKind, id: string): Promise<Room | null> { return roomsApi.applyStyle(this, roomId, kind, id); }
  async paintFloor(roomId: number, from: { c: number; r: number }, to: { c: number; r: number }, id: string): Promise<Room | null> { return roomsApi.paintFloor(this, roomId, from, to, id); }
  async placeBlock(c: number, r: number, blockId: string): Promise<BlockResult> { return blocksFarmApi.placeBlock(this, c, r, blockId); }
  async hitBlock(c: number, r: number): Promise<BlockResult> { return blocksFarmApi.hitBlock(this, c, r); }
  async buyBlocks(blockId: string, qty: number): Promise<GainList | null> { return blocksFarmApi.buyBlocks(this, blockId, qty); }
  async upgradeRoom(roomId: number): Promise<Room | null> { return roomsApi.upgradeRoom(this, roomId); }
  async getRoom(roomId: number): Promise<Room | null> { return roomsApi.getRoom(this, roomId); }
  async currentHint(): Promise<string | null> { return progressApi.currentHint(this); }

  // ---------- The dungeon (step 9) ----------

  async getRun(): Promise<RunView | null> { return dungeonApi.getRun(this); }
  async dungeonStart(lunch: readonly FoodId[] = []): Promise<DungeonRun | null> { return dungeonApi.dungeonStart(this, lunch); }
  async dungeonInput(input: DungeonInput): Promise<RunUpdate | null> { return dungeonApi.dungeonInput(this, input); }
  async dungeonAdvance(dtMs: number): Promise<RunUpdate | null> { return dungeonApi.dungeonAdvance(this, dtMs); }
  async dungeonPause(): Promise<void> { return dungeonApi.dungeonPause(this); }
  async dungeonResume(): Promise<void> { return dungeonApi.dungeonResume(this); }
  async craft(recipeId: string): Promise<GainList | null> { return dungeonApi.craft(this, recipeId); }
  async buyGear(id: ShopGearId): Promise<GainList | null> { return dungeonApi.buyGear(this, id); }

  // ---------- The mine and the forge (step 9c) ----------

  async mineStart(): Promise<DungeonRun | null> { return dungeonApi.mineStart(this); }
  async smelt(bar: BarId): Promise<GainList | null> { return dungeonApi.smelt(this, bar); }
  async forge(piece: GearId): Promise<GainList | null> { return dungeonApi.forge(this, piece); }

  // ---------- The farm and cooking (step 9b) ----------

  async getFarm(): Promise<FarmView> { return blocksFarmApi.getFarm(this); }
  async plantSeed(c: number, r: number, seed: SeedId): Promise<BlockResult> { return blocksFarmApi.plantSeed(this, c, r, seed); }
  async hitPlant(c: number, r: number): Promise<BlockResult> { return blocksFarmApi.hitPlant(this, c, r); }
  async spliceSeed(c: number, r: number, seed: SeedId): Promise<BlockResult> { return blocksFarmApi.spliceSeed(this, c, r, seed); }
  async openPack(packId: string): Promise<PackOpenResult | null> { return packsApi.openPack(this, packId); }
  async sellSpare(clothingId: string, qty: number): Promise<number | null> { return packsApi.sellSpare(this, clothingId, qty); }
  async getSellRows(): Promise<SellRow[]> { return traderApi.getSellRows(this); }
  async sell(kind: SellKind, id: string, qty: number): Promise<SellResult | null> { return traderApi.sell(this, kind, id, qty); }
  async buySeeds(seed: SeedId, qty: number): Promise<GainList | null> { return blocksFarmApi.buySeeds(this, seed, qty); }

  // ---------- The tavern (step 9t) ----------

  async getTavern(): Promise<TavernView> { return tavernApi.getTavern(this); }
  onTavern(listener: (e: TavernClientEvent) => void): () => void { return tavernApi.onTavern(this, listener); }

  async serveGuest(guestId: number): Promise<boolean> { return tavernApi.serveGuest(this, guestId); }
  async tidyTable(messId: number, what: 'coins' | 'dish'): Promise<boolean> { return tavernApi.tidyTable(this, messId, what); }
  async collectBrew(barrelUid: number): Promise<{ drink: MaterialId; mugs: number; gains: GainList } | null> { return tavernApi.collectBrew(this, barrelUid); }
  async startBrew(barrelUid: number, drink: DrinkId): Promise<boolean> { return tavernApi.startBrew(this, barrelUid, drink); }
  async getMenu(): Promise<MenuRowView[]> { return tavernApi.getMenu(this); }
  async setMenuEntry(id: string, change: { on?: boolean; price?: number }): Promise<MenuRowView[] | null> { return tavernApi.setMenuEntry(this, id, change); }
  async markTavernIntroSeen(): Promise<void> { return tavernApi.markTavernIntroSeen(this); }
  async markTapsIntroSeen(): Promise<void> { return tavernApi.markTapsIntroSeen(this); }
  async getTaps(): Promise<TapView[]> { return tavernApi.getTaps(this); }
  async loadTap(standUid: number, slot: number, drink: DrinkId, qty: number): Promise<TapView[] | null> { return tavernApi.loadTap(this, standUid, slot, drink, qty); }
  async unloadTap(standUid: number, slot: number, qty?: number): Promise<TapView[] | null> { return tavernApi.unloadTap(this, standUid, slot, qty); }
  async startCook(stoveUid: number, food: FoodId, qty: number): Promise<boolean> { return tavernApi.startCook(this, stoveUid, food, qty); }
  async collectCook(stoveUid: number): Promise<{ food: FoodId; qty: number; gains: GainList } | null> { return tavernApi.collectCook(this, stoveUid); }
  inTavern(): boolean { return tavernApi.inTavern(this); }

  startErrand(to: Point, task: TavernTask): boolean { return tavernApi.startErrand(this, to, task); }

  nextServe(): boolean { return tavernApi.nextServe(this); }

  dropServe(): void { return tavernApi.dropServe(this); }

  runErrand(): void { return tavernApi.runErrand(this); }

  async getLakeside(): Promise<LakesideView> { return lakesideApi.getLakeside(this); }
  async chopTree(index: number): Promise<ChopUpdate | null> { return lakesideApi.chopTree(this, index); }
  async castAt(target: Point): Promise<CastPlan | null> { return lakesideApi.castAt(this, target); }
  async fishStart(): Promise<FishSession | null> { return lakesideApi.fishStart(this); }
  async fishStep(inputs: readonly FishInput[], dtMs: number): Promise<FishUpdate | null> { return lakesideApi.fishStep(this, inputs, dtMs); }
  async fishStop(): Promise<void> { return lakesideApi.fishStop(this); }
  async bookOpened(): Promise<void> { return progressApi.bookOpened(this); }
  async claimBookReward(tab: BookTab, percent: number): Promise<BookClaim | null> { return progressApi.claimBookReward(this, tab, percent); }

  /** Saves a new state and returns what it gave (the items the ledger wrote since the old state). */
  commitGains(next: GameState): GainList {
    const gains = gainsSince(this.state, next);
    this.commit(next);
    return gains;
  }

  /** A fishing line that is cast (not saved: a reload loses it, and nothing is lost with it). */
  fish: FishSession | null = null;

  lakesideView(): LakesideView { return lakesideApi.lakesideView(this); }

  farmView(): FarmView { return blocksFarmApi.farmView(this); }

  applyRun(next: DungeonRun): RunUpdate { return dungeonApi.applyRun(this, next); }

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
    if (now - this.state.tavern.updatedAt > SHOP_CATCH_UP_GAP_MS) {
      this.catchUp();
      this.save();
      this.emitTavern({ t: 'guests', guests: this.state.tavern.guests });
      return;
    }
    const tavernEvents: TavernEvent[] = [];
    let s = this.state;
    // The guests (step 9t) step on the tavern's clock.
    while (s.tavern.updatedAt + SHOP_TICK_MS <= now) {
      const at = s.tavern.updatedAt + SHOP_TICK_MS;
      const r = stepTavern(s, this.tavernWorld(s), SHOP_TICK_MS, this.rng, at);
      s = r.state;
      tavernEvents.push(...r.events);
    }
    if (s === this.state) return;
    // Only events change what is worth saving; walking positions are not saved every step.
    if (tavernEvents.length > 0) this.commit(s);
    else this.state = s;
    for (const e of tavernEvents) this.emitTavern(e);
  }

  /** Debug (Blockers mode): rectangles that block walking in the current room (not saved). */
  debugSetBlockers(rects: readonly Rect[]): void {
    this.debugRects = rects.map((r) => ({ ...r }));
    this.grid = this.buildGrid();
  }

  // ---------- LocalSaves ----------

  exportSave(): string { return savesApi.exportSave(this); }

  importSave(text: string): SaveResult { return savesApi.importSave(this, text); }

  hasBackup(): boolean { return savesApi.hasBackup(this); }

  restoreBackup(): SaveResult { return savesApi.restoreBackup(this); }

  newGame(): void { return savesApi.newGame(this); }

  // ---------- inside ----------

  save(): void {
    this.storage.set(saveKey(), toSaveText(this.state, this.now()));
  }

  commit(state: GameState): void {
    this.state = arrangeState(state);
    this.save();
  }

  emitTavern(e: TavernClientEvent): void { return tavernApi.emitTavern(this, e); }

  hintDone(state: GameState, index: number): GameState { return progressApi.hintDone(this, state, index); }

  /** Gains nobody has been told about yet (quest gems, step BG4). */
  pendingGains: GainList = [];

  async takeGains(): Promise<GainList> { return progressApi.takeGains(this); }
  roomById(roomId: number): Room | null { return roomsApi.roomById(this, roomId); }

  /** The gap is done with maths (catchUpTavern): open orders wait, who was eating has paid. */
  catchUp(): void {
    this.state = catchUpTavern(this.state, this.tavernWorld(this.state), this.now(), this.rng).state;
    this.errand = false;
  }

  tavernWorld(state: GameState): TavernWorld { return tavernApi.tavernWorld(this, state); }

  layout(): SlotLayout { return roomsApi.layout(this); }

  setLayout(l: SlotLayout | null): SlotLayout | null { return roomsApi.setLayout(this, l); }

  room(): Room { return roomsApi.room(this); }

  roomItem(uid: number): FurnitureItem | undefined { return roomsApi.roomItem(this, uid); }

  visibleItems(): FurnitureItem[] { return roomsApi.visibleItems(this); }

  validAt(typeId: string, at: PlaceAt): boolean { return roomsApi.validAt(this, typeId, at); }

  place(s: PlacingSession, snap: boolean): ItemsResult { return roomsApi.place(this, s, snap); }

  setItems(items: FurnitureItem[]): FurnitureItem[] { return roomsApi.setItems(this, items); }

  /** The last block punch (ms), for the cooldown. Not saved. */
  lastBlockHitAt = -Infinity;

  standingPoints(): Point[] { return walkApi.standingPoints(this); }

  walkCloser(me: Avatar, c: number, r: number): BlockResult { return blocksFarmApi.walkCloser(this, me, c, r); }

  commitBlocks(next: GameState): void { return blocksFarmApi.commitBlocks(this, next); }

  buildGrid(): NavGrid { return roomsApi.buildGrid(this); }

  doorWalk(): WalkState { return walkApi.doorWalk(this); }

  standingAvatar(toward: Point): Avatar { return walkApi.standingAvatar(this, toward); }

  avatarNow(): Avatar { return walkApi.avatarNow(this); }
}
