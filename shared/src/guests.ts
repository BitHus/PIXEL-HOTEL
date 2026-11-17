// The tavern's guests (step 9t). Pure: time (dtMs, at) and rng are passed in.
//
// Guests come alone, as a pair or as a group of 3, every guestIntervalMs(appeal). They look for
// free seats at a table (together when a table has room), walk in through the door and sit. No
// free seat: they stand a moment, say so and leave. Never more guests than the tavern has seats,
// and at most GUEST_MAX.
// A seated guest orders after a moment (tavern.ts chooseOrder: the menu price rule). The order
// waits until the player brings it (deliverOrder); then the guest eats or drinks for 20 to 40 s
// (sips, talk with the table), leaves coins and the empty mug or plate on the table spot and walks
// out. A guest who waits longer than
// GUEST_PATIENCE_MS leaves unhappy and pays nothing (the order goes back to the bag).
// AWAY RULE: nothing happens without the player. The patience only runs while the player is in the
// tavern (TavernWorld.playerHere). While the player is elsewhere, or the game was closed
// (catchUpTavern: maths only), guests only come while fewer than AWAY_ORDERS_MAX wait with an open
// order, and those never walk off.
// Guests use the customers' nav grid (the staff zone behind the bar is blocked for them).

import { walkAvatar, type Avatar } from './avatar.ts';
import {
  AWAY_ORDERS_MAX,
  CUSTOMER_ENTER_PAUSE_MS,
  CUSTOMER_SPEED_VARIATION,
  CUSTOMER_WALK_SPEED,
  GUEST_EAT_MAX_MS,
  GUEST_EAT_MIN_MS,
  GUEST_GROUP_GAP_PX,
  GUEST_GROUP_WEIGHTS,
  GUEST_MAX,
  GUEST_NO_MENU_MAX_MS,
  GUEST_NO_MENU_MIN_MS,
  GUEST_NO_SEAT_MS,
  GUEST_ORDER_AFTER_MAX_MS,
  GUEST_ORDER_AFTER_MIN_MS,
  GUEST_PATIENCE_MS,
  GUEST_PATIENCE_WARN_MS,
  GUEST_REFUSE_MS,
  GUEST_ROOM_REMARK_CHANCE,
  GUEST_SEAT_REACH_PX,
  GUEST_SIP_MAX_MS,
  GUEST_SIP_MIN_MS,
  GUEST_TALK_MAX_MS,
  GUEST_TALK_MIN_MS,
  HURRIED_SPEED_BONUS,
  OFFLINE_MAX_MS,
  REMARK_APPEAL_MIN,
} from './config.ts';
import { pourTip } from './pour.ts';
import { returnTray, takeMug } from './tray.ts';
import { guestLook, outsidePoint, rollGuestKind, rollTolerance } from './guestLook.ts';
import { kitchenZone } from './kitchen.ts';
import { guestZones, npcGrid, npcPath } from './npcNav.ts';
import { doorPoint } from './furniture.ts';
import type { GameState } from './gameState.ts';
import { applyChange } from './ledger.ts';
import { tavernGemDrop } from './gems.ts';
import { getMaterialType, isDrinkId } from './materials.ts';
import type { NavGrid } from './nav.ts';
import { maybeSay, reactionMoment, talkChance, type NpcMoment, type TalkMoment } from './npcTalk.ts';
import type { Room } from './room.ts';
import { tavernAppeal } from './appeal.ts';
import {
  chooseOrder,
  coinsFor,
  freeTavernSeats,
  guestIntervalMs,
  menuOffers,
  openOrders,
  pickSeats,
  recordOrder,
  tasteOffers,
  seatKey,
  tavernSeats,
  type Guest,
  type Mess,
  type TavernSeat,
  type TavernState,
} from './tavern.ts';
import type { FurnitureItem, MaterialId, Point, Reaction, Rng } from './types.ts';

/** The world a tavern step needs. */
export interface TavernWorld {
  room: Room;
  /** All the player's items (the tavern room's are used). */
  items: readonly FurnitureItem[];
  grid: NavGrid;
  /** True while the player is in the tavern room: only then the guests' patience runs. */
  playerHere: boolean;
  /** Seats the player's avatar uses (guests do not sit there). */
  seatsTaken?: readonly { uid: number; index: number }[];
}

