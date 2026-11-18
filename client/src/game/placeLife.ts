// Travel, the quest card and the Map badge (R1 split of main.ts: part 9 of 17; since step S1 this is no longer the
// shop's customers: the loot customers are gone, the tavern's guests are in tavernLife.ts).
// It runs once, in order, from start() in main.ts; what later parts need is returned.

import { REACTION_BUBBLE_MS, CHAT_BUBBLE_FADE_MS, readingMs } from '@pixel-hotel/shared';
import { type Place } from '../ui/travelPanel.ts';
import type { G8 } from './ctx.ts';

export async function setupPlaceLife(g: G8) {
  const { panels, api, hint, newIntro, popups, mapButton, bubbles, st, late } = g;
  late.travelTo = travelTo;
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

  async function refreshHint(): Promise<void> {
    hint.set(newIntro.running ? null : await api.currentHint());
    // A finished quest pays gems (step BG4): the popup shows them.
    popups.show(await api.takeGains());
  }
  /** The Map button's badge: what waits in the tavern (orders to serve, coins on the tables). */
  const mapBadge = document.createElement('span');
  mapBadge.className = 'btn-badge map-badge';
  mapButton.appendChild(mapBadge);
  const updateBadge = (): void => {
    const orders = st.tavern.guests.filter((g) => g.phase === 'order' && g.order).length;
    const coins = st.tavern.mess.filter((m) => m.coins > 0).length;
    // In the tavern itself the orders strip shows what waits: no badge there (nor in the cellar); elsewhere it counts the tavern's orders and coins.
    const away = st.room.id !== st.tavern.roomId && !st.tavern.workRooms.includes(st.room.id);
    const parts = !away ? [] : [orders > 0 ? `${orders} ${orders === 1 ? 'order' : 'orders'}` : '', coins > 0 ? `${coins} ${coins === 1 ? 'coin pile' : 'coin piles'}` : ''].filter(Boolean);
    mapBadge.hidden = parts.length === 0;
    mapBadge.textContent = parts.join(', ');
    mapButton.title = parts.length > 0 ? `Worlds: travel (${parts.join(', ')} in your tavern)` : 'Worlds: travel';
  };
  /** A guest's line (and a reaction face with it) in a bubble at reading pace. */
  const sayBubble = (guestId: number, text: string, icon?: Node): void => {
    const node = document.createElement('span');
    node.className = 'npc-line';
    if (icon) node.appendChild(icon);
    node.appendChild(document.createTextNode(text));
    bubbles.addNode(guestId, node, readingMs(text, REACTION_BUBBLE_MS) + CHAT_BUBBLE_FADE_MS);
  };

  return { roomLevels, refreshHint, updateBadge, sayBubble };
}
