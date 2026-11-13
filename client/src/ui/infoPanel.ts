// Top-left: one compact info panel (gold with a coin icon, the room name, the level with an xp
// bar). In the dungeon (step 9) the room name becomes the floor and an hp bar shows. In the mine
// (step 9c) the name is "Mine" and the lantern bar shows how long the lantern still burns. (The Hotel /
// Shop switcher that sat under it is gone since step 9b: the Map button's travel panel replaced it.)

import type { RoomKind } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

export interface InfoPanel {
  /** The top-left column (the hint box goes under the info panel). */
  readonly column: HTMLElement;
  /** Where coins fly to: the middle of the gold coin icon (screen px), read when called. */
  coinTarget(): () => { x: number; y: number };
  setGold(gold: number): void;
  setRoom(kind: RoomKind): void;
  /** Level and xp (next = total xp for the next level, null at the top level). */
  setStats(level: number, xp: number, next: number | null, prev: number): void;
  /** In the dungeon: the floor and hp. null = back in a room. */
  setRun(run: { floor: number; maxFloors: number; hp: number; maxHp: number; lantern?: { leftMs: number; totalMs: number } } | null): void;
}

export const ROOM_NAMES: Record<RoomKind, string> = { hotel: 'Hotel room', shop: 'Shop', farm: 'Farm' };

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

export function createInfoPanel(parent: HTMLElement): InfoPanel {
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
  const lantern = bar('lantern-bar', pixelIcon('lantern'));
  lantern.root.hidden = true;
  lantern.root.title = 'Lantern: when it goes out, you walk out with everything';
  info.append(gold, name, lantern.root, hp.root, xp.root);
  box.append(info);
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
      name.textContent = ROOM_NAMES[kind];
    },
    setStats(lv, total, next, prev) {
      level.textContent = `Lv ${lv}`;
      const part = next === null ? 1 : (total - prev) / Math.max(1, next - prev);
      xp.fill.style.width = `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%`;
      xp.text.textContent = next === null ? 'max' : `${total}/${next}`;
      xp.root.title = next === null ? `Level ${lv} (the top level)` : `Level ${lv}: ${total} of ${next} xp for level ${lv + 1}`;
    },
    setRun(run) {
      hp.root.hidden = run === null;
      lantern.root.hidden = !run?.lantern;
      if (!run) return;
      name.textContent = run.lantern ? 'Mine' : run.maxFloors > 1 ? `Crypt, floor ${run.floor} of ${run.maxFloors}` : 'Crypt';
      if (run.lantern) {
        const left = Math.max(0, run.lantern.leftMs);
        lantern.fill.style.width = `${Math.round((left / run.lantern.totalMs) * 100)}%`;
        lantern.fill.classList.toggle('low', left <= 30_000);
        const s = Math.ceil(left / 1000);
        lantern.text.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
      }
      const part = Math.max(0, run.hp) / run.maxHp;
      hp.fill.style.width = `${Math.round(part * 100)}%`;
      hp.fill.classList.toggle('low', part <= 0.3);
      hp.text.textContent = `${Math.max(0, run.hp)}/${run.maxHp}`;
    },
  };
}
