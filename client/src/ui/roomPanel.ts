// The Room panel (step 7, Room button in the right-edge column), for the room the player is in:
// level, size, shop appeal (shop only), Upgrade with its price, and the floor and wall pickers
// with the player's unlocked styles. Picking a style shows it on the room at once (applying is
// free, so the live preview is the change itself; pick again to go back).

import { ROOM_MAX_LEVEL, STYLE_TYPES, soilCells, styleKey, upgradeCost, type Room, type StyleKind } from '@pixel-hotel/shared';
import { ROOM_NAMES } from './infoPanel.ts';
import { el, textButton } from './dom.ts';
import { panelShell } from './panelShell.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export interface RoomHooks {
  upgrade(roomId: number): void;
  applyStyle(roomId: number, kind: StyleKind, id: string): void;
  /** Starts painting floor cells (step BG1): the panel closes and the paint bar opens. */
  startPaint(): void;
}

export interface RoomPanel {
  readonly el: HTMLElement;
  refresh(room: Room, gold: number, unlocked: readonly string[], appeal: number | null): void;
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

  return {
    el: panel,
    refresh(room, gold, unlocked, appeal) {
      title.textContent = ROOM_NAMES[room.kind];
      const facts = el('div', 'room-facts inset');
      facts.append(el('div', '', `Level ${room.level} of ${ROOM_MAX_LEVEL}`), el('div', '', `Size ${room.w} x ${room.h}`));
      if (appeal !== null) facts.append(el('div', '', `Appeal ${appeal} / 100`));
      const cost = upgradeCost(room);
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
        el('div', 'divider'),
        el('h3', '', 'Floor'),
        picker(room, 'floor', unlocked),
        textButton('Paint cells', () => hooks.startPaint()),
        el('div', 'panel-info', 'A swatch covers the whole floor. Paint cells colours one cell or a dragged rectangle.'),
        el('h3', '', 'Wall'),
        picker(room, 'wall', unlocked),
        el('div', 'panel-info', 'Buy more floors and walls in the Catalog (Decor).'),
      );
    },
  };
}
