// LocalGameAPI helpers: rooms and furniture. Each method takes the API instance first and does what the
// class method of the same name did (R1 split: no change in behaviour; the class delegates here).

import {
  emoteAllowed,
  emoteAfterState,
  emoteAt,
  startEmote,
  type ActiveEmote,
  innTravel,
  type Avatar,
  applyStyle,
  paintFloor,
  canPickUp,
  repathGuests,
  returnOrphanBrews,
  returnOrphanTaps,
  returnOrphanCasks,
  returnOrphanCooks,
  unlockStyle,
  upgradeRoom,
  lookAllowed,
  drawnLook,
  buildWalkGrid,
  confirmPlacing,
  getFurnitureType,
  pickUpItem,
  rotateInPlace,
  onSeat,
  standUpSpot,
  hotbarToBag,
  moveSlot,
  sortBag,
  stackBag,
  startMovePlacing,
  startNewPlacing,
  type StyleKind,
  type AvatarLook,
  type BagTab,
  type SlotLayout,
  type SlotRef,
  type FurnitureItem,
  type Inventory,
  type ItemsResult,
  type NavGrid,
  type PlaceAt,
  type PlacingSession,
  type Room,
  type RoomState,
} from '@pixel-hotel/shared';
import { finitePoint } from './apiShared.ts';
import type { LocalGameAPI } from './localGameAPI.ts';

