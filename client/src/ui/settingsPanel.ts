// Settings panel (gear button): Export save (downloads one JSON file), Import save (checks the
// version, then loads it), Restore backup (the save from when the game was opened, or from
// before the last import), New game, and the "Debug" toggle (off by default) that shows the x/y/zoom label and the
// Blockers buttons.

import { el, textButton } from './dom.ts';
import { panelShell } from './panelShell.ts';

/** The owner's logo (also the splash and the favicon). */
const LOGO_URL = new URL('../assets/logo.gif', import.meta.url).href;

export interface SettingsHooks {
  exportSave(): string;
  importSave(text: string): void;
  restoreBackup(): void;
  newGame(): void;
  onDebug(on: boolean): void;
  /** The device settings as stored (atmosphere step), and what happens when they change. */
  prefs: { sound: boolean; volume: number; musicVolume?: number; lighting: boolean; cellGrid: boolean; popups: boolean; nameTags: boolean; reduceEffects: boolean };
  onSound(on: boolean): void;
  /** Sound-effects volume. */
  onVolume(volume: number): void;
  /** AU-2: music volume; the Music row only shows when this is wired. */
  onMusicVolume?(volume: number): void;
  onLighting(on: boolean): void;
  onCellGrid(on: boolean): void;
  onPopups(on: boolean): void;
  onNameTags(on: boolean): void;
  /** Reduce effects (outdoors rework C11): a device pref read by the dungeon screen each frame. */
  onReduceEffects(on: boolean): void;
  /** ONBOARD-1: start the first-steps guide again. */
  onReplayGuide(): void;
  /** MISCLICK-PROOF: the effective 'Big tap targets' state now, and its change. */
  bigTaps?: boolean;
  onBigTaps?(on: boolean): void;
}

export interface SettingsPanel {
  readonly el: HTMLElement;
}

