// LocalGameAPI helpers: the tavern (step 9t): serving errands and the tavern calls. Each method takes the API
// instance first and does what the class method of the same name did (R1 split: no change in behaviour).

import {
  TALK_CHANCE,
  sayFrom,
  talkChance,
  gain,
  gainsSince,
  deliverOrder,
  handOver,
  grabAll,
  serveRoute,
  barServePoint,
  requestServe,
  serveStops,
  cancelServe,
  collectCoins,
  clearDish,
  collectBrew,
  caskViews,
  rackTierCap,
  getFurnitureType,
  type DrinkTier,
  fillCask,
  collectCask,
  type CaskView,
  startBrew,
  menuRows,
  setMenu,
  setTavernOpen,
  tavernOpen,
  collectCook,
  startCook,
  openOrders,
  loadTap,
  unloadTap,
  nextOrder,
  pourOrder,
  pourStop,
  returnTray,
  guestsTrayCanServe,
  tapFor,
  isDrinkId,
  pourGrade,
  bonusesOf,
  pourHeldClamp,
  GEMS_GAIN_ID,
  GOLD_GAIN_ID,
  GUEST_SERVE_REACH_PX,
  findPath,
  tavernAppeal,
  buildNavGrid,
  roomBlockers,
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
  tavernWorkRoomIds,
} from '@pixel-hotel/shared';
import type { TavernTask } from './apiShared.ts';
import type { LocalGameAPI } from './localGameAPI.ts';

/** CEL-2: the ids of the attached kitchen and cellar rooms. */
const attachedRooms = (s: GameState): number[] => tavernWorkRoomIds(s).filter((id) => id !== s.tavern.roomId);

