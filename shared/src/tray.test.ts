import { describe, expect, it } from 'vitest';
import { GUEST_PATIENCE_MS, GUEST_PATIENCE_WARN_MS, SERVE_QUEUE_MAX, TRAY_MAX } from './config.ts';
import type { GameState } from './gameState.ts';
import { deliverOrder } from './guests.ts';
import { applyChange } from './ledger.ts';
import { seededRng } from './rng.ts';
import { guestsTrayCanServe, guestsWaitingFor, ordersStrip, returnTray, takeMug, trayFull } from './tray.ts';
import { pickUpOrder, pourOrder, requestServe, type Guest } from './tavern.ts';
import { withAle } from './tavernTest.ts';
import { ledgerMaterials } from './testState.ts';

function guest(s: GameState, id: number, item: string, patienceMs = GUEST_PATIENCE_MS): Guest {
  return {
    id, kind: 'browser', look: s.look, x: 0, y: 0, facing: 'down', path: [], speed: 72, phase: 'order', groupId: id, seat: { uid: 3, index: -id },
    seated: true, tolerance: 1, waitMs: 0, order: { item: item as never, price: 9, coins: 9 }, patienceMs, warned: patienceMs <= GUEST_PATIENCE_WARN_MS,
    talkInMs: 5000, sipInMs: 0, reaction: 'smile',
  };
}
const withGuests = (s: GameState, gs: Guest[]): GameState => ({ ...s, tavern: { ...s.tavern, guests: gs } });
const tapMugs = (t: GameState): number => t.tavern.taps.reduce((n, x) => n + x.mugs, 0);