export type TavernEvent =
  /** The guest list changed (someone came, sat down, left, or got a new path). */
  | { t: 'guests'; guests: Guest[] }
  | { t: 'say'; guestId: number; text: string }
  /** A guest ordered (the order bubble). `refused`: what they wanted first but found too expensive. */
  | { t: 'order'; guestId: number; item: MaterialId; price: number; reaction: Reaction; refused?: MaterialId }
  /** A guest found the menu too expensive and orders nothing (the face). */
  | { t: 'refuse'; guestId: number; item: MaterialId; reaction: Reaction }
  /** A sip or a bite. */
  | { t: 'sip'; guestId: number }
  /** A guest finished: coins and the empty dish lie on the table spot. */
  | { t: 'coins'; guestId: number; mess: Mess }
  /** A guest waited too long and leaves without paying. */
  | { t: 'unhappy'; guestId: number };

/** A guest as an avatar (for drawing and walking). */
export function guestAvatar(g: Guest, roomId: number): Avatar {
  const state = g.path.length > 0 ? 'walk' : g.seated ? 'sit' : 'idle';
  return { id: g.id, name: 'Guest', look: g.look, roomId, x: g.x, y: g.y, facing: g.facing, state };
}

/** 1, 2 or 3 by GUEST_GROUP_WEIGHTS. */
export function rollGroupSize(rng: Rng): number {
  const total = GUEST_GROUP_WEIGHTS.reduce((a: number, b) => a + b, 0);
  let r = rng() * total;
  for (let k = 0; k < GUEST_GROUP_WEIGHTS.length; k++) {
    r -= GUEST_GROUP_WEIGHTS[k]!;
    if (r < 0) return k + 1;
  }
  return GUEST_GROUP_WEIGHTS.length;
}

const between = (rng: Rng, lo: number, hi: number): number => lo + Math.floor(rng() * (hi - lo));

function newGuest(id: number, groupId: number, rng: Rng, at: Point, seat: TavernSeat | null): Guest {
  const kind = rollGuestKind(rng);
  let speed = CUSTOMER_WALK_SPEED * (1 + (rng() * 2 - 1) * CUSTOMER_SPEED_VARIATION);
  if (kind === 'hurried') speed *= 1 + HURRIED_SPEED_BONUS;
  return {
    id,
    kind,
    look: guestLook(id),
    x: at.x,
    y: at.y,
    facing: 'up',
    path: [],
    speed,
    phase: 'enter',
    groupId,
    seat: seat ? { uid: seat.uid, index: seat.index } : null,
    seated: false,
    tolerance: rollTolerance(rng),
    waitMs: CUSTOMER_ENTER_PAUSE_MS,
    order: null,
    patienceMs: GUEST_PATIENCE_MS,
    warned: false,
    talkInMs: between(rng, GUEST_TALK_MIN_MS, GUEST_TALK_MAX_MS),
    sipInMs: 0,
    reaction: null,
  };
}

function withTavern(state: GameState, tavern: Partial<TavernState>): GameState {
  return { ...state, tavern: { ...state.tavern, ...tavern } };
}

/** The seats a guest can walk to from the door (the walk ends at most GUEST_SEAT_REACH_PX from the seat). */
function reachable(g: NavGrid, door: Point, seats: readonly TavernSeat[]): TavernSeat[] {
  return seats.filter((s) => {
    const path = npcPath(g, door, s);
    const end = path[path.length - 1] ?? door;
    return Math.hypot(end.x - s.x, end.y - s.y) <= GUEST_SEAT_REACH_PX;
  });
}

/**
 * Takes the guest's order out of the bag (ledger 'tavern_order'). Null when the bag has none. A DRINK is not taken here (step T1): it
 * stays on its tap until the avatar pours it; the open order counts as spoken for (taps.ts stockFor), menuOffers already checked it.
 */
function reserve(state: GameState, item: MaterialId, at: number): GameState | null {
  if (isDrinkId(item)) return state;
  return applyChange(state, { reason: 'tavern_order', materials: { [item]: -1 }, note: `ordered: ${item}` }, at);
}

