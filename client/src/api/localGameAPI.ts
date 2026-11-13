// LocalGameAPI (steps 2-9): runs the shared rules in the browser and saves the whole game state
// through a SaveStorage (localStorage) under a versioned key after every change. It also keeps
// one automatic backup: the save as it was when the game was opened (or before an import).
// Local-only save tools (export, import, restore backup, new game) are in LocalSaves.

import {
  AVATAR_START_FROM_BOTTOM,
  FURNITURE_TYPES,
  PALETTE,
  SAVE_BACKUP_KEY,
  SAVE_VERSION,
  SIT_REACH_PX,
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
  seatFor,
  setHotbarSlot,
  standPointFor,
  startMovePlacing,
  startNewPlacing,
  toSaveText,
  walkAvatar,
  type Avatar,
  type AvatarLook,
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
  type Pose,
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
  /** Sits on this seat when the path ends. */
  sitOn: { uid: number; pose: Pose } | null;
  /** The seat the avatar is sitting on. */
  seatUid: number | null;
}

export class LocalGameAPI implements GameAPI, LocalSaves {
  private state: GameState;
  private walkState: WalkState;
  private grid: NavGrid;
  private debugRects: Rect[] = [];
  private chatId = 0;
  private readonly chatListeners = new Set<(line: ChatLine) => void>();

  private constructor(
    private readonly storage: SaveStorage,
    private readonly now: () => number,
    state: GameState,
  ) {
    this.state = state;
    this.walkState = this.doorWalk();
    this.grid = this.buildGrid();
  }

  /**
   * Opens the saved game (or a new one). `notice` is a message for the player when the save was
   * migrated, damaged or too old.
   */
  static open(storage: SaveStorage, now: () => number = Date.now): { api: LocalGameAPI; notice: string | null } {
    const start = (state: GameState, notice: string | null): { api: LocalGameAPI; notice: string | null } => {
      const api = new LocalGameAPI(storage, now, state);
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
    this.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: this.now(), sitOn: null, seatUid: null };
    return path;
  }

  async sit(uid: number): Promise<SitResult | null> {
    const seat = this.roomItem(uid);
    if (!seat) return null;
    const type = getFurnitureType(seat.typeId);
    if (!type.sittable) return null;
    const front = standPointFor(seat, type);
    const avatar = this.avatarNow();
    const path = findPath(this.grid, avatar, front);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x - front.x, end.y - front.y) > SIT_REACH_PX) return null;
    const pose = seatFor(seat, type);
    this.walkState = { avatar: { ...avatar, state: 'walk' }, path: path.slice(1), at: this.now(), sitOn: { uid, pose }, seatUid: null };
    return { path, seat: pose };
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
    if (!this.roomItem(uid)) return null;
    return this.setItems(pickUpItem(this.state.items, uid));
  }

  async getInventory(): Promise<Inventory> {
    return {
      furniture: this.state.items.filter((i) => i.roomId === null).map((i) => ({ ...i })),
      materials: { ...this.state.player.materials },
      hotbar: [...this.state.hotbar],
    };
  }

  async setHotbarSlot(index: number, typeId: string | null): Promise<(string | null)[]> {
    if (typeId !== null && !FURNITURE_TYPES.some((t) => t.id === typeId)) return [...this.state.hotbar];
    this.commit({ ...this.state, hotbar: setHotbarSlot(this.state.hotbar, index, typeId) });
    return [...this.state.hotbar];
  }

  async setLook(look: AvatarLook): Promise<AvatarLook> {
    const ok = (n: number): boolean => Number.isInteger(n) && n >= 0 && n < PALETTE.length;
    if ([look.skin, look.hair, look.shirt, look.legs, look.shoes].every(ok) && Number.isInteger(look.hairStyle)) {
      this.commit({ ...this.state, look: { ...look } });
    }
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

  async debugGiveTestFurniture(): Promise<void> {
    const home = FURNITURE_TYPES.filter((t) => t.category === 'home_furniture').map((t) => t.id);
    const next = applyChange(this.state, { reason: 'debug', addFurniture: home, note: 'Give test furniture' }, this.now());
    if (next) this.commit(next);
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
  }

  // ---------- inside ----------

  private save(): void {
    this.storage.set(saveKey(), toSaveText(this.state, this.now()));
  }

  private commit(state: GameState): void {
    this.state = state;
    this.save();
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
    return next ? this.setItems(next) : null;
  }

  private setItems(items: FurnitureItem[]): FurnitureItem[] {
    this.commit({ ...this.state, items });
    this.grid = this.buildGrid();
    // The seat moved or was picked up: stand up where you are.
    const w = this.walkState;
    if (w.seatUid !== null) {
      const seat = this.roomItem(w.seatUid);
      const pose = seat && seatFor(seat, getFurnitureType(seat.typeId));
      const a = w.avatar;
      if (!pose || pose.x !== a.x || pose.y !== a.y || pose.facing !== a.facing) {
        this.walkState = { ...w, avatar: { ...a, state: 'idle' }, seatUid: null };
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
      x: room.w / 2,
      y: room.h - AVATAR_START_FROM_BOTTOM,
      facing: 'up',
      state: 'idle',
    };
    return { avatar, path: [], at: this.now(), sitOn: null, seatUid: null };
  }

  /** Where the own avatar is now (it walks by time), and sits down when it reached a seat. */
  private avatarNow(): Avatar {
    const w = this.walkState;
    const now = this.now();
    if (w.avatar.state === 'sit') return w.avatar;
    const r = walkAvatar(w.avatar, w.path, Math.max(0, now - w.at));
    let next: WalkState = { ...w, avatar: r.avatar, path: r.path, at: now };
    if (r.path.length === 0 && w.sitOn) {
      next = { ...next, avatar: { ...r.avatar, ...w.sitOn.pose, state: 'sit' }, sitOn: null, seatUid: w.sitOn.uid };
    }
    this.walkState = next;
    return next.avatar;
  }
}

function finitePoint(p: Point): boolean {
  return Number.isFinite(p.x) && Number.isFinite(p.y);
}