export const tavernApi = {
  /**
   * Auto-collect (owner 17 Nov, OWN-4 c): EVERY table spot with coins, a gem tip or an empty mug is paid out and cleared at once
   * (same ledger reason as the tap; the 'collected' and 'cleared' events still play). It sweeps the whole mess list, so a pile left by an
   * old save, an offline catch-up or a missed event never lies on the table. Money must never lie on the table.
   */
  autoCollect(state: GameState, now: number): { state: GameState; events: TavernClientEvent[] } {
    let s = state;
    const out: TavernClientEvent[] = [];
    for (const mess of state.tavern.mess) {
      const spot = { x: mess.x, y: mess.y };
      const r = collectCoins(s, mess.id, now);
      if (r) {
        s = r.state;
        out.push({ t: 'collected', messId: mess.id, coins: r.coins, spot, gains: [gain(GOLD_GAIN_ID, r.coins), ...(r.gems > 0 ? [{ itemId: GEMS_GAIN_ID, count: r.gems, rank: 'common' as const }] : [])] });
      }
      const cleared = clearDish(s, mess.id);
      if (cleared) {
        s = cleared;
        out.push({ t: 'cleared', messId: mess.id, spot });
      }
    }
    return { state: s, events: out };
  },

  async getTavern(h: LocalGameAPI): Promise<TavernView> {
    const t = h.state.tavern;
    const room = h.roomById(t.roomId);
    return structuredClone({ roomId: t.roomId, workRooms: tavernWorkRoomIds(h.state), ...(h.state.player.cellarRoomId !== undefined ? { cellarRoomId: h.state.player.cellarRoomId } : {}), guests: t.guests, mess: t.mess, serveQueue: t.serveQueue, tray: t.tray, brews: t.brews, cooks: t.cooks, taps: t.taps, casks: t.casks, caskCaps: Object.fromEntries(h.state.items.filter((i) => getFurnitureType(i.typeId).casks === true).map((i) => [i.uid, rackTierCap(h.state, i.uid)])), appeal: room ? tavernAppeal(room, h.state.items, attachedRooms(h.state)) : 0, at: h.now(), introSeen: t.introSeen, open: tavernOpen(t) });
  },

  /** What a guest step needs: the room, its items, the nav grid (rebuilt when the furniture changes) and the seats the player holds. */
  tavernWorld(h: LocalGameAPI, state: GameState): TavernWorld {
    const room = state.rooms.find((r) => r.id === state.tavern.roomId);
    if (!room) throw new Error('tavern room missing');
    h.tavernGrid ??= buildNavGrid(room, roomBlockers(room, state.items));
    // The own avatar's seat in the tavern (guests do not sit there).
    const seated = state.currentRoomId === room.id ? h.walkState.seated : null;
    return { room, items: state.items, attached: attachedRooms(state), grid: h.tavernGrid, playerHere: state.currentRoomId === room.id, seatsTaken: seated ? [seated] : [], barGuests: h.barGuests };
  },

  onTavern(h: LocalGameAPI, listener: (e: TavernClientEvent) => void): () => void {
    h.tavernListeners.add(listener);
    return () => h.tavernListeners.delete(listener);
  },

  async serveGuest(h: LocalGameAPI, guestId: number): Promise<boolean> {
    if (!h.inTavern()) return false;
    // COD-1: a mug for this guest is already on the tray: carry exactly that one over.
    if (guestsTrayCanServe(h.state.tavern).includes(guestId)) return tavernApi.carryHeld(h, guestId);
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
    if (h.errand) return true; // The queue is worked off after the walk or the pour the avatar is busy with.
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
    if (t.serveQueue.length > 0) return false;
    return h.startErrand({ x: mess.x, y: mess.y }, { stage: 'mess', messId, what });
  },

  async collectBrew(h: LocalGameAPI, barrelUid: number): Promise<{ drink: MaterialId; mugs: number; gains: GainList } | null> {
    if (!h.inWork()) return null;
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
    if (!h.inWork()) return false;
    const next = fillCask(h.state, rackUid, slot, drink, qty, h.now());
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async collectCask(h: LocalGameAPI, rackUid: number, slot: number): Promise<{ item: MaterialId; mugs: number; tier: 'fresh' | DrinkTier; gains: GainList } | null> {
    if (!h.inWork()) return null;
    const r = collectCask(h.state, rackUid, slot, h.now());
    if (!r) return null;
    const gains = gainsSince(h.state, r.state);
    h.commit(r.state);
    return { item: r.item, mugs: r.mugs, tier: r.tier, gains };
  },

  async startBrew(h: LocalGameAPI, barrelUid: number, drink: DrinkId): Promise<boolean> {
    if (!h.inWork()) return false;
    const next = startBrew(h.state, barrelUid, drink, h.now(), h.rng);
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

  async setTavernOpen(h: LocalGameAPI, open: boolean): Promise<boolean> {
    h.commit(setTavernOpen(h.state, open));
    return tavernOpen(h.state.tavern);
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
    if (!h.inWork()) return false;
    const next = startCook(h.state, stoveUid, food, qty, h.now(), h.rng);
    if (!next) return false;
    h.commit(next);
    return true;
  },

  async collectCook(h: LocalGameAPI, stoveUid: number): Promise<{ food: FoodId; qty: number; gains: GainList } | null> {
    if (!h.inWork()) return null;
    const r = collectCook(h.state, stoveUid, h.now());
    if (!r) return null;
    const gains = gainsSince(h.state, r.state);
    h.commit(r.state);
    return { food: r.food, qty: r.qty, gains };
  },

  /** CEL-2: the tavern or its attached kitchen or cellar (where barrels, stoves and racks work). */
  inWork(h: LocalGameAPI): boolean {
    return tavernWorkRoomIds(h.state).includes(h.state.currentRoomId);
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
  async pourHeld(h: LocalGameAPI, heldMs: number, pick?: { standUid: number; slot: number }): Promise<boolean> {
    const w = h.walkState;
    if (!h.inTavern() || !h.errand || w.task?.stage !== 'pourwait' || w.path.length > 0) return false;
    const r = pourOrder(h.state, pick);
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
    const grade = pourGrade(pourHeldClamp(heldMs), bonusesOf(h.state.player));
    // One pour = ONE mug: the one just put on the tray carries the grade.
    const tray = r.state.tavern.tray.map((m, i, all) => (i === all.length - 1 ? { ...m, perfect: grade === 'perfect' } : m));
    h.commit({ ...r.state, tavern: { ...r.state.tavern, tray } });
    h.emitTavern({ t: 'poured', grade });
    h.emitTavern({ t: 'tray', mugs: tray.map((m) => ({ ...m })) });
    h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
    tavernApi.armNextPour(h); // more queued and room on the tray: the avatar stays at the taps for the next mug
    return true;
  },

  /** COD-1: at the taps with room on the tray and a drink queued: wait for the next pour (event 'pour_ready'). False = nothing to pour here. */
  armNextPour(h: LocalGameAPI): boolean {
    const next = nextOrder(h.state);
    const stop = next && isDrinkId(next.item) ? pourStop(h.state, next.item) : null;
    if (!next || !stop) return false;
    h.walkState = { ...h.walkState, task: { stage: 'pourwait', guestId: next.guestId, item: next.item } };
    h.errand = true;
    h.emitTavern({ t: 'pour_ready', guestId: next.guestId, item: next.item, standUid: stop.stand.uid });
    return true;
  },

  /** COD-1: puts the whole tray back in the bag. */
  async returnTray(h: LocalGameAPI): Promise<boolean> {
    if (!h.inTavern()) return false;
    const next = returnTray(h.state, h.now());
    if (!next) return false;
    h.commit(next);
    h.emitTavern({ t: 'tray', mugs: [] });
    return true;
  },

  /** COD-1: the player taps a guest who waits for something on the tray: the avatar carries ONE matching mug to their table. */
  async carryHeld(h: LocalGameAPI, guestId: number): Promise<boolean> {
    if (!h.inTavern() || !guestsTrayCanServe(h.state.tavern).includes(guestId)) return false;
    // Waiting at the taps for a pour: the player chose to serve now, the pour wait is dropped (the queue stays).
    if (h.errand && h.walkState.task?.stage === 'pourwait') {
      h.walkState = { ...h.walkState, task: undefined };
      h.errand = false;
      h.emitTavern({ t: 'pour_cancel' });
    }
    if (h.errand) return false;
    // TF: a BAR guest takes a hand-over on the staff side of the bar, a table guest gets the mug carried.
    const guest = h.state.tavern.guests.find((g) => g.id === guestId);
    if (guest?.kind2 === 'bar' && guest.barSpot) {
      const bar = h.state.items.find((i) => i.uid === guest.barSpot!.barUid);
      return bar !== undefined && h.startErrand(barServePoint({ x: guest.x, y: guest.y, facing: guest.facing }, bar), { stage: 'handover', guestId });
    }
    const stops = serveStops(h.state, guestId);
    return stops !== null && h.startErrand(stops.table, { stage: 'table', guestId });
  },

  /** TF-5 GRAB ALL: queues the pours (see shared grabAll) and starts the first. */
  async grabAll(h: LocalGameAPI): Promise<boolean> {
    if (!h.inTavern()) return false;
    const r = grabAll(h.state);
    if (!r) return false;
    h.commit(r.state);
    h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
    if (h.errand) return true;
    if (h.nextServe()) return true;
    h.dropServe();
    return false;
  },

  /** TF-5 SERVE ALL: the tray's tour (bar guests first, then tables by distance), one delivery after the other. */
  async serveAll(h: LocalGameAPI): Promise<boolean> {
    if (!h.inTavern() || h.state.tavern.tray.length === 0) return false;
    const me = h.avatarNow();
    const route = serveRoute(h.state.tavern.tray, h.state.tavern.guests, { x: me.x, y: me.y });
    if (route.length === 0) return false;
    h.serveTour = route.slice(1);
    const ok = await tavernApi.carryHeld(h, route[0]!);
    if (!ok) h.serveTour = [];
    return ok;
  },

  /** After a delivery: the next guest of a SERVE ALL tour, else the queued pours. */
  nextAfterDelivery(h: LocalGameAPI): void {
    while (h.serveTour.length > 0) {
      const id = h.serveTour.shift()!;
      if (guestsTrayCanServe(h.state.tavern).includes(id) && tavernApi.startCarry(h, id)) return;
    }
    if (!h.nextServe()) h.dropServe();
  },

  /** Starts the carry or hand-over errand for one guest (no await, used by the tour). */
  startCarry(h: LocalGameAPI, guestId: number): boolean {
    if (h.errand) return false;
    const guest = h.state.tavern.guests.find((g) => g.id === guestId);
    if (guest?.kind2 === 'bar' && guest.barSpot) {
      const bar = h.state.items.find((i) => i.uid === guest.barSpot!.barUid);
      return bar !== undefined && h.startErrand(barServePoint({ x: guest.x, y: guest.y, facing: guest.facing }, bar), { stage: 'handover', guestId });
    }
    const stops = serveStops(h.state, guestId);
    return stops !== null && h.startErrand(stops.table, { stage: 'table', guestId });
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
    const was = h.errand;
    h.errand = false;
    if (was) h.emitTavern({ t: 'pour_cancel' }); // the client drops a wait at the taps (it ignores the event otherwise)
    if (h.state.tavern.serveQueue.length === 0) return;
    h.commit(cancelServe(h.state));
    h.emitTavern({ t: 'queue', queue: [] });
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
    if (task.stage === 'pourwait') {
      // The guest left (or the order was served otherwise) while the avatar waited: nothing to pour for, no stuck avatar.
      if (nextOrder(h.state)?.guestId !== task.guestId) h.dropServe();
      // The stand (or its drink) went away while the avatar waited at it: the order stays open, nothing to pour, no stuck avatar.
      else if (!pourStop(h.state, task.item)) h.dropServe();
      return;
    }
    h.walkState = { ...w, task: undefined };
    h.errand = false;
    if (task.stage === 'bar') {
      // A drink is poured by hand (step G2): the avatar waits at the taps for pourHeld.
      if (tavernApi.armNextPour(h)) return;
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
      h.emitTavern({ t: 'tray', mugs: r.state.tavern.tray.map((m) => ({ ...m })) });
      h.emitTavern({ t: 'queue', queue: [...r.state.tavern.serveQueue] });
      // A drink waits on the tray until the player taps a guest who wants it (carryHeld); a dish goes on by itself.
      if (isDrinkId(r.item)) return;
      const stops = serveStops(h.state, r.guestId);
      if (!stops || !h.startErrand(stops.table, { stage: 'table', guestId: r.guestId })) h.dropServe();
    } else if (task.stage === 'table') {
      const spot = serveStops(h.state, task.guestId)?.table;
      const d = deliverOrder(h.state, h.rng, task.guestId);
      if (d && spot) {
        h.commit(d.state);
        h.emitTavern({ t: 'served', guestId: d.guestId, item: d.item, spot });
        tavernApi.deliverySays(h, d);
      }
      h.emitTavern({ t: 'tray', mugs: h.state.tavern.tray.map((m) => ({ ...m })) });
      tavernApi.nextAfterDelivery(h);
    } else if (task.stage === 'handover') {
      // TF: the mug slides across the bar into the guest's hands.
      const guest = h.state.tavern.guests.find((g) => g.id === task.guestId);
      const spot = guest ? { x: guest.x, y: guest.y } : null;
      const d = handOver(h.state, h.rng, task.guestId);
      if (d && spot) {
        h.commit(d.state);
        h.emitTavern({ t: 'served', guestId: d.guestId, item: d.item, spot });
        tavernApi.deliverySays(h, d);
      }
      h.emitTavern({ t: 'tray', mugs: h.state.tavern.tray.map((m) => ({ ...m })) });
      tavernApi.nextAfterDelivery(h);
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

  /**
   * 3g NPC TALK: what is said when an order is put down: the guest who got a perfect pour (or a tip) brags, and now and then the waiter (the
   * player's avatar) calls "Order up!". Chances in config TALK_CHANCE, no repeat per moment (TavernState.lastLines); the rng is the API's.
   */
  deliverySays(h: LocalGameAPI, d: { guestId: number; perfect: boolean; tip: number }): void {
    const guest = h.state.tavern.guests.find((g) => g.id === d.guestId);
    if (guest) {
      const moment = d.perfect && (d.tip <= 0 || h.rng() < 0.6) ? 'perfect_pour' : d.tip > 0 ? 'tip' : null;
      const r = moment ? sayFrom(h.state, moment, talkChance(moment === 'tip' ? 'tip' : 'perfect', guest.kind), h.rng) : null;
      if (r) {
        h.commit(r.state);
        h.emitTavern({ t: 'say', guestId: d.guestId, text: r.text });
      }
    }
    const staff = sayFrom(h.state, 'staff', TALK_CHANCE.staff, h.rng);
    if (staff) {
      h.commit(staff.state);
      h.emitTavern({ t: 'say', guestId: h.state.player.id, text: staff.text });
    }
  },

  emitTavern(h: LocalGameAPI, e: TavernClientEvent): void {
    for (const l of h.tavernListeners) l(e);
  },
};
