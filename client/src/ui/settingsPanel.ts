// Settings panel (gear button): Export save (downloads one JSON file), Import save (checks the
// version, then loads it), Restore backup (the save from when the game was opened, or from
// before the last import), New game, and the "Debug" toggle (off by default) that shows the x/y/zoom label and the
// Blockers buttons.

import { createAccountSection, type AccountHooks } from './accountSection.ts';
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
  prefs: { sound: boolean; volume: number; lighting: boolean; cellGrid: boolean; popups: boolean; nameTags: boolean; reduceEffects: boolean; followCamera: boolean };
  onSound(on: boolean): void;
  onVolume(volume: number): void;
  onLighting(on: boolean): void;
  onCellGrid(on: boolean): void;
  onPopups(on: boolean): void;
  onNameTags(on: boolean): void;
  /** Reduce effects (outdoors rework C11): a device pref read by the dungeon screen each frame. */
  onReduceEffects(on: boolean): void;
  /** CAM-LOCK: true = camera locked on the avatar while it walks (old followCamera), false = free look. */
  onFollowCamera(on: boolean): void;
  /** ONBOARD-1: start the first-steps guide again. */
  onReplayGuide(): void;
  /** ON-1: the Account section (cloud save). Absent = the feature flag is off and the section is not built. */
  account?: AccountHooks;
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
  volumeRow.append(el('span', '', 'Volume'), volume, volumeText);
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

  let follow = hooks.prefs.followCamera;
  const followBtn = textButton(`Camera: ${follow ? 'Locked while walking' : 'Free look'}`, () => {
    follow = !follow;
    followBtn.textContent = `Camera: ${follow ? 'Locked while walking' : 'Free look'}`;
    followBtn.classList.toggle('on', follow);
    hooks.onFollowCamera(follow);
  });
  followBtn.classList.toggle('on', follow);
  const guideBtn = textButton('Replay the first steps', () => hooks.onReplayGuide());
  const guideNote = el('p', 'panel-note', 'Shows the step-by-step tavern guide again, with the pointers.');
  const followNote = el('p', 'panel-note', 'Locked: while you walk you stay exactly in the middle of the screen. Standing still, drag to look around; walking again brings the camera back. Free look: the camera stays where you put it.');

  // The on/off buttons become peg-and-groove switches (skin.css .btn.switch).
  for (const b of [soundBtn, lightBtn, gridBtn, popBtn, tagBtn, fxBtn, followBtn, debugBtn]) b.classList.add('switch');
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
  shell.body.append(logo, section('Sound', soundBtn, volumeRow), el('div', 'divider'), section('Look', lightBtn, lightNote, gridBtn, gridNote, popBtn, popNote, tagBtn, tagNote, fxBtn, fxNote, followBtn, followNote, guideBtn, guideNote), el('div', 'divider'), section('Save', exportBtn, importBtn, backupBtn, newBtn), el('div', 'divider'), ...(hooks.account ? [createAccountSection(hooks.account), el('div', 'divider')] : []), section('Testing', debugBtn), file);
  return { el: panel };
}