/** A guest leaves unserved: the order goes back to the bag and out of the player's queue (a mug on the tray stays: any guest wanting it can have it). */
function giveBack(state: GameState, g: Guest, at: number): GameState {
  if (!g.order) return state;
  // A drink was never taken from the bag (it is poured from the tap when served): only the queue and the hands are cleared.
  const back = isDrinkId(g.order.item) ? state : applyChange(state, { reason: 'tavern_order', materials: { [g.order.item]: 1 }, note: `not served: ${g.order.item}` }, at) ?? state;
  const t = back.tavern;
  return withTavern(back, { serveQueue: t.serveQueue.filter((id) => id !== g.id) });
}

/**
 * A happy guest sometimes tips a gem (step S3): one who did not have to call out for the order and did not frown at the price. The chance is set by the
 * rank of what they ordered (config GEMS.tavern and TAVERN_GEM_CHANCE_MULT); the rng is passed in.
 */
export function guestTip(g: Pick<Guest, 'warned' | 'reaction'>, item: MaterialId, rng: Rng): number {
  if (g.warned || g.reaction === 'frown' || g.reaction === 'shrug') return 0;
  return tavernGemDrop(getMaterialType(item).rank, rng);
}

/** A guest finished eating: coins (and maybe a gem) and the empty dish on their table spot, the price in the history. */
function leaveMess(state: GameState, g: Guest, seat: TavernSeat | undefined, rng: Rng): { state: GameState; mess: Mess | null } {
  if (!g.order) return { state, mess: null };
  const t = state.tavern;
  const at = seat?.spot ?? { x: g.x, y: g.y };
  const mess: Mess = { id: t.nextMessId, seatUid: g.seat?.uid ?? 0, seatIndex: g.seat?.index ?? -1, x: at.x, y: at.y, coins: g.order.coins, gems: guestTip(g, g.order.item, rng), dish: g.order.item };
  return { state: withTavern(state, { mess: [...t.mess, mess], nextMessId: t.nextMessId + 1, history: recordOrder(t.history, g.order.item, g.order.price) }), mess };
}

/**
 * The player puts ONE mug (or dish) of the tray on the table of the guest guestId: that guest starts eating. The mug taken is one of the
 * guest's own item (COD-1: a mug is not tied to the guest it was poured for). Null when that guest no longer waits or the tray
 * has no mug of what they ordered.
 */
export function deliverOrder(state: GameState, rng: Rng, guestId: number): { state: GameState; guestId: number; item: MaterialId } | null {
  const guest = state.tavern.guests.find((g) => g.id === guestId && g.phase === 'order');
  const taken = guest?.order ? takeMug(state.tavern.tray, guest.order.item) : null;
  if (!guest || !taken) return null;
  const hold = taken.mug;
  const tip = pourTip(hold.perfect === true, guest.order?.price ?? 0);
  const eating: Guest = { ...guest, ...(tip > 0 && guest.order ? { order: { ...guest.order, coins: guest.order.coins + tip } } : {}), phase: 'eat', waitMs: between(rng, GUEST_EAT_MIN_MS, GUEST_EAT_MAX_MS), sipInMs: between(rng, GUEST_SIP_MIN_MS, GUEST_SIP_MAX_MS) };
  return { state: withTavern(state, { tray: taken.tray, guests: state.tavern.guests.map((g) => (g.id === guest.id ? eating : g)) }), guestId: guest.id, item: hold.item };
}

/**
 * Advances the live tavern by dtMs (call it in SHOP_TICK_MS steps, next to stepShop). `at` is the
 * time at the end of the step (ledger entries).
 */
