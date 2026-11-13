// Top-left: one compact info panel (gold with a coin icon, and the room name) with the room
// switcher (Hotel and Shop buttons) right under it.

import type { RoomKind } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface InfoPanel {
  /** The top-left column (the hint box goes under the room switcher). */
  readonly column: HTMLElement;
  /** Where coins fly to: the middle of the gold coin icon (screen px), read when called. */
  coinTarget(): () => { x: number; y: number };
  setGold(gold: number): void;
  setRoom(kind: RoomKind): void;
}

export function createInfoPanel(parent: HTMLElement, onRoom: (kind: RoomKind) => void): InfoPanel {
  const box = el('div', 'top-left');
  const info = el('div', 'frame info-panel');
  const gold = el('div', 'info-gold');
  const goldText = el('span', '', '0');
  gold.append(pixelIcon('coin'), goldText);
  gold.title = 'Gold';
  const name = el('div', 'info-room');
  info.append(gold, name);
  const switcher = el('div', 'room-switch');
  const hotel = textButton('Hotel', () => onRoom('hotel'));
  const shop = textButton('Shop', () => onRoom('shop'));
  switcher.append(hotel, shop);
  box.append(info, switcher);
  parent.appendChild(box);
  return {
    column: box,
    coinTarget() {
      return () => {
        const r = (gold.querySelector('.pixel-icon') ?? gold).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
    },
    setGold(n) {
      goldText.textContent = String(n);
    },
    setRoom(kind) {
      name.textContent = kind === 'hotel' ? 'Hotel room' : 'Shop';
      hotel.classList.toggle('on', kind === 'hotel');
      shop.classList.toggle('on', kind === 'shop');
    },
  };
}
