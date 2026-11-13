// The travel panel (step 9b, docs/UI-REFERENCE.md "Travel / Map"): the Map button at the top of the
// right column (under the quest button) opens it. One card per place: Hotel, Shop, Farm, Mine and
// the Dungeon, each with an icon, the name and a short status ("3 crops ripe", "2 items for sale",
// "Opens at level 3", "Key: 10 gold"). A tap on a card goes there. A locked place is greyed out
// with the reason. It replaces the old Hotel / Shop switcher under the info panel.

import { el } from './dom.ts';
import { pixelIcon, type IconName } from './pixelIcons.ts';

export type Place = 'hotel' | 'shop' | 'farm' | 'mine' | 'dungeon';

export interface PlaceCard {
  place: Place;
  status: string;
  /** null = open; else why it is locked. */
  locked: string | null;
  /** The place the player is in now. */
  here: boolean;
}

export interface TravelPanel {
  readonly el: HTMLElement;
  refresh(cards: readonly PlaceCard[]): void;
}

const NAMES: Record<Place, [string, IconName]> = {
  hotel: ['Hotel room', 'house'],
  shop: ['Shop', 'coin'],
  farm: ['Farm', 'sprout'],
  mine: ['Mine', 'hammer'],
  dungeon: ['Dungeon', 'dungeon'],
};

export function createTravelPanel(parent: HTMLElement, go: (place: Place) => void): TravelPanel {
  const panel = el('div', 'frame panel travel-panel');
  const list = el('div', 'travel-list');
  panel.append(el('h2', 'panel-title', 'Map'), list);
  parent.appendChild(panel);
  return {
    el: panel,
    refresh(cards) {
      list.replaceChildren(
        ...cards.map((c) => {
          const [name, icon] = NAMES[c.place];
          const b = el('button', `travel-card${c.here ? ' here' : ''}${c.locked ? ' locked' : ''}`);
          b.type = 'button';
          const slot = el('div', 'slot');
          slot.appendChild(pixelIcon(icon));
          const info = el('div', 'travel-info');
          info.append(el('div', 'catalog-name', c.here ? `${name} (you are here)` : name), el('div', 'catalog-sub', c.locked ?? c.status));
          b.append(slot, info);
          b.disabled = c.locked !== null || c.here;
          b.title = c.locked ?? (c.here ? `You are in the ${name.toLowerCase()}` : `Go to the ${name.toLowerCase()}`);
          b.addEventListener('click', () => go(c.place));
          return b;
        }),
      );
    },
  };
}