export function stepTavern(state: GameState, w: TavernWorld, dtMs: number, rng: Rng, at: number): { state: GameState; events: TavernEvent[] } {
  const events: TavernEvent[] = [];
  let s = state;
  let changed = false;
  const g = npcGrid(w.grid, guestZones(w.items, w.room));
  const seats = tavernSeats(w.items, w.room.id, kitchenZone(w.room));
  const seatOf = (c: Guest): TavernSeat | undefined => (c.seat ? seats.find((k) => seatKey(k) === seatKey(c.seat!)) : undefined);
  const door = doorPoint(w.room);
  const exit = (from: Point): Point[] => [...npcPath(g, from, door), outsidePoint(w.room)];
  const sayOut = (c: Guest, moment: NpcMoment, talk: TalkMoment | 'always'): void => {
    const r = maybeSay(s.tavern.lastLines, moment, talk === 'always' ? 1 : talkChance(talk, c.kind), rng);
    if (!r) return;
    s = withTavern(s, { lastLines: r.lastLines });
    events.push({ t: 'say', guestId: c.id, text: r.text });
  };
  const leave = (c: Guest): Guest => ({ ...c, phase: 'leave', seat: null, seated: false, order: null, waitMs: 0, path: exit(c) });

  // The guest timer.
  let left = s.tavern.nextGuestInMs - dtMs;
  if (left <= 0) {
    left += guestIntervalMs(tavernAppeal(w.room, w.items));
    const here = s.tavern.guests;
    // OA-14: the CLOSED sign: the timer runs, nobody comes.
    let n = s.tavern.closed === true ? 0 : Math.min(rollGroupSize(rng), Math.min(GUEST_MAX, seats.length) - here.length);
    // Away: only while fewer than AWAY_ORDERS_MAX sit (or will sit) with an open order.
    if (!w.playerHere) n = Math.min(n, AWAY_ORDERS_MAX - here.filter((c) => c.phase !== 'eat' && c.phase !== 'leave').length);
    const picks = n > 0 ? pickSeats(reachable(g, door, freeTavernSeats(s.tavern, seats, w.seatsTaken)), n, rng) : null;
    if (n > 0 && (picks || w.playerHere)) {
      const out = outsidePoint(w.room);
      let id = s.tavern.nextGuestId;
      const first = id;
      const group: Guest[] = [];
      for (let k = 0; k < n; k++) {
        const c = newGuest(id--, first, rng, { x: out.x, y: out.y + k * GUEST_GROUP_GAP_PX }, picks?.[k] ?? null);
        group.push({ ...c, path: [door], waitMs: CUSTOMER_ENTER_PAUSE_MS + k * 250 });
      }
      s = withTavern(s, { guests: [...here, ...group], nextGuestId: id });
      changed = true;
    }
  }
  s = withTavern(s, { nextGuestInMs: Math.max(0, left) });

  const roomAppeal = tavernAppeal(w.room, w.items);
  const all = s.tavern.guests;
  const out: Guest[] = [];
  /** Maybe a line at the table: a toast or a word about the drink while eating with someone, else small talk. */
  const tableTalk = (c: Guest): Guest => {
    const talkIn = c.talkInMs - dtMs;
    if (talkIn > 0) return { ...c, talkInMs: talkIn };
    const table = seatOf(c)?.tableUid;
    const mates = all.some((o) => o.id !== c.id && o.phase === 'eat' && seatOf(o)?.tableUid === table);
    // A pretty tavern gets a remark about the room now and then (the same appeal limit as the shop customers' remarks).
    const remark = c.phase !== 'eat' && roomAppeal >= REMARK_APPEAL_MIN && rng() < GUEST_ROOM_REMARK_CHANCE;
    sayOut(c, remark ? 'lovely' : c.phase !== 'eat' ? 'table_talk' : mates && rng() < 0.5 ? 'toast' : 'drink_talk', 'table');
    return { ...c, talkInMs: between(rng, GUEST_TALK_MIN_MS, GUEST_TALK_MAX_MS) };
  };

  for (const c0 of all) {
    let c = c0;
    if (c.path.length > 0) {
      const r = walkAvatar(guestAvatar(c, w.room.id), c.path, dtMs, c.speed);
      c = { ...c, x: r.avatar.x, y: r.avatar.y, facing: r.avatar.facing, path: r.path };
      if (c.path.length > 0) {
        out.push(c);
        continue;
      }
      if (c.phase === 'leave') {
        changed = true;
        continue; // Out of the door: gone.
      }
    }
    const seat = seatOf(c);
    if (c.seat && !seat && c.phase !== 'leave' && c.phase !== 'enter') {
      // Their seat or table was taken away: an open order goes back, a guest who was eating pays.
      if (c.phase === 'order') s = giveBack(s, c, at);
      if (c.phase === 'eat') {
        const m = leaveMess(s, { ...c, seat: null }, undefined, rng);
        s = m.state;
        if (m.mess) events.push({ t: 'coins', guestId: c.id, mess: m.mess });
      }
      c = leave(c);
      changed = true;
    } else if (c.phase === 'enter') {
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        changed = true;
        if (seat) {
          c = { ...c, phase: 'to_seat', waitMs: 0, path: [...npcPath(g, c, seat), { x: seat.x, y: seat.y }] };
        } else {
          c = { ...c, seat: null, phase: 'no_seat', waitMs: GUEST_NO_SEAT_MS };
          if (c.groupId === c.id) sayOut(c, 'no_seat', 'always');
        }
      }
    } else if (c.phase === 'to_seat' && seat) {
      c = { ...c, x: seat.x, y: seat.y, facing: seat.facing, seated: true, phase: 'settle', waitMs: between(rng, GUEST_ORDER_AFTER_MIN_MS, GUEST_ORDER_AFTER_MAX_MS) };
      changed = true;
    } else if (c.phase === 'settle') {
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        changed = true;
        const choice = chooseOrder(tasteOffers(menuOffers(s, [...out, ...all.filter((o) => !out.some((x) => x.id === o.id))]), rng), c.tolerance, rng);
        const taken = choice?.order ? reserve(s, choice.order.id, at) : null;
        if (choice?.order && taken) {
          s = taken;
          const o = choice.order;
          c = { ...c, phase: 'order', reaction: choice.reaction, patienceMs: GUEST_PATIENCE_MS, warned: false, order: { item: o.id, price: o.price, coins: coinsFor(o.id, o.price) } };
          events.push({ t: 'order', guestId: c.id, item: o.id, price: o.price, reaction: choice.reaction, ...(choice.refused ? { refused: choice.refused.id } : {}) });
          sayOut(c, reactionMoment(choice.reaction), 'reaction');
        } else if (choice && !choice.order && choice.refused) {
          // Too expensive: the face, a word, and out after a moment.
          c = { ...c, phase: 'no_menu', reaction: choice.reaction, waitMs: GUEST_REFUSE_MS };
          events.push({ t: 'refuse', guestId: c.id, item: choice.refused.id, reaction: choice.reaction });
          sayOut(c, reactionMoment(choice.reaction), 'reaction');
        } else {
          // Nothing on the menu: they sit and talk a while.
          c = { ...c, phase: 'no_menu', waitMs: between(rng, GUEST_NO_MENU_MIN_MS, GUEST_NO_MENU_MAX_MS) };
          if (c.groupId === c.id) sayOut(c, 'no_menu', 'always');
        }
      }
    } else if (c.phase === 'order') {
      if (w.playerHere) {
        c = { ...c, patienceMs: c.patienceMs - dtMs };
        if (!c.warned && c.patienceMs <= GUEST_PATIENCE_WARN_MS) {
          c = { ...c, warned: true };
          sayOut(c, 'order_wait', 'always');
        }
      }
      if (c.patienceMs <= 0) {
        s = giveBack(s, c, at);
        events.push({ t: 'unhappy', guestId: c.id });
        sayOut(c, 'unhappy', 'always');
        c = { ...leave(c), reaction: 'frown' };
        changed = true;
      } else {
        c = tableTalk(c);
      }
    } else if (c.phase === 'eat') {
      c = { ...c, waitMs: c.waitMs - dtMs, sipInMs: c.sipInMs - dtMs };
      if (c.waitMs <= 0) {
        const m = leaveMess(s, c, seat, rng);
        s = m.state;
        if (m.mess) events.push({ t: 'coins', guestId: c.id, mess: m.mess });
        sayOut(c, 'thanks', 'leave');
        changed = true;
        c = leave(c);
      } else {
        if (c.sipInMs <= 0) {
          events.push({ t: 'sip', guestId: c.id });
          c = { ...c, sipInMs: between(rng, GUEST_SIP_MIN_MS, GUEST_SIP_MAX_MS) };
        }
        c = tableTalk(c);
      }
    } else if (c.phase === 'no_seat' || c.phase === 'no_menu') {
      c = { ...c, waitMs: c.waitMs - dtMs };
      if (c.waitMs <= 0) {
        c = leave(c);
        changed = true;
      } else if (c.phase === 'no_menu' && c.reaction === null) {
        c = tableTalk(c);
      }
    }
    out.push(c);
  }
  s = withTavern(s, { guests: out, updatedAt: at });
  if (changed) events.unshift({ t: 'guests', guests: out });
  return { state: s, events };
}

