// The WORLDS panel (step 9b travel panel; UI-2 renamed it, docs/OWNER-PLAYTEST-2.md): the globe button at the top of the
// right column (under the quest button) opens it. One card per place, like a navigator: Hotel, Tavern, Farm, Lakeside
// (step 9f), Mine and the Dungeon, each with a small picture (worldArt.ts), the name and a short status ("3 crops ripe", "2 items for sale",
// "Opens at level 3", "Key: 10 gold"). A tap on a card goes there. A locked place is greyed out
// with the reason. It replaces the old Hotel / Shop switcher under the info panel.

import { el } from './dom.ts';
import { panelShell } from './panelShell.ts';
import { worldArtUrl } from './worldArt.ts';

export type Place = 'hotel' | 'shop' | 'farm' | 'lakeside' | 'mine' | 'dungeon';

export interface PlaceCard {
  place: Place;
  status: string;
  /** null = open; else why it is locked. */
  locked: string | null;
  /** The place the player is in now. */
  here: boolean;
  /** A small badge on the card (step 9d: "2 waiting" on the Tavern), or none. */
  badge?: string;
}

export interface TravelPanel {
  readonly el: HTMLElement;
  refresh(cards: readonly PlaceCard[]): void;
}

const NAMES: Record<Place, string> = {
  hotel: 'Hotel room',
  shop: 'Tavern',
  farm: 'Farm',
  lakeside: 'Lakeside',
  mine: 'Mine',
  dungeon: 'Dungeon',
};

export function createTravelPanel(parent: HTMLElement, go: (place: Place) => void): TravelPanel {
  const shell = panelShell(parent, 'travel-panel worlds-panel', 'Worlds');
  const panel = shell.el;
  const list = el('div', 'travel-list');
  shell.body.append(el('p', 'worlds-hint', 'Where to? Tap a world to walk through its door.'), list);
  return {
    el: panel,
    refresh(cards) {
      list.replaceChildren(
        ...cards.map((c) => {
          const name = NAMES[c.place];
          const b = el('button', `travel-card world-card place-${c.place}${c.here ? ' here' : ''}${c.locked ? ' locked' : ''}`);
          b.type = 'button';
          const pic = el('div', 'world-pic');
          const img = el('img', 'world-img');
          img.src = worldArtUrl(c.place);
          img.alt = '';
          img.draggable = false;
          pic.append(img);
          const info = el('div', 'travel-info');
          info.append(el('div', 'catalog-name', name), el('div', 'catalog-sub', c.locked ?? c.status));
          b.append(pic, info);
          if (c.badge) b.append(el('span', 'btn-badge card-badge', c.badge));
          if (c.here) b.append(el('span', 'plate here-tag', 'Here'));
          if (c.locked) b.append(el('span', 'lock-tag', 'Locked'));
          b.disabled = c.locked !== null || c.here;
          b.title = c.locked ?? (c.here ? `You are in the ${name.toLowerCase()}` : `Go to the ${name.toLowerCase()}`);
          b.addEventListener('click', () => go(c.place));
          return b;
        }),
      );
    },
  };
}
