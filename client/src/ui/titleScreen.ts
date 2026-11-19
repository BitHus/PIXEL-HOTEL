// The title screen (UI round 5): after the logo splash, before the game opens. A hanging tavern sign with the logo,
// candle glow, and three wood buttons: Continue (a saved game that reads), New game (over a save it asks first; the
// old save becomes the backup), Settings (sound and volume, device settings kept in prefs). It resolves with the choice;
// core.ts does the rest (open the API, api.newGame() when a save was there). Markup only: no game rules here.

import { tavernLabel, type SavePeek } from '@pixel-hotel/shared';
import { problemMessage } from '../api/localGameAPI.ts';
import { loadPrefs, savePrefs } from '../api/prefs.ts';
import type { SaveStorage } from '../api/saveStorage.ts';
import { el, textButton } from './dom.ts';

const LOGO_URL = new URL('../assets/logo.gif', import.meta.url).href;
const LIFE_URL = (name: string): string => new URL(`../assets/sprites/furniture/${name}.png`, import.meta.url).href;

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

/** 'just now', '5 min ago', '3 h ago', 'yesterday', '4 days ago' (pure, now passed in). */
export function savedAgo(savedAt: number, now: number): string {
  const min = Math.max(0, Math.round((now - savedAt) / 60000));
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  if (min < 60 * 24) return `${Math.round(min / 60)} h ago`;
  const d = Math.round(min / 1440);
  return d === 1 ? 'yesterday' : `${d} days ago`;
}

export function runTitleScreen(root: HTMLElement, peek: SavePeek, storage: SaveStorage): Promise<TitleChoice> {
  return new Promise((resolve) => {
    const screen = el('div', 'title-screen');
    const glow = el('div', 'title-glow');
    const motes = el('div', 'title-motes');
    for (let i = 0; i < 16; i++) motes.append(el('i', 'mote'));
    // The still-life along the floor: furniture sprites (title.css sizes and places them).
    const life = el('div', 'title-life');
    for (const [cls, file] of [['life-a', 'barrel'], ['life-b', 'bar_stool'], ['life-c', 'sofa'], ['life-d', 'plant'], ['life-e', 'lamp']] as const) {
      const img = el('img', cls);
      img.src = LIFE_URL(file);
      img.alt = '';
      img.draggable = false;
      life.append(img);
    }
    const head = el('div', 'title-head');
    const logo = el('img', 'title-logo');
    logo.src = LOGO_URL;
    logo.alt = 'PocketBarrel';
    logo.draggable = false;
    head.append(logo, el('p', 'title-tag', 'A tavern of your own'));

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
      const when = el('p', 'title-note when', peek.canContinue && peek.savedAt ? `Saved ${savedAgo(peek.savedAt, Date.now())}` : '');
      const fresh = textButton('New game', () => (peek.exists ? showSure() : finish('new')), 'title-btn');
      const sets = textButton('Settings', showSettings, 'title-link');
      menu.replaceChildren(cont, note, when, fresh, sets);
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

    screen.append(glow, motes, life, head, menu, el('p', 'title-version', 'PocketBarrel · private test'));
    root.appendChild(screen);
    showMain();
  });
}
