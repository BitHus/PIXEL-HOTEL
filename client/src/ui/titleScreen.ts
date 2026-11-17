// The title screen (UI round 4): after the logo splash, before the game opens. A hanging tavern sign with the logo,
// candle glow, and three wood buttons: Continue (a saved game that reads), New game (over a save it asks first; the
// old save becomes the backup), Settings (sound and volume, device settings kept in prefs). It resolves with the choice;
// core.ts does the rest (open the API, api.newGame() when a save was there). Markup only: no game rules here.

import { tavernLabel, type SavePeek } from '@pixel-hotel/shared';
import { problemMessage } from '../api/localGameAPI.ts';
import { loadPrefs, savePrefs } from '../api/prefs.ts';
import type { SaveStorage } from '../api/saveStorage.ts';
import { el, textButton } from './dom.ts';

const LOGO_URL = new URL('../assets/logo.gif', import.meta.url).href;

export type TitleChoice = 'continue' | 'new';

/** The line under Continue: who and how far, or why it is off. Pure, so it is easy to test. */
export function continueNote(peek: SavePeek): string {
  if (!peek.exists) return 'No saved game yet.';
  if (!peek.canContinue) return peek.problem ? problemMessage(peek.problem) : 'That save has no character yet.';
  const who = peek.playerName ? peek.playerName : 'Your tavern';
  const inn = peek.innName ? `, ${tavernLabel(peek.innName)}` : '';
  const lvl = peek.level ? `, level ${peek.level}` : '';
  return `${who}${inn}${lvl}`;
}

export function runTitleScreen(root: HTMLElement, peek: SavePeek, storage: SaveStorage): Promise<TitleChoice> {
  return new Promise((resolve) => {
    const screen = el('div', 'title-screen');
    const glow = el('div', 'title-glow');
    // The sign: two chains, a wooden board with the logo and the name.
    const sign = el('div', 'title-sign');
    sign.append(el('i', 'title-chain left'), el('i', 'title-chain right'));
    const board = el('div', 'frame title-board');
    const logo = el('img', 'title-logo');
    logo.src = LOGO_URL;
    logo.alt = '';
    logo.draggable = false;
    board.append(logo, el('h1', 'title-name', 'PocketBarrel'), el('p', 'title-tag', 'A tavern of your own'));
    sign.append(board);
    const candleL = el('div', 'title-candle left');
    const candleR = el('div', 'title-candle right');
    for (const c of [candleL, candleR]) c.append(el('i', 'flame'), el('i', 'wax'));

    const menu = el('div', 'title-menu');
    const note = el('p', 'title-note');
    const finish = (c: TitleChoice): void => {
      screen.classList.add('leaving');
      window.setTimeout(() => {
        screen.remove();
        resolve(c);
      }, 160);
    };

    const showMain = (): void => {
      const cont = textButton('Continue', () => finish('continue'), 'title-btn primary');
      cont.disabled = !peek.canContinue;
      note.textContent = continueNote(peek);
      note.classList.toggle('off', !peek.canContinue);
      const fresh = textButton('New game', () => (peek.exists ? showSure() : finish('new')), 'title-btn');
      const sets = textButton('Settings', showSettings, 'title-btn');
      menu.replaceChildren(cont, note, fresh, sets);
      (peek.canContinue ? cont : fresh).focus();
    };

    // New game over a save: ask once; the old game is kept as the backup (Settings -> Backup brings it back).
    const showSure = (): void => {
      const ask = el('p', 'title-note', 'Start over? Your saved game is kept as a backup.');
      const yes = textButton('Start a new game', () => finish('new'), 'title-btn primary');
      const no = textButton('Back', showMain, 'title-btn');
      menu.replaceChildren(ask, yes, no);
      no.focus();
    };

    const showSettings = (): void => {
      const prefs = loadPrefs(storage);
      const sound = textButton(prefs.sound ? 'Sound: on' : 'Sound: off', () => {
        prefs.sound = !prefs.sound;
        sound.textContent = prefs.sound ? 'Sound: on' : 'Sound: off';
        sound.classList.toggle('on', prefs.sound);
        savePrefs(storage, prefs);
      }, 'title-btn');
      sound.classList.toggle('on', prefs.sound);
      const vol = el('input', 'volume-slider');
      vol.type = 'range';
      vol.min = '0';
      vol.max = '100';
      vol.step = '5';
      vol.value = String(Math.round(prefs.volume * 100));
      vol.setAttribute('aria-label', 'Volume');
      vol.addEventListener('change', () => {
        prefs.volume = Number(vol.value) / 100;
        savePrefs(storage, prefs);
      });
      const row = el('div', 'title-volume');
      row.append(el('span', '', 'Volume'), vol);
      const light = textButton(prefs.lighting ? 'Lighting: on' : 'Lighting: off', () => {
        prefs.lighting = !prefs.lighting;
        light.textContent = prefs.lighting ? 'Lighting: on' : 'Lighting: off';
        light.classList.toggle('on', prefs.lighting);
        savePrefs(storage, prefs);
      }, 'title-btn');
      light.classList.toggle('on', prefs.lighting);
      const back = textButton('Back', showMain, 'title-btn primary');
      menu.replaceChildren(sound, row, light, back);
      back.focus();
    };

    screen.append(glow, sign, candleL, candleR, menu);
    root.appendChild(screen);
    showMain();
  });
}