/** Walking guests get a new path to where they were going (the furniture changed). */
export function repathGuests(state: GameState, w: TavernWorld): GameState {
  const g = npcGrid(w.grid, guestZones(w.items, w.room));
  const seats = tavernSeats(w.items, w.room.id, kitchenZone(w.room));
  const guests = state.tavern.guests.map((c): Guest => {
    if (c.path.length === 0) return c;
    if (c.phase === 'leave') return { ...c, path: [...npcPath(g, c, doorPoint(w.room)), outsidePoint(w.room)] };
    const seat = c.seat ? seats.find((k) => seatKey(k) === seatKey(c.seat!)) : undefined;
    if (c.phase === 'to_seat' && seat) return { ...c, path: [...npcPath(g, c, seat), { x: seat.x, y: seat.y }] };
    return c;
  });
  return withTavern(state, { guests });
}

/**
 * The catch-up after a break (the game was closed, or a long gap): maths only, nobody walks.
 * Guests with an open order stay on their seats, however long it took. Guests who were eating
 * have finished: their coins and dish lie on the table. Everyone else is gone, and the player's
 * serve queue is empty and a tray goes back to the bag. Then the guests who would have come meanwhile (one group every
 * guestIntervalMs, looking back at most OFFLINE_MAX_MS) sit down with an open order, until
 * AWAY_ORDERS_MAX wait; one who finds no seat or nothing at their price is not there.
 */
