// The Quest panel (TUT-2 part 3, OA-15): tabs Daily / Events / Achievements. Rows come from the pure quest board
// (shared/src/questBoard.ts); a ready row has a Claim button that pays gold. No timers, no streaks, nothing to buy.
// Row = icon, text + progress bar, and at the right the reward chip (open), the Claim button (ready) or a Done stamp.

import type { QuestBoard, QuestRow } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { panelShell, tabBar } from './panelShell.ts';
import { type IconName, pixelIcon } from './pixelIcons.ts';

type Tab = 'daily' | 'events' | 'achievements';

export interface QuestPanel {
  readonly el: HTMLElement;
  /** Draws a fresh board. */
  refresh(board: QuestBoard, firstStep?: string | null): void;
}

const KIND_ICON: Record<QuestRow['kind'], IconName> = { daily: 'quest', event: 'worlds', achievement: 'journal' };

/** Ready rows first, taken rows last; inside a group the board's order stays. */
const rank = (r: QuestRow): number => (r.ready ? 0 : r.claimed ? 2 : 1);
const sorted = (rows: readonly QuestRow[]): QuestRow[] => [...rows].sort((a, b) => rank(a) - rank(b));

/** Texts longer than this are folded to 2 lines. */
const LONG_TEXT = 70;

const pct = (done: number, total: number): string => `${total > 0 ? Math.max(0, Math.min(100, Math.round((done / total) * 100))) : 0}%`;

function meterBar(done: number, total: number): HTMLElement {
  const bar = el('div', 'skin-bar quest-bar');
  const fill = el('i');
  fill.style.width = pct(done, total);
  bar.appendChild(fill);
  return bar;
}

function reward(gold: number): HTMLElement {
  const c = el('span', 'quest-reward');
  c.append(pixelIcon('coin'), el('span', '', String(gold)));
  return c;
}

function empty(icon: IconName, title: string, text: string): HTMLElement {
  const d = el('div', 'quest-empty');
  const box = el('div', 'quest-empty-icon');
  box.append(pixelIcon(icon));
  d.append(box, el('div', 'quest-empty-title', title), el('div', 'panel-info', text));
  return d;
}

/** A slim "label, bar, n / m" line on top of a list. */
function tally(label: string, done: number, total: number): HTMLElement {
  const d = el('div', 'quest-tally');
  d.append(el('span', 'quest-tally-label', label), meterBar(done, total), el('span', 'quest-count', `${done} / ${total}`));
  return d;
}

export function createQuestPanel(parent: HTMLElement, take: (claimId: string) => void): QuestPanel {
  const shell = panelShell(parent, 'quest-panel', 'Quests');
  const list = el('div', 'quest-list');
  shell.body.appendChild(list);
  let tab: Tab = 'daily';
  let drawnTab: Tab | null = null;
  let board: QuestBoard | null = null;
  let firstStep: string | null = null;
  /** Long texts the player opened (kept over the redraws). */
  const opened = new Set<string>();
  const mark = tabBar<Tab>(
    shell.tabs,
    [
      ['daily', 'quest', 'Daily'],
      ['events', 'worlds', 'Events'],
      ['achievements', 'journal', 'Achievements'],
    ],
    (t) => {
      tab = t;
      draw();
    },
  );
  // A dot on each tab that has something to claim (the tab buttons are the children of shell.tabs, in order).
  const tabDots = ([...shell.tabs.children] as HTMLElement[]).map((b) => {
    const d = el('span', 'new-dot quest-tab-dot');
    d.hidden = true;
    b.appendChild(d);
    return d;
  });

  const rowEl = (r: QuestRow): HTMLElement => {
    const d = el('div', `quest-row ${r.claimed ? 'done' : r.ready ? 'ready' : 'todo'}`);
    const icon = el('div', 'quest-row-icon');
    icon.append(pixelIcon(KIND_ICON[r.kind]));
    if (r.claimed) icon.append(el('span', 'quest-check'));
    const main = el('div', 'quest-row-main');
    const text = el('div', 'quest-row-text', r.text);
    main.append(text);
    // A long text (the first-steps achievements) shows 2 lines; a tap on it opens the rest.
    if (r.text.length > LONG_TEXT) {
      text.classList.add('long');
      text.classList.toggle('open', opened.has(r.claimId));
      text.addEventListener('click', () => {
        if (!opened.delete(r.claimId)) opened.add(r.claimId);
        text.classList.toggle('open', opened.has(r.claimId));
      });
    }
    // A one-step quest needs no bar: its state says it all.
    if (r.target > 1) {
      const meter = el('div', 'quest-meter');
      meter.append(meterBar(r.progress, r.target), el('span', 'quest-count', `${Math.min(r.progress, r.target)} / ${r.target}`));
      main.append(meter);
    }
    const side = el('div', 'quest-row-side');
    if (r.claimed) side.append(el('span', 'quest-stamp', 'Done'));
    else if (r.ready) {
      const b = textButton('Claim', () => take(r.claimId), 'primary quest-take');
      b.setAttribute('aria-label', r.gold > 0 ? `Claim ${r.gold} gold` : 'Claim');
      if (r.gold > 0) b.append(reward(r.gold));
      side.append(b);
    } else if (r.gold > 0) side.append(reward(r.gold));
    d.append(icon, main, side);
    return d;
  };

  function draw(): void {
    mark(tab);
    // The board is redrawn every few seconds: keep the scroll place while the tab stays the same.
    const keep = drawnTab === tab ? shell.body.scrollTop : 0;
    drawnTab = tab;
    list.replaceChildren();
    if (!board) return;
    const ready = [board.daily, board.event?.rows ?? [], board.achievements].map((rows) => rows.some((r) => r.ready));
    tabDots.forEach((d, i) => {
      d.hidden = !ready[i];
    });
    if (tab === 'daily') {
      if (firstStep) {
        const step = el('div', 'quest-first');
        step.append(pixelIcon('quest'), el('span', '', `First step: ${firstStep}`));
        list.append(step);
      }
      if (board.daily.length === 0) list.append(empty('quest', 'No goals today', 'New goals come with the next day.'));
      else {
        list.append(tally('Today', board.daily.filter((r) => r.claimed).length, board.daily.length));
        for (const r of sorted(board.daily)) list.appendChild(rowEl(r));
        list.append(el('div', 'panel-info quest-note', 'Three small goals a day. Skip any day: nothing is lost, and what you leave comes back with the next day.'));
      }
    } else if (tab === 'events') {
      if (!board.event) list.append(empty('worlds', 'No event right now', 'Events come with the seasons.'));
      else {
        const head = el('div', 'quest-event');
        head.append(el('h3', 'quest-event-name', board.event.name), el('div', 'panel-info', board.event.blurb));
        list.append(head);
        for (const r of sorted(board.event.rows)) list.appendChild(rowEl(r));
      }
    } else if (board.achievements.length === 0) list.append(empty('journal', 'Nothing here yet', 'Achievements show up as you play.'));
    else {
      list.append(tally('Done', board.achievements.filter((r) => r.claimed).length, board.achievements.length));
      for (const r of sorted(board.achievements)) list.appendChild(rowEl(r));
    }
    shell.body.scrollTop = keep;
  }

  return {
    el: shell.el,
    refresh(b, step = null) {
      board = b;
      firstStep = step;
      draw();
    },
  };
}
