// The Room panel (step 7, Room button in the right-edge column), for the room the player is in:
// level, size, shop appeal (shop only), Upgrade with its price, and the floor and wall pickers
// with the player's unlocked styles. Picking a style shows it on the room at once (applying is
// free, so the live preview is the change itself; pick again to go back).

import { ROOM_MAX_LEVEL, STYLE_TYPES, styleKey, upgradeCost, type Room, type StyleKind } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { stylePreviewUrl } from '../render/styleArt.ts';

export interface RoomHooks {
  upgrade(roomId: number): void;
  applyStyle(roomId: number, kind: StyleKind, id: string): void;
}

export interface RoomPanel {
  readonly el: HTMLElement;
  refresh(room: Room, gold: number, unlocked: readonly string[], appeal: number | null): void;
}

export function createRoomPanel(parent: HTMLElement, hooks: RoomHooks): RoomPanel {
  const panel = el('div', 'frame panel room-panel');
  const title = el('h2', 'panel-title', 'Room');
  const body = el('div', 'panel-section');
  panel.append(title, body);
  parent.appendChild(panel);

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
      title.textContent = room.kind === 'shop' ? 'Shop' : 'Hotel room';
      const facts = el('div', 'room-facts');
      facts.append(el('div', '', `Level ${room.level} of ${ROOM_MAX_LEVEL}`), el('div', '', `Size ${room.w} x ${room.h}`));
      if (appeal !== null) facts.append(el('div', '', `Appeal ${appeal} / 100`));
      const cost = upgradeCost(room);
      const up = textButton(cost === null ? 'Top level' : `Upgrade: ${cost} gold`, () => hooks.upgrade(room.id));
      up.disabled = cost === null || gold < cost;
      if (cost !== null) up.title = `Level ${room.level + 1}: the room grows to the right and down.`;
      body.replaceChildren(
        facts,
        up,
        el('h3', '', 'Floor'),
        picker(room, 'floor', unlocked),
        el('h3', '', 'Wall'),
        picker(room, 'wall', unlocked),
        el('div', 'panel-info', 'Buy more floors and walls in the Catalog (Decor).'),
      );
    },
  };
}
