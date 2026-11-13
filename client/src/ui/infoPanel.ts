// Top-left: one compact info panel (gold with a coin icon, the room name, the level with an xp
// bar) with the room switcher (Hotel and Shop buttons) right under it. In the dungeon (step 9) the
// room name becomes the floor, an hp bar shows, and the room switcher hides.

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
  /** Level and xp (next = total xp for the next level, null at the top level). */
  setStats(level: number, xp: number, next: number | null, prev: number): void;
  /** In the dungeon: the floor and hp. null = back in a room. */
  setRun(run: { floor: number; maxFloors: number; hp: number; maxHp: number } | null): void;
}

function bar(cls: string, icon: HTMLElement | SVGSVGElement | null): { root: HTMLElement; fill: HTMLElement; text: HTMLElement } {
  const root = el('div', `info-bar ${cls}`);
  const track = el('div', 'bar-track');
  const fill = el('div', 'bar-fill');
  const text = el('span', 'bar-text');
  track.append(fill);
  if (icon) root.append(icon);
  root.append(track, text);
  return { root, fill, text };
}

export function createInfoPanel(parent: HTMLElement, onRoom: (kind: RoomKind) => void): InfoPanel {
  const box = el('div', 'top-left');
  const info = el('div', 'frame info-panel');
  const gold = el('div', 'info-gold');
  const goldText = el('span', '', '0');
  gold.append(pixelIcon('coin'), goldText);
  gold.title = 'Gold';
  const name = el('div', 'info-room');
  const hp = bar('hp-bar', pixelIcon('heart'));
  hp.root.hidden = true;
  hp.root.title = 'Health';
  const level = el('span', 'level-badge', 'Lv 1');
  const xp = bar('xp-bar', level);
  info.append(gold, name, hp.root, xp.root);
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
    setStats(lv, total, next, prev) {
      level.textContent = `Lv ${lv}`;
      const part = next === null ? 1 : (total - prev) / Math.max(1, next - prev);
      xp.fill.style.width = `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%`;
      xp.text.textContent = next === null ? 'max' : `${total}/${next}`;
      xp.root.title = next === null ? `Level ${lv} (the top level)` : `Level ${lv}: ${total} of ${next} xp for level ${lv + 1}`;
    },
    setRun(run) {
      switcher.hidden = run !== null;
      hp.root.hidden = run === null;
      if (!run) return;
      name.textContent = run.maxFloors > 1 ? `Crypt, floor ${run.floor} of ${run.maxFloors}` : 'Crypt';
      const part = Math.max(0, run.hp) / run.maxHp;
      hp.fill.style.width = `${Math.round(part * 100)}%`;
      hp.fill.classList.toggle('low', part <= 0.3);
      hp.text.textContent = `${Math.max(0, run.hp)}/${run.maxHp}`;
    },
  };
}
