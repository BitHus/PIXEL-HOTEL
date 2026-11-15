// The shop's customers, bubbles and sales (R1 split of main.ts: part 9 of 17; the code is unchanged, only moved).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import {
  REACTION_BUBBLE_MS, CHAT_BUBBLE_FADE_MS, readingMs, waitingCount, type Customer, getFurnitureType, type Point,
  type ShopEvent,
} from '@pixel-hotel/shared';
import { goodSpot } from '../render/slotGoods.ts';
import { pixelIcon } from '../ui/pixelIcons.ts';
import { type Place } from '../ui/travelPanel.ts';
import type { G8 } from './ctx.ts';

export async function setupShopLife(g: G8) {
  const {
    panels, api, itemViews, shelfPanel, roomItem, hint, newIntro, popups, mapButton, bubbles, tillCoins,
    customers, hops, sound, floats, sprite, toast, st, late,
  } = g;
  late.travelTo = travelTo;
  late.refreshShop = refreshShop;
  late.refreshHint = refreshHint;

  const roomLevels = new Map<number, number>();
  const roomLevel = (id: number): number => roomLevels.get(id) ?? 1;
late.roomLevel = roomLevel;
  async function travelTo(place: Place): Promise<void> {
    panels.close();
    if (place === 'dungeon') return late.enterDungeonAsked();
    if (place === 'mine') return late.enterMineAsked();
    await late.openRoomKind(place);
  }

  async function refreshShop(): Promise<void> {
    st.shop = await api.getShop();
    itemViews.setGoods(st.shop.slots, st.items);
    shelfPanel.refresh(st.shop, st.inventory);
    const open = roomItem(shelfPanel.uid);
    if (panels.open === 'shelf' && !open) panels.close();
  }
  async function refreshHint(): Promise<void> {
    hint.set(newIntro.running ? null : await api.currentHint());
    // A finished quest pays gems (step BG4): the popup shows them.
    popups.show(await api.takeGains());
  }
  /** Step 9d: "n waiting" on the Map button while customers wait at the till. */
  const mapBadge = document.createElement('span');
  mapBadge.className = 'btn-badge map-badge';
  mapButton.appendChild(mapBadge);
  /** Customers at the till, and (step 9t) orders to serve and coins on the tables, as one badge on the Map button. */
  let tillWaiting = 0;
  const updateBadge = (): void => {
    const orders = st.tavern.guests.filter((g) => g.phase === 'order' && g.order).length;
    const coins = st.tavern.mess.filter((m) => m.coins > 0).length;
    const parts = [tillWaiting > 0 ? `${tillWaiting} waiting` : '', orders > 0 ? `${orders} ${orders === 1 ? 'order' : 'orders'}` : '', coins > 0 ? `${coins} ${coins === 1 ? 'coin pile' : 'coin piles'}` : ''].filter(Boolean);
    mapBadge.hidden = parts.length === 0;
    mapBadge.textContent = parts.join(', ');
    mapButton.title = parts.length > 0 ? `Map: travel (${parts.join(', ')} in your tavern)` : 'Map: travel';
  };
  const showWaiting = (list: readonly Customer[]): void => {
    tillWaiting = waitingCount(list);
    updateBadge();
  };
  /** A world point on a placed item: slot `index` of its goods (bottom middle). */
  const slotPoint = (shelfUid: number, index: number): Point | null => {
    const item = st.items.find((i) => i.uid === shelfUid && i.roomId === st.room.id);
    if (!item) return null;
    const t = getFurnitureType(item.typeId);
    const at = goodSpot(t, item.facing, index, t.slots);
    return { x: item.x + at.x, y: item.y + at.y };
  };
  /** Where a customer puts the item down on the counter while paying (left of the till). */
  const counterTop = (): Point | null => {
    const c = st.items.find((i) => i.roomId === st.room.id && getFurnitureType(i.typeId).servedFromBehind);
    if (!c) return null;
    const at = goodSpot(getFurnitureType(c.typeId), c.facing, 0, 2);
    return { x: c.x + at.x, y: c.y + at.y };
  };
  /** A customer's line (and a reaction face with it) in a bubble at reading pace. */
  const sayBubble = (customerId: number, text: string, icon?: Node): void => {
    const node = document.createElement('span');
    node.className = 'npc-line';
    if (icon) node.appendChild(icon);
    node.appendChild(document.createTextNode(text));
    bubbles.addNode(customerId, node, readingMs(text, REACTION_BUBBLE_MS) + CHAT_BUBBLE_FADE_MS);
  };
  /** The latest customers (to know when someone waits at the till). */
  st.shopCustomers = st.shop.customers;
  api.onShop((e: ShopEvent) => {
    const here = st.room.id === st.shop.roomId;
    switch (e.t) {
      case 'thinking': {
        // Browsing: a "..." thought bubble while the customer looks at the item.
        if (here) bubbles.addNode(e.customerId, document.createTextNode('...'), e.ms);
        break;
      }
      case 'paying': {
        if (!here) break;
        tillCoins.add(e.till);
        // The customer puts the item on the counter (it hops there and waits).
        const loot = customers.heldOf(e.customerId);
        const from = customers.handPoint(e.customerId);
        const to = counterTop();
        if (loot && from && to) {
          customers.gesture(e.customerId, 'reach');
          customers.hold(e.customerId, null);
          hops.add(e.customerId, loot, from, () => to, { stay: true });
        }
        break;
      }
      case 'say':
        if (here) sayBubble(e.customerId, e.text);
        break;
      case 'customers':
        // The door bell: someone new came in.
        if (here && e.customers.some((c) => !st.shopCustomers.some((o) => o.id === c.id))) sound.play('bell');
        st.shopCustomers = e.customers;
        showWaiting(e.customers);
        customers.sync(here ? e.customers : [], st.room.id, st.items);
        break;
      case 'reaction': {
        if (!here) break;
        if (e.line) sayBubble(e.customerId, e.line, pixelIcon(e.reaction));
        else bubbles.addNode(e.customerId, pixelIcon(e.reaction), REACTION_BUBBLE_MS);
        // Taking: a reach, and the item hops from the slot into their hands.
        const from = e.took ? slotPoint(e.took.shelfUid, e.took.index) : null;
        if (e.took && from) {
          const loot = e.took.loot;
          const id = e.customerId;
          customers.gesture(id, 'reach');
          customers.hold(id, null);
          hops.add(id, loot, from, () => customers.handPoint(id), { done: () => customers.hold(id, loot) });
        }
        break;
      }
      case 'sale': {
        sound.play('coin');
        if (here) {
          floats.add(e.till, e.price);
          // The shopkeeper hands it back: the item hops from the counter to the customer, who nods.
          sprite.gesture('hand');
          const id = e.customerId;
          const from = counterTop();
          const loot = hops.lootOf(id) ?? customers.heldOf(id);
          if (from && loot) {
            hops.add(id, loot, from, () => customers.handPoint(id), {
              done: () => {
                customers.hold(id, loot, true);
                customers.gesture(id, 'nod');
              },
            });
          }
        } else toast(`Sold for ${e.price} gold in your shop.`);
        void late.refreshInventory();
        void refreshShop();
        break;
      }
      case 'slots':
        void refreshShop();
        void late.refreshInventory();
        break;
    }
  });

  return { roomLevels, refreshShop, refreshHint, updateBadge, showWaiting, sayBubble };
}
