// The Account panel (ON-5, docs/PLAN-ONLINE.md): open from More; only built when the cloud build flag is on (VITE_CLOUD_SAVE=1 + VITE_SERVER_URL).
// Create account / log in (name + password, 13+ box, no email), log out, cloud save status, Sync now and the save-conflict dialog.
// Holds no rule: sync decisions are shared/src/saveConflict.ts + api/cloudSave.ts.

import type { CloudResult, CloudSave, SyncResult } from '../api/cloudSave.ts';
import { accountMessage, saveTime } from './accountText.ts';
import { el, textButton } from './dom.ts';
import { panelShell } from './panelShell.ts';
import { askSaveConflict } from './saveConflictDialog.ts';

export interface AccountHooks {
  cloud: CloudSave;
  /** The stored save file text of this device (with its real savedAt), or null. */
  localSaveText(): string | null;
  /** Loads a cloud save or a re-stamped local one (the game reloads). */
  importCloudSave(text: string): void;
  /** The clock (passed in). */
  now(): number;
}

export interface AccountPanel {
  readonly el: HTMLElement;
  /** Redraw from the stored session (call when the panel opens). */
  refresh(): void;
}

export function createAccountPanel(parent: HTMLElement, hooks: AccountHooks): AccountPanel {
  const shell = panelShell(parent, 'workshop-panel account-panel', 'Account');
  const { cloud } = hooks;
  const note = el('p', 'panel-note account-status');
  const message = el('p', 'panel-note account-message');
  message.setAttribute('role', 'status');
  const name = el('input', 'name-input');
  name.type = 'text';
  name.maxLength = 16;
  name.placeholder = 'Name';
  name.autocomplete = 'username';
  name.setAttribute('aria-label', 'Account name');
  const pass = el('input', 'name-input');
  pass.type = 'password';
  pass.maxLength = 72;
  pass.placeholder = 'Password (8 or more)';
  pass.autocomplete = 'current-password';
  pass.setAttribute('aria-label', 'Password');
  const ageRow = el('label', 'volume-row account-age');
  const age = el('input');
  age.type = 'checkbox';
  ageRow.append(age, el('span', '', 'I am 13 or older'));
  const privacy = el('p', 'panel-note', 'Only a name and a password. No email. Offline play always works without an account.');

  const registerBtn = textButton('Create account', () => {});
  const loginBtn = textButton('Log in', () => {});
  const logoutBtn = textButton('Log out', () => {});
  const syncBtn = textButton('Sync now', () => {});
  registerBtn.classList.add('primary');
  loginBtn.classList.add('primary');
  const busyBtns = [registerBtn, loginBtn, logoutBtn, syncBtn];

  const say = (text: string): void => {
    message.textContent = text;
  };
  const show = (): void => {
    const user = cloud.username();
    note.textContent = user ? `Signed in as ${user}. Last synced: ${saveTime(cloud.lastSyncedAt())}.` : 'Not signed in. Your game is only on this device.';
    for (const x of [name, pass, ageRow, privacy, registerBtn, loginBtn]) x.hidden = user !== null;
    for (const x of [logoutBtn, syncBtn]) x.hidden = user === null;
  };
  const guard = (run: () => Promise<void>): (() => void) => () => {
    if (busyBtns.some((b) => b.disabled)) return;
    for (const b of busyBtns) b.disabled = true;
    void run().finally(() => {
      for (const b of busyBtns) b.disabled = false;
      show();
    });
  };

  /** Applies a finished sync: download = import (reload), conflict = ask, else a status line. */
  async function handleSync(r: SyncResult): Promise<void> {
    if (!r.ok) return say(accountMessage(r.error));
    if (r.action === 'download') {
      say('Loading the cloud save...');
      hooks.importCloudSave(r.text);
      return;
    }
    if (r.action === 'conflict') {
      say('Two different saves. Choose one.');
      const choice = await askSaveConflict(parent, r.localAt, r.remoteAt);
      if (choice === null) return say('Nothing changed. Tap Sync now to choose later.');
      const done = await cloud.resolve(choice, hooks.localSaveText(), hooks.now());
      if (!done.ok) return say(accountMessage(done.error));
      say(choice === 'cloud' ? 'Loading the cloud save...' : 'Keeping this device. Saved to the cloud.');
      hooks.importCloudSave(done.text);
      return;
    }
    say(r.action === 'uploaded' ? 'Saved to the cloud.' : 'Already up to date.');
  }

  const enter = (run: () => Promise<CloudResult>, okText: string) =>
    guard(async () => {
      const r = await run();
      pass.value = '';
      if (!r.ok) return say(accountMessage(r.error));
      say(okText);
      show();
      await handleSync(await cloud.syncNow(hooks.localSaveText()));
    });
  registerBtn.onclick = enter(() => cloud.register(name.value.trim(), pass.value, age.checked), 'Account created. You are signed in.');
  loginBtn.onclick = enter(() => cloud.login(name.value.trim(), pass.value), 'Signed in.');
  logoutBtn.onclick = guard(async () => {
    await cloud.logout();
    say('Signed out. Your game stays on this device.');
  });
  syncBtn.onclick = guard(async () => handleSync(await cloud.syncNow(hooks.localSaveText())));

  shell.body.append(note, name, pass, ageRow, privacy, registerBtn, loginBtn, syncBtn, logoutBtn, message);
  show();
  return { el: shell.el, refresh: show };
}
