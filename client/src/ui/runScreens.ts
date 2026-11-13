// The dungeon's screens (step 9): the Resume panel (a run loaded from a save, or the tab was
// hidden), the exit choice (Go deeper / Leave), and the death and leave summaries. All are
// centered panels in the frame style over a dim shade (like "Buy this?").

import { getFurnitureType, getMaterialType, type RunBag, type RunResult } from '@pixel-hotel/shared';
import { el, textButton } from './dom.ts';
import { pixelIcon } from './pixelIcons.ts';

function modal(parent: HTMLElement, title: string, cls = ''): { shade: HTMLElement; box: HTMLElement } {
  const shade = el('div', 'confirm-shade run-shade');
  const box = el('div', `frame confirm-panel run-panel ${cls}`.trim());
  box.setAttribute('role', 'dialog');
  box.append(el('h2', 'panel-title plate', title));
  shade.appendChild(box);
  parent.appendChild(shade);
  return { shade, box };
}

/** "Paused" with one Resume button. Resolves when tapped (or Enter / Space). */
export function showResume(parent: HTMLElement, text: string): Promise<void> {
  return new Promise((resolve) => {
    const { shade, box } = modal(parent, 'Paused');
    const done = (): void => {
      window.removeEventListener('keydown', onKey, true);
      shade.remove();
      resolve();
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      done();
    };
    const go = textButton('Resume', done, 'confirm-yes');
    box.append(el('div', 'panel-info', text), el('div', 'confirm-buttons', ''));
    box.lastElementChild?.append(go);
    window.addEventListener('keydown', onKey, true);
    go.focus();
  });
}

export type ExitAnswer = 'deeper' | 'leave' | 'stay';

/** The exit: Go deeper (the bag stays at risk) or Leave (bank the bag). 'stay' = not yet. */
export function showExitChoice(parent: HTMLElement, o: { floor: number; maxFloors: number; slots: number; gold: number }): Promise<ExitAnswer> {
  return new Promise((resolve) => {
    const deeper = o.floor < o.maxFloors;
    const { shade, box } = modal(parent, deeper ? 'Stairs down' : 'The way out');
    const finish = (a: ExitAnswer): void => {
      shade.remove();
      resolve(a);
    };
    const bag = o.slots === 0 && o.gold === 0 ? 'Your bag is empty.' : `In your bag: ${o.slots} ${o.slots === 1 ? 'slot' : 'slots'} and ${o.gold} gold.`;
    box.append(
      el('div', 'panel-info', deeper ? `Floor ${o.floor} of ${o.maxFloors}. Go deeper and your bag stays at risk; leave and it is safe.` : 'Leave the crypt and bring your bag home.'),
      el('div', 'panel-info', bag),
    );
    const row = el('div', 'confirm-buttons');
    row.append(textButton('Not yet', () => finish('stay')));
    if (deeper) row.append(textButton('Go deeper', () => finish('deeper')));
    const leave = textButton('Leave', () => finish('leave'), 'confirm-yes');
    row.append(leave);
    box.append(row);
    leave.focus();
  });
}

const KILLER: Record<string, string> = {
  slime: 'A slime',
  skeleton: 'A skeleton',
  bat: 'A bat',
  bone_king: 'The Bone King',
  mimic: 'A mimic',
};

/** One line per bag slot kind: "7 Bone", "Skull lamp". */
export function bagLines(bag: RunBag): string[] {
  const materials = new Map<string, number>();
  const furniture = new Map<string, number>();
  for (const s of bag.slots) {
    if (s.kind === 'material') materials.set(s.id, (materials.get(s.id) ?? 0) + s.qty);
    else furniture.set(s.typeId, (furniture.get(s.typeId) ?? 0) + 1);
  }
  const lines = [...materials].map(([id, n]) => `${n} ${getMaterialType(id as never).name}`);
  for (const [id, n] of furniture) lines.push(n > 1 ? `${n} x ${getFurnitureType(id).name}` : getFurnitureType(id).name);
  return lines;
}

function list(title: string, bag: RunBag): HTMLElement {
  const box = el('div', 'run-list');
  box.append(el('div', 'run-list-title', title));
  const lines = bagLines(bag);
  if (bag.gold > 0) {
    const g = el('div', 'away-total');
    g.append(pixelIcon('coin'), el('span', '', `${bag.gold} gold`));
    box.append(g);
  }
  for (const l of lines) box.append(el('div', 'run-line', l));
  if (lines.length === 0 && bag.gold === 0) box.append(el('div', 'run-line', 'Nothing.'));
  return box;
}

/** The death or leave summary. Resolves when the player taps the button. */
export function showRunResult(parent: HTMLElement, r: RunResult, backTo: string): Promise<void> {
  return new Promise((resolve) => {
    const dead = r.status === 'dead';
    const mine = r.place === 'mine';
    const title = mine
      ? dead
        ? 'You were carried out of the mine'
        : r.lanternOut
          ? 'Your lantern went out'
          : 'Back from the mine'
      : dead
        ? `You fell on floor ${r.floor}`
        : 'You made it out!';
    const { shade, box } = modal(parent, title, dead ? 'run-dead' : 'run-left');
    if (mine && dead) {
      // The mine (step 9c): only half of each ore is lost.
      box.append(el('div', 'panel-info', 'You lost half of the ore from this visit. The rest is home.'));
      box.append(list('Brought home', r.banked));
      box.append(list('Lost', r.lost));
    } else if (dead) {
      if (r.lastHitBy) box.append(el('div', 'panel-info', `${KILLER[r.lastHitBy] ?? 'Something'} dealt the last hit.`));
      box.append(list('Lost', r.lost));
      if (r.banked.gold > 0 || r.banked.slots.length > 0) box.append(list('Kept', r.banked));
    } else {
      box.append(list('Brought home', r.banked));
      if (r.lost.slots.length > 0) box.append(list('Left behind (bag full)', r.lost));
    }
    const xp = el('div', 'run-xp');
    const up = r.levelAfter > r.levelBefore ? ` (up from ${r.levelBefore}!)` : '';
    xp.textContent = `+${r.xpGained} xp. Level ${r.levelAfter}${up}`;
    box.append(xp);
    const row = el('div', 'confirm-buttons');
    const ok = textButton(`Back to the ${backTo}`, () => {
      shade.remove();
      resolve();
    }, 'confirm-yes');
    row.append(ok);
    box.append(row);
    ok.focus();
  });
}

/** A short white flash over the whole screen (level up). */
export function flashScreen(parent: HTMLElement, ms: number): void {
  const f = el('div', 'screen-flash');
  f.style.setProperty('--flash-ms', `${ms}ms`);
  parent.appendChild(f);
  window.setTimeout(() => f.remove(), ms);
}