export function createSettingsPanel(parent: HTMLElement, hooks: SettingsHooks): SettingsPanel {
  const shell = panelShell(parent, 'settings-panel', 'Settings');
  const panel = shell.el;
  const file = el('input');
  file.type = 'file';
  file.accept = '.json,application/json';
  file.hidden = true;
  file.addEventListener('change', async () => {
    const f = file.files?.[0];
    file.value = '';
    if (f) hooks.importSave(await f.text());
  });

  const exportBtn = textButton('Export save', () => {
    const blob = new Blob([hooks.exportSave()], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = `pixel-hotel-save-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  const importBtn = textButton('Import save', () => file.click());
  const backupBtn = textButton('Restore backup', () => {
    if (window.confirm('Swap the current game with the automatic backup?')) hooks.restoreBackup();
  });
  const newBtn = textButton('New game', () => {
    if (window.confirm('Start a new game? The current game becomes the backup.')) hooks.newGame();
  });
  let debug = false;
  const debugBtn = textButton('Debug: off', () => {
    debug = !debug;
    debugBtn.textContent = `Debug: ${debug ? 'on' : 'off'}`;
    debugBtn.classList.toggle('on', debug);
    hooks.onDebug(debug);
  });

  // Sound and lighting (atmosphere step); saved on this device.
  let sound = hooks.prefs.sound;
  const soundBtn = textButton(`Sound: ${sound ? 'on' : 'off'}`, () => {
    sound = !sound;
    soundBtn.textContent = `Sound: ${sound ? 'on' : 'off'}`;
    soundBtn.classList.toggle('on', sound);
    hooks.onSound(sound);
  });
  soundBtn.classList.toggle('on', sound);
  const volume = el('input', 'volume-slider');
  volume.type = 'range';
  volume.min = '0';
  volume.max = '100';
  volume.step = '5';
  volume.value = String(Math.round(hooks.prefs.volume * 100));
  volume.setAttribute('aria-label', 'Volume');
  const volumeText = el('span', 'volume-value', volume.value);
  volume.addEventListener('input', () => {
    volumeText.textContent = volume.value;
    hooks.onVolume(Number(volume.value) / 100);
  });
  const volumeRow = el('label', 'volume-row');
  volumeRow.append(el('span', '', 'Effects'), volume, volumeText);
  const musicRow = el('label', 'volume-row');
  const music = el('input', 'volume-slider');
  music.type = 'range';
  music.min = '0';
  music.max = '100';
  music.step = '5';
  music.value = String(Math.round((hooks.prefs.musicVolume ?? 0.4) * 100));
  music.setAttribute('aria-label', 'Music volume');
  const musicText = el('span', 'volume-value', music.value);
  music.addEventListener('input', () => {
    musicText.textContent = music.value;
    hooks.onMusicVolume?.(Number(music.value) / 100);
  });
  musicRow.append(el('span', '', 'Music'), music, musicText);
  if (!hooks.onMusicVolume) musicRow.style.display = 'none'; // until game/settingsPanels.ts wires it
  let lighting = hooks.prefs.lighting;
  const lightBtn = textButton(`Lighting: ${lighting ? 'on' : 'off'}`, () => {
    lighting = !lighting;
    lightBtn.textContent = `Lighting: ${lighting ? 'on' : 'off'}`;
    lightBtn.classList.toggle('on', lighting);
    hooks.onLighting(lighting);
  });
  lightBtn.classList.toggle('on', lighting);
  const lightNote = el('p', 'panel-note', 'Turn lighting off if the game feels slow.');
  let cellGrid = hooks.prefs.cellGrid;
  const gridBtn = textButton(`Build grid: ${cellGrid ? 'on' : 'off'}`, () => {
    cellGrid = !cellGrid;
    gridBtn.textContent = `Build grid: ${cellGrid ? 'on' : 'off'}`;
    gridBtn.classList.toggle('on', cellGrid);
    hooks.onCellGrid(cellGrid);
  });
  gridBtn.classList.toggle('on', cellGrid);
  const gridNote = el('p', 'panel-note', 'A faint grid on the floor while you place furniture or paint floors.');

  let popups = hooks.prefs.popups;
  const popBtn = textButton(`Popups: ${popups ? 'on' : 'off'}`, () => {
    popups = !popups;
    popBtn.textContent = `Popups: ${popups ? 'on' : 'off'}`;
    popBtn.classList.toggle('on', popups);
    hooks.onPopups(popups);
  });
  popBtn.classList.toggle('on', popups);
  const popNote = el('p', 'panel-note', 'Small icons float above your head for what you get (blocks, loot, gems).');

  let nameTags = hooks.prefs.nameTags;
  const tagBtn = textButton(`Name tags: ${nameTags ? 'on' : 'off'}`, () => {
    nameTags = !nameTags;
    tagBtn.textContent = `Name tags: ${nameTags ? 'on' : 'off'}`;
    tagBtn.classList.toggle('on', nameTags);
    hooks.onNameTags(nameTags);
  });
  tagBtn.classList.toggle('on', nameTags);
  const tagNote = el('p', 'panel-note', 'Your name on a small plate under your avatar.');

  let reduceFx = hooks.prefs.reduceEffects;
  const fxBtn = textButton(`Reduce effects: ${reduceFx ? 'on' : 'off'}`, () => {
    reduceFx = !reduceFx;
    fxBtn.textContent = `Reduce effects: ${reduceFx ? 'on' : 'off'}`;
    fxBtn.classList.toggle('on', reduceFx);
    hooks.onReduceEffects(reduceFx);
  });
  fxBtn.classList.toggle('on', reduceFx);
  const fxNote = el('p', 'panel-note', 'Calmer fights: no screen shake, freeze frames, sparks or bursts. Damage numbers and sounds stay.');

  // MISCLICK-PROOF: 'Big tap targets' (on by default on touch): a wider finger radius and bigger boxes around guests, taps and machines.
  let bigTaps = hooks.bigTaps ?? false;
  const bigBtn = textButton(`Big tap targets: ${bigTaps ? 'on' : 'off'}`, () => {
    bigTaps = !bigTaps;
    bigBtn.textContent = `Big tap targets: ${bigTaps ? 'on' : 'off'}`;
    bigBtn.classList.toggle('on', bigTaps);
    hooks.onBigTaps?.(bigTaps);
  });
  bigBtn.classList.toggle('on', bigTaps);
  const bigNote = el('p', 'panel-note', 'Easier to hit guests, taps and the stove with a finger.');

  const guideBtn = textButton('Replay the first steps', () => hooks.onReplayGuide());
  const guideNote = el('p', 'panel-note', 'Shows the step-by-step tavern guide again, with the pointers.');
  // Owner 19 Nov: no camera setting; the camera is always locked on you in play mode. Look around is a button in More.

  // The on/off buttons become peg-and-groove switches (skin.css .btn.switch).
  for (const b of [soundBtn, lightBtn, gridBtn, popBtn, tagBtn, fxBtn, bigBtn, debugBtn]) b.classList.add('switch');
  const section = (title: string, ...buttons: HTMLElement[]): HTMLElement => {
    const s = el('div', 'panel-section settings-group');
    s.append(el('h3', 'ribbon', title), ...buttons);
    return s;
  };
  // The logo, small, at the top (x0.5: 128 px, every art px = 2 device px on a phone with ratio 2+).
  const logo = el('img', 'settings-logo');
  logo.src = LOGO_URL;
  logo.alt = 'PocketBarrel';
  logo.width = 128;
  logo.height = 128;
  shell.body.append(logo, section('Sound', soundBtn, musicRow, volumeRow), el('div', 'divider'), section('Look', lightBtn, lightNote, gridBtn, gridNote, popBtn, popNote, tagBtn, tagNote, fxBtn, fxNote, bigBtn, bigNote, guideBtn, guideNote), el('div', 'divider'), section('Save', exportBtn, importBtn, backupBtn, newBtn), el('div', 'divider'), section('Testing', debugBtn), file);
  return { el: panel };
}
