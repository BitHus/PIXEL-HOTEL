// Top-left: one compact info panel (gold with a coin icon, and the room name) with the room
// switcher (Hotel and Shop buttons) right under it.

import type { RoomKind } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface InfoPanel {
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
