// LocalGameAPI helpers: the tavern (step 9t): serving errands and the tavern calls. Each method takes the API
// instance first and does what the class method of the same name did (R1 split: no change in behaviour).

import {
  gain,
  gainsSince,
  deliverOrder,
  requestServe,
  serveStops,
  cancelServe,
  collectCoins,
  clearDish,
  collectBrew,
  caskViews,
  fillCask,
  collectCask,
  type CaskView,
  startBrew,
  menuRows,
  setMenu,
  collectCook,
  startCook,
  openOrders,
  loadTap,
  unloadTap,
  nextOrder,
  pourOrder,
  pourStop,
  tapFor,
  isDrinkId,
  pourGrade,
  GEMS_GAIN_ID,
  GOLD_GAIN_ID,
  GUEST_SERVE_REACH_PX,
  findPath,
  tavernAppeal,
  buildNavGrid,
  itemBlockers,
  blockRects,
  type GameState,
  type TavernWorld,
  type DrinkId,
  type FoodId,
  type MenuRowView,
  type GainList,
  type MaterialId,
  type TavernClientEvent,
  type TavernView,
  type Point,
} from '@pixel-hotel/shared';
import type { TavernTask } from './apiShared.ts';
import type { LocalGameAPI } from './localGameAPI.ts';