export const roomsApi = {
  async enterRoom(h: LocalGameAPI, roomId: number): Promise<RoomState> {
    const room = h.state.rooms.find((r) => r.id === roomId);
    if (!room) throw new Error(`no room ${roomId}`);
    if (h.state.currentRoomId !== roomId) h.commit({ ...h.state, currentRoomId: roomId });
    h.debugRects = [];
    h.fish = null;
    h.walkState = h.doorWalk();
    h.grid = h.buildGrid();
    return {
      room: { ...room },
      items: h.state.items.filter((i) => i.roomId === roomId).map((i) => ({ ...i })),
      avatars: [{ ...h.walkState.avatar }],
    };
  },

  async useDoor(h: LocalGameAPI, doorId: string): Promise<RoomState | null> {
    if (h.fish !== null) return null;
    const trip = innTravel(h.state, h.state.currentRoomId, doorId);
    if (!trip) return null;
    const room = h.state.rooms.find((r) => r.id === trip.roomId);
    if (!room) return null;
    h.commit({ ...h.state, currentRoomId: trip.roomId });
    h.debugRects = [];
    const p = h.state.player;
    const avatar: Avatar = { id: p.id, name: p.name, look: { ...h.state.look }, roomId: room.id, x: trip.point.x, y: trip.point.y, facing: trip.facing, state: 'walk' };
    h.walkState = { avatar, path: [trip.stepTo], at: h.now(), sitOn: null, seated: null };
    h.grid = h.buildGrid();
    return {
      room: { ...room },
      items: h.state.items.filter((i) => i.roomId === room.id).map((i) => ({ ...i })),
      avatars: [{ ...h.walkState.avatar }],
    };
  },

  async getItems(h: LocalGameAPI): Promise<FurnitureItem[]> {
    return h.visibleItems();
  },

  async placeItem(h: LocalGameAPI, uid: number, at: PlaceAt): Promise<ItemsResult> {
    const item = h.state.items.find((i) => i.uid === uid && i.roomId === null);
    if (!item || !h.validAt(item.typeId, at)) return null;
    const s: PlacingSession = { ...startNewPlacing(item.typeId, at.center, uid), facing: at.facing };
    return h.place(s, at.snap);
  },

  async moveItem(h: LocalGameAPI, uid: number, at: PlaceAt): Promise<ItemsResult> {
    const item = h.roomItem(uid);
    if (!item || !h.validAt(item.typeId, at)) return null;
    const s: PlacingSession = { ...startMovePlacing(item), center: at.center, facing: at.facing };
    return h.place(s, at.snap);
  },

  async rotateItem(h: LocalGameAPI, uid: number): Promise<ItemsResult> {
    const next = rotateInPlace(h.room(), h.state.items, uid);
    return next ? h.setItems(next) : null;
  },

  async pickUpItem(h: LocalGameAPI, uid: number): Promise<ItemsResult> {
    const item = h.roomItem(uid);
    // The counter is never picked up (there is always exactly one).
    if (!item || !canPickUp(item, h.state.items)) return null;
    return h.setItems(pickUpItem(h.state.items, uid));
  },

  async getInventory(h: LocalGameAPI): Promise<Inventory> {
    return {
      furniture: h.state.items.filter((i) => i.roomId === null).map((i) => ({ ...i })),
      materials: { ...h.state.player.materials },
      hotbar: [...h.state.hotbar],
      bag: structuredClone(h.state.bag),
    };
  },

  async moveSlot(h: LocalGameAPI, from: SlotRef, to: SlotRef): Promise<SlotLayout | null> {
    return h.setLayout(moveSlot(h.layout(), from, to));
  },

  async hotbarToBag(h: LocalGameAPI, index: number): Promise<SlotLayout | null> {
    return h.setLayout(hotbarToBag(h.layout(), index));
  },

  async tidyBag(h: LocalGameAPI, tab: BagTab, how: 'sort' | 'stack'): Promise<SlotLayout> {
    const l = h.layout();
    if (tab !== 'furniture' && tab !== 'materials') return l;
    return h.setLayout(how === 'sort' ? sortBag(l, tab) : stackBag(l, tab)) ?? l;
  },

  async emote(h: LocalGameAPI, kind: string): Promise<ActiveEmote | null> {
    const e = emoteAllowed(h.walkState.avatar.state) ? startEmote(kind, h.now()) : null;
    h.emoteNow = e;
    return e;
  },

  async currentEmote(h: LocalGameAPI): Promise<ActiveEmote | null> {
    h.emoteNow = emoteAfterState(emoteAt(h.emoteNow, h.now()), h.walkState.avatar.state);
    return h.emoteNow;
  },

  async setLook(h: LocalGameAPI, look: AvatarLook): Promise<AvatarLook> {
    // Free or unlocked clothing and colours from the lists only (step 7b).
    const drawn = drawnLook(look);
    if (lookAllowed(drawn, h.state.player.unlockedClothing)) h.commit({ ...h.state, look: { ...drawn } });
    return { ...h.state.look };
  },

  async buyStyle(h: LocalGameAPI, kind: StyleKind, id: string): Promise<boolean> {
    const next = unlockStyle(h.state, kind, id, h.now());
    if (!next) return false;
    // A style as the first buy counts for the first hint, and skips the second (nothing to place).
    h.commit(h.state.hintsDone === 0 ? { ...next, hintsDone: 2 } : next);
    return true;
  },

  async applyStyle(h: LocalGameAPI, roomId: number, kind: StyleKind, id: string): Promise<Room | null> {
    const next = applyStyle(h.state, roomId, kind, id);
    if (!next) return null;
    h.commit(next);
    return h.roomById(roomId);
  },

  async paintFloor(h: LocalGameAPI, roomId: number, from: { c: number; r: number }, to: { c: number; r: number }, id: string): Promise<Room | null> {
    const next = paintFloor(h.state, roomId, from, to, id);
    if (!next) return null;
    h.commit(next);
    return h.roomById(roomId);
  },

  async upgradeRoom(h: LocalGameAPI, roomId: number): Promise<Room | null> {
    const next = upgradeRoom(h.state, roomId, h.now());
    if (!next) return null;
    h.commit(next);
    h.grid = h.buildGrid();
    h.tavernGrid = null;
    return h.roomById(roomId);
  },

  async getRoom(h: LocalGameAPI, roomId: number): Promise<Room | null> {
    return h.roomById(roomId);
  },

  room(h: LocalGameAPI): Room {
    const room = h.state.rooms.find((r) => r.id === h.state.currentRoomId);
    if (!room) throw new Error('current room missing');
    return room;
  },

  roomById(h: LocalGameAPI, roomId: number): Room | null {
    const r = h.state.rooms.find((x) => x.id === roomId);
    return r ? { ...r } : null;
  },

  roomItem(h: LocalGameAPI, uid: number): FurnitureItem | undefined {
    return h.state.items.find((i) => i.uid === uid && i.roomId === h.state.currentRoomId);
  },

  visibleItems(h: LocalGameAPI): FurnitureItem[] {
    const id = h.state.currentRoomId;
    return h.state.items.filter((i) => i.roomId === id || i.roomId === null).map((i) => ({ ...i }));
  },

  validAt(h: LocalGameAPI, typeId: string, at: PlaceAt): boolean {
    return finitePoint(at.center) && getFurnitureType(typeId).facings.includes(at.facing);
  },

  place(h: LocalGameAPI, s: PlacingSession, snap: boolean): ItemsResult {
    const p = h.state.player;
    // Only inventory items are placed, so no new uid is ever needed.
    const next = confirmPlacing(h.room(), h.state.items, s, { ownerId: p.id, newUid: () => h.state.nextUid }, snap);
    if (!next) return null;
    // Hint 2: place something (after buying it).
    if (!s.origin) h.state = h.hintDone(h.state, 1);
    return h.setItems(next);
  },

  setItems(h: LocalGameAPI, items: FurnitureItem[]): FurnitureItem[] {
    // A barrel or stove that left the tavern gives its crops back to the bag.
    let next = returnOrphanCasks(returnOrphanTaps(returnOrphanCooks(returnOrphanBrews({ ...h.state, items }, h.now()), h.now()), h.now()), h.now());
    if (h.state.currentRoomId === next.tavern.roomId) {
      h.tavernGrid = null;
      next = repathGuests(next, h.tavernWorld(next));
    }
    h.commit(next);
    h.grid = h.buildGrid();
    // The seat moved or was picked up: stand up next to it on a free spot.
    h.avatarNow();
    const w = h.walkState;
    if (w.seated !== null) {
      const item = h.roomItem(w.seated.uid);
      const a = w.avatar;
      if (!onSeat(a, item, item && getFurnitureType(item.typeId), w.seated.index)) {
        const spot = standUpSpot(h.grid, a);
        h.walkState = { ...w, avatar: { ...a, ...spot, state: 'idle' }, seated: null };
      }
    }
    return h.visibleItems();
  },

  layout(h: LocalGameAPI): SlotLayout {
    return structuredClone({ hotbar: h.state.hotbar, bag: h.state.bag });
  },

  setLayout(h: LocalGameAPI, l: SlotLayout | null): SlotLayout | null {
    if (!l) return null;
    h.commit({ ...h.state, hotbar: l.hotbar, bag: l.bag });
    return h.layout();
  },

  buildGrid(h: LocalGameAPI): NavGrid {
    // The furniture plus fixed blockers (the lakeside's water and trees), plants; ST3: blocks are walkable cells with a level.
    return buildWalkGrid(h.room(), h.state.items, h.debugRects);
  },
};
