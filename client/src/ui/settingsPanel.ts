// Settings panel (gear button): Export save (downloads one JSON file), Import save (checks the
// version, then loads it), Restore backup (the save from when the game was opened, or from
// before the last import), New game, and the "Debug" toggle (off by default) that shows the x/y/zoom label and the
// Blockers buttons.

import { el, textButton } from './dom.ts';
import { panelShell } from './panelShell.ts';

export interface SettingsHooks {
  exportSave(): string;
  importSave(text: string): void;
  restoreBackup(): void;
  newGame(): void;
  onDebug(on: boolean): void;
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

  const section = (title: string, ...buttons: HTMLElement[]): HTMLElement => {
    const s = el('div', 'panel-section');
    s.append(el('h3', '', title), ...buttons);
    return s;
  };
  shell.body.append(section('Save', exportBtn, importBtn, backupBtn, newBtn), el('div', 'divider'), section('Testing', debugBtn), file);
  return { el: panel };
}
