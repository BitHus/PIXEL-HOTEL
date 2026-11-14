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
  prefs: { sound: boolean; volume: number; lighting: boolean };
  onSound(on: boolean): void;
  onVolume(volume: number): void;
  onLighting(on: boolean): void;
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

  const section = (title: string, ...buttons: HTMLElement[]): HTMLElement => {
    const s = el('div', 'panel-section');
    s.append(el('h3', '', title), ...buttons);
    return s;
  };
  // The logo, small, at the top (x0.5: 128 px, every art px = 2 device px on a phone with ratio 2+).
  const logo = el('img', 'settings-logo');
  logo.src = LOGO_URL;
  logo.alt = 'Pixel Hotel';
  logo.width = 128;
  logo.height = 128;
  shell.body.append(logo, section('Sound', soundBtn, volumeRow), el('div', 'divider'), section('Look', lightBtn, lightNote), el('div', 'divider'), section('Save', exportBtn, importBtn, backupBtn, newBtn), el('div', 'divider'), section('Testing', debugBtn), file);
  return { el: panel };
}
