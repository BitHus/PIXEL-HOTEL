// Top-left: one compact info panel, two short lines (UI polish step): the coin and the gold, then
// the room name and the level with a thin xp bar. In the dungeon (step 9) the room name becomes the floor and an hp bar shows. In the mine
// (step 9c) the name is "Mine" and the lantern bar shows how long the lantern still burns. (The Hotel /
// Shop switcher that sat under it is gone since step 9b: the Map button's travel panel replaced it.)

import { tavernLabel, type RoomKind } from '@pixel-hotel/shared';
import { el } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';
import { countTween } from './countUp.ts';

export interface InfoPanel {
  /** The top-left column (the hint box goes under the info panel). */
  readonly column: HTMLElement;
  /** The info panel itself (panels on a phone start under it). */
  readonly panel: HTMLElement;
  /** Where coins fly to: the middle of the gold coin icon (screen px), read when called. */
  coinTarget(): () => { x: number; y: number };
  setGold(gold: number): void;
  /** The gems next to the gold (step BG5). */
  setGems(gems: number): void;
  /** The Inn's name (MB-1), the first line of the panel (class info-inn; the artist styles the plate). */
  setInnName(name: string): void;
  setRoom(kind: RoomKind): void;
  /** Level and xp (next = total xp for the next level, null at the top level). */
  setStats(level: number, xp: number, next: number | null, prev: number): void;
  /** In the dungeon: the floor and hp. null = back in a room. */
  setRun(run: { floor: number; maxFloors: number; hp: number; maxHp: number; lantern?: { leftMs: number; totalMs: number } } | null): void;
}

export const ROOM_NAMES: Record<RoomKind, string> = { hotel: 'Hotel room', shop: 'Tavern', farm: 'Farm', lakeside: 'Lakeside', cellar: 'Cellar' };

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
  // The purse (currency pass): two plates in the same dark trough, the gold coin with butter numbers and the cut gem with cyan numbers.
  const gold = el('div', 'info-gold');
  const goldText = el('span', 'cur-num', '0');
  const goldPlate = el('span', 'cur cur-gold');
  goldPlate.append(pixelIcon('coin'), goldText);
  goldPlate.title = 'Gold';
  const gemText = el('span', 'cur-num', '0');
  const gems = el('span', 'cur cur-gems');
  gems.append(pixelIcon('gem'), gemText);
  gems.title = 'Gems: you find them by playing';
  gold.append(goldPlate, gems);
  const goldCount = countTween(goldText, goldPlate);
  const gemCount = countTween(gemText, gems);
  // Line 2: the room name, the level and a thin xp bar (the numbers are in its tooltip).
  const line = el('div', 'info-line');
  const name = el('span', 'info-room');
  const level = el('span', 'level-badge', 'Lv 1');
  const xpTrack = el('div', 'bar-track');
  const xp = { root: line, fill: el('div', 'bar-fill'), text: el('span') };
  xpTrack.append(xp.fill);
  line.append(name, level, xpTrack);
  const hp = bar('hp-bar', pixelIcon('heart'));
  hp.root.hidden = true;
  hp.root.title = 'Health';
  const lantern = bar('lantern-bar', pixelIcon('lantern'));
  lantern.root.hidden = true;
  lantern.root.title = 'Lantern: when it goes out, you walk out with everything';
  const inn = el('div', 'info-inn');
  inn.title = 'Your tavern';
  info.append(inn, gold, line, lantern.root, hp.root);
  box.append(info);
  parent.appendChild(box);
  return {
    column: box,
    panel: info,
    coinTarget() {
      return () => {
        const r = (gold.querySelector('.pixel-icon') ?? gold).getBoundingClientRect();
        return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      };
    },
    setGold(n) {
      goldCount.set(n);
    },
    setGems(n) {
      gemCount.set(n);
    },
    setInnName(n) {
      inn.textContent = tavernLabel(n);
      inn.hidden = n === '';
    },
    setRoom(kind) {
      name.textContent = ROOM_NAMES[kind];
    },
    setStats(lv, total, next, prev) {
      level.textContent = `Lv ${lv}`;
      const part = next === null ? 1 : (total - prev) / Math.max(1, next - prev);
      xp.fill.style.width = `${Math.round(Math.min(1, Math.max(0, part)) * 100)}%`;
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
