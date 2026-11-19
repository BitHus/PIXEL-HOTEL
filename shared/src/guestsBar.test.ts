import { describe, expect, it } from 'vitest';
import { BAR_DRINK_MAX_MS, BAR_PATIENCE_MS, BAR_SPEED_TIP_MS, GUEST_MAX, SHOP_TICK_MS } from './config.ts';
import { barSpotIndex } from './barSpots.ts';
import type { GameState } from './gameState.ts';
import { stepTavern, type TavernEvent } from './guests.ts';
import { grabAll, handOver, serveRoute, speedTip } from './guestsBar.ts';
import { seededRng } from './rng.ts';
import { collectCoins, openOrders, pourOrder, requestServe, type Guest } from './tavern.ts';
import { ordersStrip } from './tray.ts';
import { tavernWorld, withAle } from './tavernTest.ts';
import { ledgerGold } from './testState.ts';

/** A tavern with no stools: every guest has to take the bar. */
function barOnly(): GameState {
  const s = withAle();
  return { ...s, items: s.items.filter((i) => i.typeId !== 'bar_stool') };
}

/** Steps with bar guests on until `done` (at most ms). */
function until(s: GameState, ms: number, rng: () => number, done: (s: GameState) => boolean, bar = true): { s: GameState; t: number; ev: TavernEvent[] } {
  const ev: TavernEvent[] = [];
  let t = 0;
  while (t < ms) {
    t += SHOP_TICK_MS;
    const r = stepTavern(s, { ...tavernWorld(s), barGuests: bar }, SHOP_TICK_MS, rng, t);
    s = r.state;
    ev.push(...r.events);
    if (done(s)) break;
  }
  return { s, t, ev };
}

describe('bar guests in the tavern step (TF-2)', () => {
  it('with no stools a guest walks to a bar spot, stands facing the bar and orders a drink there', () => {
    const { s } = until(barOnly(), 3 * 60_000, seededRng(4), (x) => openOrders(x.tavern).length > 0);
    const g = openOrders(s.tavern)[0]!;
    expect(g.kind2).toBe('bar');
    expect(g.seat).toBeNull();
    expect(g.barSpot).toBeDefined();
    expect(g.path).toEqual([]);
    expect(g.facing).toBe('up');
    expect(g.order?.item).toBe('root_ale');
    expect(g.patienceMs).toBe(BAR_PATIENCE_MS);
  });

  it('bar guests never exceed the free spots, never share one, and GUEST_MAX holds', () => {
    const { s } = until(barOnly(), 10 * 60_000, seededRng(7), () => false);
    const held = s.tavern.guests.flatMap((g) => (g.barSpot ? [`${g.barSpot.barUid}:${g.barSpot.c},${g.barSpot.r}`] : []));
    expect(new Set(held).size).toBe(held.length);
    expect(s.tavern.guests.length).toBeLessThanOrEqual(GUEST_MAX);
  });

  it('hand-over: ONE mug of the tray, a speed tip when fast, the guest drinks 6 to 10 s, then coins and the mug lie ON THE BAR', () => {
    const rng = seededRng(4);
    let { s, t } = until(barOnly(), 3 * 60_000, rng, (x) => openOrders(x.tavern).length > 0);
    const g = openOrders(s.tavern)[0]!;
    const asked = requestServe(s, g.id)!;
    const poured = pourOrder(asked)!;
    expect(poured.empty).toBe(false);
    s = poured.state;
    expect(s.tavern.tray).toHaveLength(1);
    const before = g.order!.coins;
    const h = handOver(s, rng, g.id)!;
    expect(h.state.tavern.tray).toHaveLength(0);
    const drinking = h.state.tavern.guests.find((x) => x.id === g.id)!;
    expect(drinking.phase).toBe('bar_drink');
    expect(drinking.waitMs).toBeGreaterThanOrEqual(6000);
    expect(drinking.waitMs).toBeLessThanOrEqual(BAR_DRINK_MAX_MS);
    expect(h.tip).toBe(speedTip(g.patienceMs, g.order!.price)); // not a perfect pour
    expect(drinking.order!.coins).toBe(before + h.tip);
    const done = until(h.state, 15_000, rng, (x) => x.tavern.mess.length > 0, true);
    const mess = done.s.tavern.mess[0]!;
    expect(mess.seatUid).toBe(g.barSpot!.barUid);
    expect(mess.seatIndex).toBe(barSpotIndex({ c: g.barSpot!.c, r: g.barSpot!.r }));
    expect(mess.coins).toBe(drinking.order!.coins);
    // The coins are collected like any other (ledger 'tavern').
    const gold = ledgerGold(done.s);
    expect(ledgerGold(collectCoins(done.s, mess.id, t)!.state)).toBe(gold + mess.coins);
  });

  it('handOver refuses a table guest, a guest without an open order and an empty tray', () => {
    const rng = seededRng(4);
    const { s } = until(barOnly(), 3 * 60_000, rng, (x) => openOrders(x.tavern).length > 0);
    const g = openOrders(s.tavern)[0]!;
    expect(handOver(s, rng, g.id)).toBeNull(); // nothing on the tray
    expect(handOver(s, rng, -9999)).toBeNull();
    const table: GameState = { ...s, tavern: { ...s.tavern, tray: [{ item: g.order!.item }], guests: s.tavern.guests.map((x) => ({ ...x, kind2: undefined })) } };
    expect(handOver(table, rng, g.id)).toBeNull();
  });

  it('speedTip: only within BAR_SPEED_TIP_MS of the order', () => {
    expect(speedTip(BAR_PATIENCE_MS - 1000, 20)).toBe(1);
    expect(speedTip(BAR_PATIENCE_MS - BAR_SPEED_TIP_MS - 1, 20)).toBe(0);
  });

  it('a bar guest who waits too long leaves unhappy and the order is released', () => {
    let { s } = until(barOnly(), 3 * 60_000, seededRng(4), (x) => openOrders(x.tavern).length > 0);
    const id = openOrders(s.tavern)[0]!.id;
    const r = until(s, BAR_PATIENCE_MS + 5000, seededRng(1), (x) => !x.tavern.guests.some((g) => g.id === id && g.phase === 'order'));
    expect(r.ev.some((e) => e.t === 'unhappy' && e.guestId === id)).toBe(true);
    s = r.s;
    expect(s.tavern.guests.find((g) => g.id === id)?.phase).toBe('leave');
  });

  it('with the flag off (the default) nothing changes: no guest is a bar guest', () => {
    const { s } = until(withAle(), 5 * 60_000, seededRng(4), () => false, false);
    expect(s.tavern.guests.some((g) => g.kind2 !== undefined || g.barSpot !== undefined)).toBe(false);
  });
});

