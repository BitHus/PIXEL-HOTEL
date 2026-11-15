// The tavern: guests, orders, coins on the tables (R1 split of main.ts: part 10 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  REACTION_BUBBLE_MS, getFurnitureType, type FurnitureItem, type Point, SERVE_QUEUE_MAX, brewReadyInMs, seatKey,
  tavernSeats, type Guest,
} from '@pixel-hotel/shared';
import { CustomerViews, type Walker } from '../render/customerViews.ts';
import { TableMess, type Meal } from '../render/tableMess.ts';
import { createOrderBubbles, type OrderMark } from '../ui/orderBubbles.ts';
import { drawGood } from '../render/slotGoods.ts';
import { pixelIcon } from '../ui/pixelIcons.ts';
import type { G9 } from './ctx.ts';

export async function setupTavernLife(g: G9) {
  const {
    api, view, ui, updateBadge, toast, sound, popups, sayBubble, bubbles, customers, follow, sprite, st, late,
  } = g;

  // ---------- The tavern (step 9t): guests, orders, coins on the tables ----------
  st.tavern = await api.getTavern();
  const guests = new CustomerViews(view);
  const tableMess = new TableMess(view);
  /** A guest as a walker: they only sit once they have reached their seat, and look at the table. */
  const walkers = (list: readonly Guest[]): Walker[] =>
    list.map((g) => ({ id: g.id, look: g.look, x: g.x, y: g.y, facing: g.facing, path: g.path, speed: g.speed, seat: g.seated && g.seat ? { uid: g.seat.uid } : null, sitFacing: g.facing }));
  const inTavern = (): boolean => st.room.id === st.tavern.roomId;
  const orders = createOrderBubbles(ui, (id) => void serveTap(id));
  /** The open orders for the order bubbles: queued or carried ones are dimmed, a guest with little patience is urgent. */
  const orderMarks = (): OrderMark[] =>
    st.tavern.guests.flatMap((g) =>
      g.phase === 'order' && g.order ? [{ guestId: g.id, item: g.order.item, urgent: g.warned, taken: st.tavern.serveQueue.includes(g.id) || st.tavern.holding?.guestId === g.id }] : [],
    );
  /** What guests eat or drink now, on their table spots (the served item stays there until they leave). */
  const meals = (): Meal[] => {
    const seats = tavernSeats(st.items, st.tavern.roomId);
    return st.tavern.guests.flatMap((g) => {
      const seat = g.phase === 'eat' && g.order && g.seat ? seats.find((k) => seatKey(k) === seatKey(g.seat!)) : undefined;
      return seat && g.order ? [{ guestId: g.id, item: g.order.item, spot: seat.spot }] : [];
    });
  };
  /** Draws the tavern as it is now (guests, coins and dishes, order bubbles, the Map badge). */
  const syncTavern = (): void => {
    const on = inTavern();
    guests.sync(on ? walkers(st.tavern.guests) : [], st.room.id, st.items);
    tableMess.sync(on ? st.tavern.mess : [], on ? meals() : [], st.items);
    orders.sync(on ? orderMarks() : []);
    updateBadge();
  };
  st.onItemsSynced = syncTavern;
  async function refreshTavern(): Promise<void> {
    st.tavern = await api.getTavern();
    syncTavern();
  }
  /** A tap on a guest or an order bubble: the order is carried to the table (taps queue up, at most SERVE_QUEUE_MAX). */
  async function serveTap(guestId: number): Promise<void> {
    if (st.tavern.serveQueue.length >= SERVE_QUEUE_MAX) {
      toast(`${SERVE_QUEUE_MAX} orders are waiting to be carried already.`);
      return;
    }
    if (!(await api.serveGuest(guestId))) toast('There is no way to the bar.');
    else sound.play('click');
    await refreshTavern();
  }
  /** A tap on something of the tavern: a guest with an order, coins or a dish on a table, a brewing barrel. True when handled. */
  const tavernTap = (world: Point, hit: FurnitureItem | undefined): boolean => {
    if (!inTavern()) return false;
    const gid = guests.at(world);
    const guest = gid === null ? undefined : st.tavern.guests.find((g) => g.id === gid);
    if (guest?.phase === 'order' && guest.order) {
      void serveTap(guest.id);
      return true;
    }
    const m = tableMess.at(world);
    if (m) {
      if (st.tavern.holding || st.tavern.serveQueue.length > 0) toast('Serve the orders first.');
      else void api.tidyTable(m.messId, m.what).then((ok) => ok || toast('There is no way to that table.'));
      return true;
    }
    if (hit && getFurnitureType(hit.typeId).brews) {
      void brewTap(hit);
      return true;
    }
    return false;
  };
  /** A tap on a brewing barrel: a ready brew is collected (mugs in the bag); else it says how long is left. */
  async function brewTap(barrel: FurnitureItem): Promise<void> {
    const r = await api.collectBrew(barrel.uid);
    if (r) {
      sound.play('pop');
      popups.show(r.gains);
      return;
    }
    await refreshTavern();
    const brew = st.tavern.brews.find((b) => b.barrelUid === barrel.uid);
    if (!brew) toast('The barrel is empty.');
    else toast(`Brewing: ready in ${Math.max(1, Math.ceil(brewReadyInMs(brew, Date.now()) / 60_000))} min.`);
  }
  st.seatedGuests = 0;
  api.onTavern((e) => {
    const on = inTavern();
    switch (e.t) {
      case 'guests': {
        // The door bell for new arrivals; a soft murmur when three or more sit.
        if (on && e.guests.some((g) => !st.tavern.guests.some((o) => o.id === g.id))) sound.play('bell');
        const sitting = e.guests.filter((g) => g.seated).length;
        if (on && sitting >= 3 && st.seatedGuests < 3) sound.play('murmur');
        st.seatedGuests = sitting;
        st.tavern = { ...st.tavern, guests: e.guests };
        syncTavern();
        void refreshTavern();
        break;
      }
      case 'say':
        if (on) sayBubble(e.guestId, e.text);
        break;
      case 'order':
        if (on) bubbles.addNode(e.guestId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        void late.refreshInventory(); // the unit leaves the bag when the guest orders
        break;
      case 'refuse':
        if (on) bubbles.addNode(e.guestId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        break;
      case 'sip':
        if (on) guests.gesture(e.guestId, 'nod');
        break;
      case 'unhappy':
        if (on) bubbles.addNode(e.guestId, pixelIcon('frown'), REACTION_BUBBLE_MS);
        void refreshTavern();
        void late.refreshInventory(); // the unserved order is back in the bag
        break;
      case 'coins':
        void refreshTavern();
        break;
      case 'to_stall':
        // They walk on past the market stall as a shop customer.
        void api.getShop().then((s) => {
          st.shop = s;
          st.shopCustomers = s.customers;
          customers.sync(st.room.id === st.shop.roomId ? s.customers : [], st.room.id, st.items);
        });
        break;
      case 'walk':
        follow(e.path);
        st.goal = null;
        break;
      case 'holding':
        sprite.setHeld(e.item ? drawGood({ kind: 'material', id: e.item, qty: 1 }) : null);
        void refreshTavern();
        break;
      case 'served':
        sound.play('clink');
        sprite.gesture('hand');
        void refreshTavern();
        void late.refreshInventory();
        break;
      case 'collected':
        sound.play('coin');
        popups.show(e.gains);
        void refreshTavern();
        void late.refreshInventory(); // the gold shows in the info panel
        break;
      case 'cleared':
        sound.play('pop');
        void refreshTavern();
        break;
      case 'queue':
        st.tavern = { ...st.tavern, serveQueue: e.queue };
        syncTavern();
        break;
    }
  });

  return { guests, tableMess, orders, syncTavern, tavernTap };
}
