// Settings > Account (docs/PLAN-ONLINE.md ON-1): register, log in, sync now, import the local save into the cloud. Only built when the cloud
// feature flag is on (game/settingsPanels.ts); nothing here holds a rule. Reuses the existing frame, button and input classes.

import type { CloudSave, SyncResult } from '../api/cloudSave.ts';
import { el, textButton } from './dom.ts';

export interface AccountHooks {
  cloud: CloudSave;
  /** The stored save file text of this device (with its real savedAt), or null. */
  localSaveText(): string | null;
  /** Loads a downloaded cloud save (the game reloads). */
  importCloudSave(text: string): void;
}

const MESSAGES: Record<string, string> = {
  network: 'Could not reach the server. Your game is safe on this device.',
  unauthorized: 'Please log in again.',
  rate_limited: 'Too many tries. Wait a little and try again.',
  too_large: 'The save is too big for the cloud.',
  newer_on_server: 'The cloud has a newer save. Use Sync now to fetch it.',
  too_new: 'Please reload the game to update, then try again.',
  bad_login: 'Wrong name or password.',
  username_taken: 'That name is taken.',
  username_length: 'The name needs 3 to 16 characters.',
  username_chars: 'Use letters, digits and _, starting with a letter.',
  username_reserved: 'That name is not allowed.',
  password_short: 'The password needs at least 8 characters.',
  password_long: 'The password is too long.',
  password_common: 'Pick a less common password.',
  age_required: 'Please confirm you are 13 or older.',
  bad_state: 'This save looks damaged and was not uploaded.',
  invalid: 'This save could not be read by the server.',
};

export function accountMessage(error: string): string {
  return MESSAGES[error] ?? 'Something went wrong. Try again later.';
}

export function createAccountSection(hooks: AccountHooks): HTMLElement {
  const section = el('div', 'panel-section settings-group account-section');
  const note = el('p', 'panel-note');
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
  const ageRow = el('label', 'volume-row');
  const age = el('input');
  age.type = 'checkbox';
  ageRow.append(age, el('span', '', 'I am 13 or older'));

  const say = (text: string): void => {
    message.textContent = text;
  };
  const busy = (b: HTMLButtonElement, run: () => Promise<void>): (() => void) => () => {
    b.disabled = true;
    void run().finally(() => {
      b.disabled = false;
    });
  };

  const registerBtn = textButton('Create account', () => {});
  const loginBtn = textButton('Log in', () => {});
  const logoutBtn = textButton('Log out', () => {});
  const syncBtn = textButton('Sync now', () => {});
  const importBtn = textButton('Import local save', () => {});

  const show = (): void => {
    const user = hooks.cloud.username();
    note.textContent = user ? `Signed in as ${user}. Your game also lives in the cloud.` : 'Optional: keep your game in the cloud to play on another device. Play offline works without it.';
    for (const x of [name, pass, ageRow, registerBtn, loginBtn]) x.hidden = user !== null;
    for (const x of [logoutBtn, syncBtn, importBtn]) x.hidden = user === null;
  };

  const report = (r: { ok: boolean; error?: string }, okText: string): void => say(r.ok ? okText : accountMessage(r.error ?? ''));
  const handleSync = (r: SyncResult): void => {
    if (!r.ok) return say(accountMessage(r.error));
    if (r.action === 'download') {
      say('Loading the newer cloud save...');
      hooks.importCloudSave(r.text);
      return;
    }
    say(r.action === 'uploaded' ? 'Saved to the cloud.' : 'Already up to date.');
  };

  registerBtn.onclick = busy(registerBtn, async () => {
    const r = await hooks.cloud.register(name.value.trim(), pass.value, age.checked);
    pass.value = '';
    report(r, 'Account created. You are signed in.');
    show();
  });
  loginBtn.onclick = busy(loginBtn, async () => {
    const r = await hooks.cloud.login(name.value.trim(), pass.value);
    pass.value = '';
    report(r, 'Signed in.');
    show();
    // First login on a device: the newer of the two saves wins (the cloud one is fetched only after the player taps Sync now).
  });
  logoutBtn.onclick = busy(logoutBtn, async () => {
    await hooks.cloud.logout();
    say('Signed out. Your game stays on this device.');
    show();
  });
  syncBtn.onclick = busy(syncBtn, async () => {
    handleSync(await hooks.cloud.syncNow(hooks.localSaveText()));
    show();
  });
  importBtn.onclick = busy(importBtn, async () => {
    const text = hooks.localSaveText();
    if (text === null) return say('There is no save on this device yet.');
    if (!window.confirm('Put this device\'s save in the cloud? A newer cloud save is never overwritten.')) return;
    report(await hooks.cloud.uploadLocal(text), 'This device\'s save is now in the cloud.');
    show();
  });

  section.append(el('h3', 'ribbon', 'Account (beta)'), note, name, pass, ageRow, registerBtn, loginBtn, syncBtn, importBtn, logoutBtn, message);
  show();
  return section;
}