describe('the waiter tray (COD-1)', () => {
  it('guestsWaitingFor lists the guests with an OPEN order for exactly that drink', () => {
    const s = withAle();
    const gs = [guest(s, -1, 'root_ale'), guest(s, -2, 'carrot_cider'), { ...guest(s, -3, 'root_ale'), phase: 'eat' as const }, guest(s, -4, 'root_ale')];
    expect(guestsWaitingFor({ guests: gs }, 'root_ale')).toEqual([-1, -4]);
    expect(guestsWaitingFor({ guests: gs }, 'potato_stew')).toEqual([]);
    expect(guestsTrayCanServe({ guests: gs, tray: [{ item: 'carrot_cider' }] })).toEqual([-2]);
    expect(guestsTrayCanServe({ guests: gs, tray: [] })).toEqual([]);
  });

  it('one pour is ONE mug: a tap drops by one and the tray gets one mug; the tray holds TRAY_MAX', () => {
    let s = withAle();
    s = withGuests(s, [1, 2, 3, 4].map((k) => guest(s, -k, 'root_ale')));
    const mugs = tapMugs(s);
    for (let k = 1; k <= TRAY_MAX; k++) {
      s = requestServe(s, -k)!;
      const p = pourOrder(s)!;
      expect(p.empty).toBe(false);
      s = p.state;
      expect(s.tavern.tray.length).toBe(k);
      expect(tapMugs(s)).toBe(mugs - k);
    }
    expect(trayFull(s.tavern)).toBe(true);
    s = requestServe(s, -4) ?? s;
    expect(pourOrder(s)).toBeNull(); // a full tray pours nothing more
    expect(s.player.materials).toEqual(ledgerMaterials(s));
  });

  it("delivering takes exactly ONE mug of the guest's item, for ANY guest who wants it; the rest stays", () => {
    let s = withAle();
    s = withGuests(s, [guest(s, -1, 'root_ale'), guest(s, -2, 'root_ale'), guest(s, -3, 'root_ale')]);
    for (const id of [-1, -2, -3]) s = pourOrder(requestServe(s, id)!)!.state;
    expect(s.tavern.tray).toHaveLength(3);
    const d = deliverOrder(s, seededRng(1), -3)!; // not tied to the guest it was poured for
    expect(d).toMatchObject({ guestId: -3, item: 'root_ale' });
    expect(d.state.tavern.tray).toHaveLength(2);
    expect(d.state.tavern.guests.find((g) => g.id === -3)!.phase).toBe('eat');
    expect(d.state.tavern.guests.find((g) => g.id === -1)!.phase).toBe('order');
    expect(deliverOrder(d.state, seededRng(1), -3)).toBeNull(); // already eating
    const other = withGuests(d.state, [...d.state.tavern.guests, guest(d.state, -9, 'carrot_cider')]);
    expect(deliverOrder(other, seededRng(1), -9)).toBeNull(); // wants something else: tray untouched
  });

  it('takeMug prefers a perfect mug (it earns the tip) and removes only one', () => {
    const t = [{ item: 'root_ale' as const }, { item: 'root_ale' as const, perfect: true }, { item: 'carrot_cider' as const }];
    const r = takeMug(t, 'root_ale')!;
    expect(r.mug.perfect).toBe(true);
    expect(r.tray).toEqual([{ item: 'root_ale' }, { item: 'carrot_cider' }]);
    expect(takeMug(t, 'potato_stew')).toBeNull();
  });

  it('a perfect mug pays its tip on that guest', () => {
    let s = withAle();
    s = withGuests(s, [guest(s, -1, 'root_ale')]);
    s = pourOrder(requestServe(s, -1)!)!.state;
    s = { ...s, tavern: { ...s.tavern, tray: s.tavern.tray.map((m) => ({ ...m, perfect: true })) } };
    const d = deliverOrder(s, seededRng(2), -1)!;
    expect(d.state.tavern.guests[0]!.order!.coins).toBeGreaterThan(9);
  });

  it('no more is poured than guests want it (queue + tray never beat the open orders)', () => {
    let s = withAle();
    s = withGuests(s, [guest(s, -1, 'root_ale'), guest(s, -2, 'root_ale')]);
    s = pourOrder(requestServe(s, -1)!)!.state; // one mug on the tray, one guest still unclaimed
    s = requestServe(s, -2)!; // the second pour is queued
    expect(requestServe(s, -1)).toBeNull(); // both are claimed: no third pour
    expect(s.tavern.serveQueue.length).toBeLessThanOrEqual(SERVE_QUEUE_MAX);
  });

  it('a dish rides the tray too', () => {
    let s = applyChange(withAle(), { reason: 'debug', materials: { potato_stew: 1 } }, 0)!;
    s = withGuests(s, [guest(s, -1, 'potato_stew')]);
    const p = pickUpOrder(requestServe(s, -1)!)!;
    expect(p.state.tavern.tray).toEqual([{ item: 'potato_stew' }]);
    expect(deliverOrder(p.state, seededRng(3), -1)!.state.tavern.tray).toEqual([]);
  });

  it('returnTray puts every mug back in the bag and clears the tray; null on an empty tray', () => {
    let s = withAle();
    s = withGuests(s, [guest(s, -1, 'root_ale'), guest(s, -2, 'root_ale')]);
    s = pourOrder(requestServe(s, -1)!)!.state;
    s = pourOrder(requestServe(s, -2)!)!.state;
    const bag = s.player.materials.root_ale ?? 0;
    const r = returnTray(s, 5)!;
    expect(r.tavern.tray).toEqual([]);
    expect(r.player.materials.root_ale ?? 0).toBe(bag + 2);
    expect(r.player.materials).toEqual(ledgerMaterials(r));
    expect(returnTray(r, 6)).toBeNull();
  });

  it('the orders strip: one chip per open order, least patience first, with state and patience', () => {
    let s = withAle();
    s = withGuests(s, [
      guest(s, -1, 'root_ale', GUEST_PATIENCE_MS),
      guest(s, -2, 'root_ale', GUEST_PATIENCE_WARN_MS - 1000),
      { ...guest(s, -3, 'root_ale'), phase: 'eat' as const },
      guest(s, -4, 'carrot_cider', 45_000),
    ]);
    s = { ...s, tavern: { ...s.tavern, tray: [{ item: 'root_ale' }], serveQueue: [-4] } };
    const chips = ordersStrip(s.tavern);
    expect(chips.map((c) => c.guestId)).toEqual([-2, -4, -1]); // -3 eats: no chip
    expect(chips[0]).toMatchObject({ item: 'root_ale', urgent: true, state: 'ready' }); // the one mug serves the neediest ale guest
    expect(chips[1]).toMatchObject({ state: 'queued', urgent: false });
    expect(chips[1]!.patience).toBeCloseTo(0.5);
    expect(chips[2]).toMatchObject({ state: 'waiting', patience: 1 });
    expect(ordersStrip({ guests: [], tray: [], serveQueue: [] })).toEqual([]);
  });
});