export function catchUpTavern(state: GameState, w: TavernWorld, at: number, rng: Rng): { state: GameState; arrived: number } {
  const seats = tavernSeats(w.items, w.room.id, kitchenZone(w.room));
  const find = (c: Guest): TavernSeat | undefined => (c.seat ? seats.find((k) => seatKey(k) === seatKey(c.seat!)) : undefined);
  let s = withTavern(returnTray(state, at) ?? state, { serveQueue: [] });
  const kept: Guest[] = [];
  for (const c of state.tavern.guests) {
    const seat = find(c);
    if (c.phase === 'eat') s = leaveMess(s, seat ? c : { ...c, seat: null }, seat, rng).state;
    else if (c.phase === 'order' && seat) kept.push({ ...c, x: seat.x, y: seat.y, facing: seat.facing, path: [], seated: true });
    else if (c.phase === 'order') s = giveBack(s, c, at);
  }
  s = withTavern(s, { guests: kept });
  const gap = Math.max(0, at - state.tavern.updatedAt);
  const span = state.tavern.closed === true ? 0 : Math.min(gap, OFFLINE_MAX_MS); // OA-14: closed = nobody came while away
  const interval = guestIntervalMs(tavernAppeal(w.room, w.items));
  const cap = Math.min(GUEST_MAX, seats.length);
  const g = npcGrid(w.grid, guestZones(w.items, w.room));
  const usable = reachable(g, doorPoint(w.room), seats);
  let wait = s.tavern.nextGuestInMs;
  let t = 0;
  let arrived = 0;
  let id = s.tavern.nextGuestId;
  while (t + wait <= span) {
    t += wait;
    wait = interval;
    const room = Math.min(cap - s.tavern.guests.length, AWAY_ORDERS_MAX - openOrders(s.tavern).length);
    if (room <= 0) continue;
    const n = Math.min(rollGroupSize(rng), room);
    const picks = pickSeats(freeTavernSeats(s.tavern, usable, w.seatsTaken), n, rng);
    const first = id;
    for (const seat of picks ?? []) {
      const c = newGuest(id--, first, rng, seat, seat);
      const choice = chooseOrder(tasteOffers(menuOffers(s), rng), c.tolerance, rng);
      const taken = choice?.order ? reserve(s, choice.order.id, at) : null;
      if (!choice?.order || !taken) continue;
      const o = choice.order;
      const guest: Guest = { ...c, facing: seat.facing, seated: true, phase: 'order', reaction: choice.reaction, order: { item: o.id, price: o.price, coins: coinsFor(o.id, o.price) } };
      s = withTavern(taken, { guests: [...taken.tavern.guests, guest] });
      arrived++;
    }
  }
  if (t < span) wait -= span - t;
  return { state: withTavern(s, { nextGuestInMs: Math.max(0, wait), updatedAt: at, nextGuestId: id }), arrived };
}
