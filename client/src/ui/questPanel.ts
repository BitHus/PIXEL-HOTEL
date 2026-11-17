// The Quest panel (TUT-2 part 3, OA-15): tabs Daily / Events / Achievements. Rows come from the pure quest board
// (shared/src/questBoard.ts); a ready row has a Take button that pays gold. No timers, no streaks, nothing to buy.

import type { QuestBoard, QuestRow } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { panelShell, tabBar } from './panelShell.ts';

type Tab = 'daily' | 'events' | 'achievements';

export interface QuestPanel {
  readonly el: HTMLElement;
  /** Draws a fresh board. */
  refresh(board: QuestBoard, firstStep?: string | null): void;
}

export function createQuestPanel(parent: HTMLElement, take: (claimId: string) => void): QuestPanel {
  const shell = panelShell(parent, 'quest-panel', 'Quests');
  const list = el('div', 'quest-list');
  shell.body.appendChild(list);
  let tab: Tab = 'daily';
  let board: QuestBoard | null = null;
  let firstStep: string | null = null;
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

  const rowEl = (r: QuestRow): HTMLElement => {
    const d = el('div', `quest-row${r.claimed ? ' done' : ''}${r.ready ? ' ready' : ''}`);
    const text = el('div', 'quest-row-text', r.text);
    const bar = el('div', 'quest-bar');
    const fill = el('div', 'quest-bar-fill');
    fill.style.width = `${Math.round((r.progress / r.target) * 100)}%`;
    bar.appendChild(fill);
    const side = el('div', 'quest-row-side');
    if (r.claimed) side.append(el('span', 'quest-state', 'Done'));
    else if (r.ready) side.append(textButton(r.gold > 0 ? `Take ${r.gold} gold` : 'Take', () => take(r.claimId), 'quest-take'));
    else side.append(el('span', 'quest-state', r.target > 1 ? `${r.progress} / ${r.target}` : r.gold > 0 ? `${r.gold} gold` : ''));
    d.append(text, bar, side);
    return d;
  };

  function draw(): void {
    mark(tab);
    list.replaceChildren();
    if (!board) return;
    if (tab === 'daily') {
      if (firstStep) list.append(el('div', 'panel-info', `First step: ${firstStep}`));
      list.append(el('div', 'panel-info', 'Three small goals a day. Skip any day: nothing is lost, and what you leave comes back with the next day.'));
      for (const r of board.daily) list.appendChild(rowEl(r));
    } else if (tab === 'events') {
      if (!board.event) list.append(el('div', 'panel-info', 'No event right now. Events come with the seasons.'));
      else {
        list.append(el('h3', 'quest-event-name', board.event.name), el('div', 'panel-info', board.event.blurb));
        for (const r of board.event.rows) list.appendChild(rowEl(r));
      }
    } else {
      const done = board.achievements.filter((r) => r.claimed).length;
      list.append(el('div', 'panel-info', `${done} of ${board.achievements.length} done.`));
      for (const r of board.achievements) list.appendChild(rowEl(r));
    }
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