describe('orders strip, grab all and the serve route (TF-4)', () => {
  it('chips tell bar or table, and a guest being poured for is pouring', () => {
    const { s } = until(barOnly(), 3 * 60_000, seededRng(4), (x) => openOrders(x.tavern).length > 0);
    const g = openOrders(s.tavern)[0]!;
    const [chip] = ordersStrip(s.tavern);
    expect(chip).toMatchObject({ guestId: g.id, where: 'bar', state: 'waiting', patience: 1 });
    expect(ordersStrip(s.tavern, g.id)[0]!.state).toBe('pouring');
    const table = { ...s.tavern, guests: s.tavern.guests.map((x) => ({ ...x, kind2: undefined })) };
    expect(ordersStrip(table)[0]!.where).toBe('table');
  });

  const guest = (id: number, over: Partial<Guest>): Guest => ({ id, kind: 'chatty', look: {} as Guest['look'], x: 0, y: 0, facing: 'up', path: [], speed: 72, phase: 'order', groupId: id, seat: null, seated: true, tolerance: 1, waitMs: 0, order: { item: 'root_ale', price: 9, coins: 9 }, patienceMs: 50_000, warned: false, talkInMs: 0, sipInMs: 0, reaction: null, ...over });

  it('grabAll queues one pour per open order of the most urgent item, within the tray and the queue limits', () => {
    const s0 = withAle();
    const guests = [guest(-1, { patienceMs: 30_000 }), guest(-2, { patienceMs: 20_000 }), guest(-3, { patienceMs: 40_000 }), guest(-4, { patienceMs: 10_000, order: { item: 'roasted_turnip', price: 5, coins: 5 } })];
    const s: GameState = { ...s0, tavern: { ...s0.tavern, guests } };
    const r = grabAll(s)!;
    expect(r.item).toBe('roasted_turnip'); // the most urgent order
    expect(r.queued).toEqual([-4]); // only one wants it
    const again = grabAll(r.state)!;
    expect(again.item).toBe('root_ale');
    expect(again.queued).toEqual([-2, -1]); // tray size 3: one slot is taken by the first queue entry
    expect(again.state.tavern.serveQueue).toHaveLength(3);
    expect(grabAll(again.state)).toBeNull(); // full
  });

  it('grabAll is null with no open orders', () => {
    expect(grabAll(withAle())).toBeNull();
  });

  it('serveRoute: tray items go to the guests with least patience, bar guests first (nearest first), then tables by distance', () => {
    const guests = [
      guest(-1, { kind2: 'table', x: 300, y: 300, patienceMs: 10_000 }),
      guest(-2, { kind2: 'bar', x: 100, y: 100, patienceMs: 20_000 }),
      guest(-3, { kind2: 'bar', x: 50, y: 100, patienceMs: 30_000 }),
      guest(-4, { kind2: 'table', x: 120, y: 300, patienceMs: 40_000 }),
    ];
    const tray = [{ item: 'root_ale' as const }, { item: 'root_ale' as const }, { item: 'root_ale' as const }];
    // 3 mugs go to the 3 most urgent (-1, -2, -3); the route: bar guests -3 (nearest to the start at 0,100) then -2, then the table guest -1.
    expect(serveRoute(tray, guests, { x: 0, y: 100 })).toEqual([-3, -2, -1]);
    expect(serveRoute([], guests, { x: 0, y: 0 })).toEqual([]);
  });
});
