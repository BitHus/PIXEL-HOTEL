// The Room panel (step 7, Room button in the right-edge column), for the room the player is in:
// level, size, shop appeal (shop only), Upgrade with its price, and the floor and wall pickers
// with the player's unlocked styles. Picking a style shows it on the room at once (applying is
// free, so the live preview is the change itself; pick again to go back).

import { BUILD_CELL, CELLAR_BUILD_COST, CELLAR_RACK_MAX_BY_LEVEL, CELLAR_UNLOCK_LEVEL, PREP_BONUS, ROOM_MAX_LEVEL, STYLE_TYPES, STAR_THRESHOLDS, type RoomStars, kitchenZone, soilCells, styleKey, upgradeCost, type Room, type StyleKind } from '@pixel-hotel/shared';
import { ROOM_NAMES } from './infoPanel.ts';
import { el, textButton } from './dom.ts';
import { panelShell } from './panelShell.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export interface RoomHooks {
  upgrade(roomId: number): void;
  applyStyle(roomId: number, kind: StyleKind, id: string): void;
  /** Starts painting floor cells (step BG1): the panel closes and the paint bar opens. */
  startPaint(): void;
  /** CEL-2/4: opens another room of the tavern area (tavern, kitchen, cellar). */
  openRoom(roomId: number): void;
  /** CEL-4: builds the cellar (the caller asks first). */
  buildCellar(): void;
}

/** The rooms of the tavern area (CEL-2/4), for the Rooms cards. */
export interface RoomLinks {
  tavernId: number;
  kitchenId?: number;
  cellarId?: number;
  playerLevel: number;
}

export interface RoomPanel {
  readonly el: HTMLElement;
  /** `stars` = the hotel's room stars (step 9g-3, shared roomScore), else null. */
  refresh(room: Room, gold: number, unlocked: readonly string[], appeal: number | null, stars?: RoomStars | null, links?: RoomLinks | null): void;
}