export const tavernApi = {
  async getTavern(h: LocalGameAPI): Promise<TavernView> {
    const t = h.state.tavern;
    const room = h.roomById(t.roomId);
    return structuredClone({ roomId: t.roomId, guests: t.guests, mess: t.mess, serveQueue: t.serveQueue, holding: t.holding, brews: t.brews, cooks: t.cooks, taps: t.taps, casks: t.casks, appeal: room ? tavernAppeal(room, h.state.items) : 0, at: h.now(), introSeen: t.introSeen });
  },

  /** What a guest step needs: the room, its items, the nav grid (rebuilt when the furniture changes) and the seats the player holds. */
  tavernWorld(h: LocalGameAPI, state: GameState): TavernWorld {
    const room = state.rooms.find((r) => r.id === state.tavern.roomId);
    if (!room) throw new Error('tavern room missing');
    h.tavernGrid ??= buildNavGrid(room, [...itemBlockers(state.items, room.id), ...blockRects(room)]);
    // The own avatar's seat in the tavern (guests do not sit there).
    const seated = state.currentRoomId === room.id ? h.walkState.seated : null;
    return { room, items: state.items, grid: h.tavernGrid, playerHere: state.currentRoomId === room.id, seatsTaken: seated ? [seated] : [] };
  },

  onTavern(h: LocalGameAPI, listener: (e: TavernClientEvent) => void): () => void {
    h.tavernListeners.add(listener);
    return () => h.tavernListeners.delete(listener);
  },

  async serveGuest(h: LocalGameAPI, guestId: number): Promise<boolean> {
    if (!h.inTavern()) return false;
    // A drink needs a mug on a tap (step T1): with the taps empty the order stays open and nothing is queued.
    const order = openOrders(h.state.tavern).find((g) => g.id === guestId)?.order;
    if (order && isDrinkId(order.item) && !tapFor(h.state.tavern.taps, order.item)) {
      h.emitTavern({ t: 'tap_empty', guestId, item: order.item });
      return false;
    }
    const next = requestServe(h.state, guestId);
    if (!next) return false;
    h.commit(next);
    h.emitTavern({ t: 'queue', queue: [...next.tavern.serveQueue] });
    if (h.errand || next.tavern.holding) return true; // The queue is worked off after the order the avatar is carrying.
    if (h.nextServe()) return true;
    h.dropServe();
    return false;
  },

  async tidyTable(h: LocalGameAPI, messId: number, what: 'coins' | 'dish'): Promise<boolean> {
    if (!h.inTavern()) return false;
    const mess = h.state.tavern.mess.find((m) => m.id === messId);
    if (!mess || (what === 'coins' ? mess.coins <= 0 : mess.dish === null)) return false;
    // With an order in the hands, or orders queued, serving comes first.
    const t = h.state.tavern;
    if (t.holding || t.serveQueue.length > 0) return false;
    return h.startErrand({ x: mess.x, y: mess.y }, { stage: 'mess', messId, what });
  },

  async collectBrew(h: LocalGameAPI, barrelUid: number): Promise<{ drink: MaterialId; mugs: number; gains: GainList } | null> {
    if (!h.inTavern()) return null;
    const r = collectBrew(h.state, barrelUid, h.now());
    if (!r) return null;
    const gains = gainsSince(h.state, r.state);
    h.commit(r.state);
    return { drink: r.drink, mugs: r.mugs, gains };
  },

  async getCasks(h: LocalGameAPI): Promise<CaskView[]> {
    return caskViews(h.state, h.now());
  },

  async fillCask(h: LocalGameAPI, rackUid: number, slot: number, drink: DrinkId, qty: number): Promise<boolean> {
    if (!h.inTavern()) return false;
    const next = fillCask(h.state, rackUid, slot, drink, qty, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async collectCask(h: LocalGameAPI, rackUid: number, slot: number): Promise<{ item: MaterialId; mugs: number; tier: 'fresh' | 'aged' | 'vintage'; gains: GainList } | null> {
    if (!h.inTavern()) return null;
    const r = collectCask(h.state, rackUid, slot, h.now());
    if (!r) return null;
    const gains = gainsSince(h.state, r.state);
    h.commit(r.state);
    return { item: r.item, mugs: r.mugs, tier: r.tier, gains };
  },

  async startBrew(h: LocalGameAPI, barrelUid: number, drink: DrinkId): Promise<boolean> {
    if (!h.inTavern()) return false;
    const next = startBrew(h.state, barrelUid, drink, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  menuRowViews(h: LocalGameAPI): MenuRowView[] {
    const history = h.state.tavern.history;
    return menuRows(h.state).map((r) => ({ id: r.id, on: r.on, price: r.price, baseValue: r.baseValue, stock: r.stock, history: [...(history[r.id] ?? [])] }));
  },

  async getMenu(h: LocalGameAPI): Promise<MenuRowView[]> {
    return tavernApi.menuRowViews(h);
  },

  async setMenuEntry(h: LocalGameAPI, id: string, change: { on?: boolean; price?: number }): Promise<MenuRowView[] | null> {
    const next = setMenu(h.state, id, change);
    if (!next) return null;
    h.commit(next);
    return tavernApi.menuRowViews(h);
  },

  async markTavernIntroSeen(h: LocalGameAPI): Promise<void> {
    if (h.state.tavern.introSeen) return;
    h.commit({ ...h.state, tavern: { ...h.state.tavern, introSeen: true } });
  },

  async loadTap(h: LocalGameAPI, standUid: number, slot: number, drink: DrinkId, qty: number): Promise<boolean> {
    if (!h.inTavern()) return false;
    const next = loadTap(h.state, standUid, slot, drink, qty, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async unloadTap(h: LocalGameAPI, standUid: number, slot: number, qty: number | 'all'): Promise<boolean> {
    if (!h.inTavern()) return false;
    const next = unloadTap(h.state, standUid, slot, qty, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async startCook(h: LocalGameAPI, stoveUid: number, food: FoodId, qty: number): Promise<boolean> {
    if (!h.inTavern()) return false;
    const next = startCook(h.state, stoveUid, food, qty, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async collectCook(h: LocalGameAPI, stoveUid: number): Promise<{ food: FoodId; qty: number; gains: GainList } | null> {
    if (!h.inTavern()) return null;
    const r = collectCook(h.state, stoveUid, h.now());
    if (!r) return null;
    const gains = gainsSince(h.state, r.state);
    h.commit(r.state);
    return { food: r.food, qty: r.qty, gains };
  },

  inTavern(h: LocalGameAPI): boolean {
    return h.state.currentRoomId === h.state.tavern.roomId;
  },

  /** Walks the own avatar to a spot for an errand. False when there is no way within reach of it. */
  startErrand(h: LocalGameAPI, to: Point, task: TavernTask): boolean {
    const avatar = h.standingAvatar(to);
    const path = findPath(h.grid, avatar, to);
    const end = path?.[path.length - 1];
    if (!path || !end || Math.hypot(end.x - to.x, end.y - to.y) > GUEST_SERVE_REACH_PX) return false;
    h.walkState = { avatar: { ...avatar, state: path.length > 1 ? 'walk' : 'idle' }, path: path.slice(1), at: h.now(), sitOn: null, seated: null, task };
    h.errand = true;
    h.emitTavern({ t: 'walk', path });
    return true;
  },

  /** G2: the player held the pour for heldMs at the taps. The mug comes off the tap; perfect = a small tip on delivery. */
  async pourHeld(h: LocalGameAPI, heldMs: number): Promise<boolean> {
    const w = h.walkState;
    if (!h.inTavern() || !h.errand || w.task?.stage !== 'pourwait' || w.path.length > 0) return false;
    const r = pourOrder(h.state);
    h.walkState = { ...w, task: undefined };
    h.errand = false;
    if (!r) return false;
    if (r.empty) {
      h.commit(r.state);
      h.emitTavern({ t: 'tap_empty', guestId: r.guestId, item: r.item });
      h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
      if (!h.nextServe()) h.dropServe();
      return false;
    }
    const grade = pourGrade(heldMs);
    h.commit({ ...r.state, tavern: { ...r.state.tavern, holding: { guestId: r.guestId, item: r.item, perfect: grade === 'perfect' } } });
    h.emitTavern({ t: 'poured', grade });
    h.emitTavern({ t: 'holding', item: r.item });
    h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
    return true;
  },

  /** G2: the player taps the guest: the avatar carries the mug in its hands to the table. */
  async carryHeld(h: LocalGameAPI): Promise<boolean> {
    const hold = h.state.tavern.holding;
    if (!h.inTavern() || !hold || h.errand) return false;
    const stops = serveStops(h.state, hold.guestId);
    if (stops && h.startErrand(stops.table, { stage: 'table', guestId: hold.guestId })) return true;
    h.dropServe();
    return false;
  },

  /** Starts the next queued order: to the bar. False when nobody waits any more or there is no way. */
  nextServe(h: LocalGameAPI): boolean {
    const t = h.state.tavern;
    const open = openOrders(t).map((g) => g.id);
    const id = t.serveQueue.find((i) => open.includes(i));
    if (id === undefined) return false;
    // A drink whose tap ran empty meanwhile: the order stays open, the guest leaves the queue, the next one is tried (step T1).
    const order = openOrders(t).find((g) => g.id === id)?.order;
    if (order && isDrinkId(order.item) && !tapFor(t.taps, order.item)) {
      h.commit({ ...h.state, tavern: { ...t, serveQueue: t.serveQueue.filter((q) => q !== id) } });
      h.emitTavern({ t: 'tap_empty', guestId: id, item: order.item });
      h.emitTavern({ t: 'queue', queue: [...h.state.tavern.serveQueue] });
      return tavernApi.nextServe(h);
    }
    const stops = serveStops(h.state, id);
    return stops !== null && h.startErrand(stops.bar, { stage: 'bar' });
  },

  /** Forgets the queue and the order in the hands (the orders stay open). */
  dropServe(h: LocalGameAPI): void {
    h.errand = false;
    if (h.state.tavern.serveQueue.length === 0 && h.state.tavern.holding === null) return;
    h.commit(cancelServe(h.state));
    h.emitTavern({ t: 'queue', queue: [] });
    h.emitTavern({ t: 'holding', item: null });
  },

  /** Called every clock tick: an errand that arrived does its job (pick up, put down, collect) and the next one starts. */
  runErrand(h: LocalGameAPI): void {
    if (!h.errand) return;
    h.avatarNow();
    const w = h.walkState;
    // Another kind of walk replaced the errand (a tap on the floor, a seat, another room): forget it.
    if (!w.task) return h.dropServe();
    if (w.path.length > 0) return;
    const task = w.task;
    const now = h.now();
    // G2: the avatar stands at the taps until the player holds the pour (pourHeld); a new walk drops the task.
    if (task.stage === 'pourwait') return;
    h.walkState = { ...w, task: undefined };
    h.errand = false;
    if (task.stage === 'bar') {
      // A drink is poured by hand (step G2): the avatar waits at the taps for pourHeld.
      const next = nextOrder(h.state);
      const stop = next && isDrinkId(next.item) ? pourStop(h.state, next.item) : null;
      if (next && stop) {
        h.walkState = { ...h.walkState, task: { stage: 'pourwait', guestId: next.guestId, item: next.item } };
        h.errand = true;
        h.emitTavern({ t: 'pour_ready', guestId: next.guestId, item: next.item, standUid: stop.stand.uid });
        return;
      }
    }
    if (task.stage === 'bar') {
      const r = pourOrder(h.state);
      if (!r) {
        if (!h.nextServe()) h.dropServe();
        return;
      }
      if (r.empty) {
        h.commit(r.state);
        h.emitTavern({ t: 'tap_empty', guestId: r.guestId, item: r.item });
        h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
        if (!h.nextServe()) h.dropServe();
        return;
      }
      h.commit(r.state);
      h.emitTavern({ t: 'holding', item: r.item });
      h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
      // A drink waits in the hands until the player taps the guest (carryHeld); a dish goes on by itself.
      if (isDrinkId(r.item)) return;
      const stops = serveStops(h.state, r.guestId);
      if (!stops || !h.startErrand(stops.table, { stage: 'table', guestId: r.guestId })) h.dropServe();
    } else if (task.stage === 'table') {
      const spot = serveStops(h.state, task.guestId)?.table;
      const d = deliverOrder(h.state, h.rng);
      if (d && spot) {
        h.commit(d.state);
        h.emitTavern({ t: 'served', guestId: d.guestId, item: d.item, spot });
      } else if (h.state.tavern.holding) {
        h.commit(cancelServe(h.state));
      }
      h.emitTavern({ t: 'holding', item: null });
      if (!h.nextServe()) h.dropServe();
    } else {
      const mess = h.state.tavern.mess.find((m) => m.id === task.messId);
      if (!mess) return;
      const spot = { x: mess.x, y: mess.y };
      if (task.what === 'coins') {
        const r = collectCoins(h.state, task.messId, now);
        if (!r) return;
        h.commit(h.hintDone(r.state, 2)); // quest 3: earn gold by serving a guest
        h.emitTavern({ t: 'collected', messId: task.messId, coins: r.coins, spot, gains: [gain(GOLD_GAIN_ID, r.coins), ...(r.gems > 0 ? [{ itemId: GEMS_GAIN_ID, count: r.gems, rank: 'common' as const }] : [])] });
      } else {
        const next = clearDish(h.state, task.messId);
        if (!next) return;
        h.commit(next);
        h.emitTavern({ t: 'cleared', messId: task.messId, spot });
      }
    }
  },

  emitTavern(h: LocalGameAPI, e: TavernClientEvent): void {
    for (const l of h.tavernListeners) l(e);
  },
};