export function createRoomPanel(parent: HTMLElement, hooks: RoomHooks): RoomPanel {
  const shell = panelShell(parent, 'room-panel', 'Room');
  const panel = shell.el;
  const title = shell.title;
  const body = el('div', 'panel-section');
  shell.body.append(body);

  const picker = (room: Room, kind: StyleKind, unlocked: readonly string[]): HTMLElement => {
    const grid = el('div', 'style-grid');
    const current = kind === 'floor' ? room.floorStyle : room.wallStyle;
    for (const s of STYLE_TYPES.filter((x) => x.kind === kind && unlocked.includes(styleKey(kind, x.id)))) {
      const b = el('button', `style-swatch${s.id === current ? ' selected' : ''}`);
      b.type = 'button';
      b.title = s.name;
      b.setAttribute('aria-label', s.name);
      b.style.backgroundImage = `url(${stylePreviewUrl(kind, s.id)})`;
      b.addEventListener('click', () => s.id !== current && hooks.applyStyle(room.id, kind, s.id));
      grid.appendChild(b);
    }
    return grid;
  };

  const roomCards = (room: Room, links: RoomLinks, gold: number): HTMLElement[] => {
    const cards: HTMLElement[] = [el('div', 'divider'), el('h3', '', 'Rooms')];
    const open = (label: string, id: number | undefined, note: string): void => {
      const row = el('div', 'room-card');
      const b = textButton(id === room.id ? `${label} (here)` : `Open ${label.toLowerCase()}`, () => id !== undefined && hooks.openRoom(id));
      b.disabled = id === undefined || id === room.id;
      row.append(b, el('div', 'panel-info', note));
      cards.push(row);
    };
    open('Tavern', links.tavernId, 'Guests, the bar, the taps.');
    open('Kitchen', links.kitchenId, 'Brew at the barrel, cook at the stove. The door is in the back wall of the tavern.');
    if (links.cellarId !== undefined) open('Cellar', links.cellarId, `Mugs left on a keg rack ripen and sell for more. Racks here: up to ${CELLAR_RACK_MAX_BY_LEVEL[(room.kind === 'cellar' ? room.level : 1) - 1]}.`);
    else {
      const b = textButton(`Build the cellar: ${CELLAR_BUILD_COST} gold`, () => hooks.buildCellar());
      const locked = links.playerLevel < CELLAR_UNLOCK_LEVEL;
      b.disabled = locked;
      b.classList.toggle('poor', !locked && gold < CELLAR_BUILD_COST);
      const row = el('div', 'room-card');
      row.append(b, el('div', 'panel-info', locked ? `The cellar opens at level ${CELLAR_UNLOCK_LEVEL}.` : 'A cool room under the tavern with a keg rack: mugs ripen there.'));
      cards.push(row);
    }
    return cards;
  };

  return {
    el: panel,
    refresh(room, gold, unlocked, appeal, stars = null, links = null) {
      title.textContent = ROOM_NAMES[room.kind];
      const facts = el('div', 'room-facts inset');
      facts.append(el('div', '', `Level ${room.level} of ${ROOM_MAX_LEVEL}`), el('div', '', `Size ${room.w} x ${room.h}`));
      if (appeal !== null) {
        facts.append(el('div', '', `Appeal ${appeal} / 100`));
        const bar = el('div', 'skin-bar xp room-appeal');
        const barFill = el('i');
        barFill.style.width = `${Math.max(0, Math.min(100, appeal))}%`;
        bar.append(barFill);
        facts.append(bar);
      }
      if (stars) {
        const row = el('div', 'room-stars');
        const pips = el('span', 'star-row');
        pips.setAttribute('role', 'img');
        pips.setAttribute('aria-label', `${stars.stars} of ${STAR_THRESHOLDS.length} stars`);
        for (let i = 0; i < STAR_THRESHOLDS.length; i++) pips.append(el('i', i < stars.stars ? 'star on' : 'star'));
        row.append(el('span', '', 'Comfort'), pips);
        facts.append(row);
        facts.append(el('div', 'room-star-tip', `${stars.tip}${stars.toNext !== null ? ` (${stars.toNext} more points for the next star)` : ''}`));
      }
      // The kitchen zone (step T1): a staff-only corner; its tint shows while you place things.
      const kitchen = kitchenZone(room);
      if (kitchen) facts.append(el('div', '', `Kitchen ${kitchen.w / BUILD_CELL} x ${kitchen.h / BUILD_CELL} cells (staff only)`));
      const cost = upgradeCost(room);
      // CEL-2/4: the tavern, its kitchen and its cellar: Open cards (the doors in the back wall do the same) and the cellar's Build card.
      const rooms = links && (room.kind === 'shop' || room.kind === 'kitchen' || room.kind === 'cellar') ? roomCards(room, links, gold) : [];
      const up = textButton(cost === null ? 'Top level' : `Upgrade: ${cost} gold`, () => hooks.upgrade(room.id));
      up.disabled = cost === null;
      up.classList.toggle('poor', cost !== null && gold < cost);
      if (cost !== null) up.title = `Level ${room.level + 1}: the room grows to the right and down.`;
      if (room.kind === 'lakeside') {
        // The lakeside is not buildable in v1: no upgrade, no styles, no furniture.
        body.replaceChildren(el('div', 'room-facts inset', `Size ${room.w} x ${room.h}`), el('div', 'panel-info', 'Chop the trees for wood and fish in the lake. You cannot build here.'));
        return;
      }
      if (room.kind === 'farm') {
        // The farm keeps its grass and hedge; an upgrade makes the room bigger. Soil is painted for free.
        facts.append(el('div', '', `Soil cells ${soilCells(room).length}`));
        if (cost !== null) up.title = `Level ${room.level + 1}: the farm grows to the right and down.`;
        body.replaceChildren(
          facts,
          up,
          el('div', 'divider'),
          textButton('Paint soil', () => hooks.startPaint()),
          el('div', 'panel-info', 'Seeds only grow on soil. Paint soil cells (free) or paint grass over them to take soil away. Build paths and fences with blocks.'),
        );
        return;
      }
      body.replaceChildren(
        facts,
        up,
        ...rooms,
        el('div', 'divider'),
        el('h3', '', 'Floor'),
        picker(room, 'floor', unlocked),
        textButton('Paint cells', () => hooks.startPaint()),
        el('div', 'panel-info', 'A swatch covers the whole floor. Paint cells colours one cell or a dragged rectangle.'),
        el('h3', '', 'Wall'),
        picker(room, 'wall', unlocked),
        el('div', 'panel-info', 'Buy more floors and walls in the Catalog (Decor).'),
        ...(kitchen ? [el('div', 'panel-info', `The kitchen is the warm tint while you place things: guests never walk or sit there. A prep table inside it, next to a stove, adds ${PREP_BONUS.perTable} dish to a batch (at most ${PREP_BONUS.max}). A bigger room level grows the kitchen.`)] : []),
      );
    },
  };
}
