// Cloud save client (docs/PLAN-ONLINE.md ON-1, stage A). A small module on its own: the game rules and LocalGameAPI know nothing about it.
// Behind a build flag that defaults to OFF: VITE_CLOUD_SAVE=1 plus VITE_SERVER_URL (the live game does not change without them).
// The local save stays the offline copy; the newest savedAt wins (the server decides on upload, decideSync decides here).

import { planSync, restampSave } from '@pixel-hotel/shared';
import type { SaveStorage } from './saveStorage.ts';

export const CLOUD_SESSION_KEY = 'pixel-hotel-cloud-session';
/** The savedAt both sides had after the last successful sync on this device (a device setting, not part of the game save). */
export const CLOUD_LASTSYNC_KEY = 'pixel-hotel-cloud-lastsync';

export interface CloudConfig {
  baseUrl: string;
}

/** The cloud config from the Vite env, or null (feature off). */
export function cloudConfig(env: { VITE_CLOUD_SAVE?: string; VITE_SERVER_URL?: string }): CloudConfig | null {
  if (env.VITE_CLOUD_SAVE !== '1' || !env.VITE_SERVER_URL) return null;
  return { baseUrl: env.VITE_SERVER_URL.replace(/\/+$/, '') };
}

export type SyncAction = 'upload' | 'download' | 'none';

/** Newest savedAt wins. No cloud save yet = upload the local one; no local save = download; a tie changes nothing. */
export function decideSync(localSavedAt: number | null, remoteSavedAt: number | null): SyncAction {
  if (localSavedAt === null && remoteSavedAt === null) return 'none';
  if (remoteSavedAt === null) return 'upload';
  if (localSavedAt === null) return 'download';
  if (localSavedAt > remoteSavedAt) return 'upload';
  if (localSavedAt < remoteSavedAt) return 'download';
  return 'none';
}

export type CloudError = 'network' | 'unauthorized' | 'rate_limited' | 'too_large' | 'newer_on_server' | 'too_new' | string;

export type CloudResult<T = object> = ({ ok: true } & T) | { ok: false; error: CloudError };

/** What a sync did. 'download' carries the save text: the caller imports it (which reloads the page). */
export type SyncResult = CloudResult<
  { action: 'uploaded' | 'unchanged' } | { action: 'download'; text: string; savedAt: number } | { action: 'conflict'; localAt: number; remoteAt: number }
>;

export interface CloudSave {
  /** The signed-in name, or null. */
  username(): string | null;
  register(username: string, password: string, age13: boolean): Promise<CloudResult>;
  login(username: string, password: string): Promise<CloudResult>;
  logout(): Promise<void>;
  /** Compares this device's save with the cloud one and uploads or fetches the newer. `localText` is the stored save file text (or null). */
  syncNow(localText: string | null): Promise<SyncResult>;
  /** The savedAt of the last successful sync on this device, or null. */
  lastSyncedAt(): number | null;
  /** After a 'conflict': the player's choice. 'cloud' fetches the cloud save (action 'download'); 'local' re-stamps this device's save above the cloud one and uploads it (action 'kept': the caller imports `text` so both sides match). */
  resolve(choice: 'cloud' | 'local', localText: string | null, now: number): Promise<CloudResult<{ action: 'download' | 'kept'; text: string; savedAt: number }>>;
  /** Puts this device's save in the cloud (first login: import the local save). A newer cloud save refuses it. */
  uploadLocal(localText: string): Promise<CloudResult>;
}

interface Session {
  token: string;
  username: string;
}

export function createCloudSave(cfg: CloudConfig, storage: SaveStorage, fetchFn: typeof fetch = (...a) => fetch(...a)): CloudSave {
  const readSession = (): Session | null => {
    try {
      const raw = storage.get(CLOUD_SESSION_KEY);
      const o = raw === null ? null : (JSON.parse(raw) as Partial<Session>);
      return o && typeof o.token === 'string' && typeof o.username === 'string' ? { token: o.token, username: o.username } : null;
    } catch {
      return null;
    }
  };
  const writeSession = (s: Session | null): void => {
    if (s) storage.set(CLOUD_SESSION_KEY, JSON.stringify(s));
    else storage.remove(CLOUD_SESSION_KEY);
  };

  async function call(path: string, init: RequestInit & { auth?: boolean } = {}): Promise<{ status: number; body: Record<string, unknown> } | null> {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string> | undefined) };
    if (init.auth) {
      const s = readSession();
      if (!s) return { status: 401, body: { error: 'unauthorized' } };
      headers.authorization = `Bearer ${s.token}`;
    }
    try {
      const res = await fetchFn(cfg.baseUrl + path, { ...init, headers });
      let body: Record<string, unknown> = {};
      try {
        body = (await res.json()) as Record<string, unknown>;
      } catch {
        // An empty or non-JSON body: the status alone tells.
      }
      return { status: res.status, body };
    } catch {
      return null;
    }
  }

  const errorOf = (r: { status: number; body: Record<string, unknown> } | null): CloudError => {
    if (!r) return 'network';
    if (r.status === 401 && readSession()) writeSession(null); // the session ended: sign in again
    return typeof r.body.error === 'string' ? r.body.error : `http_${r.status}`;
  };

  const readLast = (): number | null => {
    const raw = storage.get(CLOUD_LASTSYNC_KEY);
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) && v > 0 ? v : null;
  };
  const writeLast = (at: number): void => {
    storage.set(CLOUD_LASTSYNC_KEY, String(at));
  };
  const savedAtOf = (text: string | null): number | null => {
    if (text === null) return null;
    try {
      const f = JSON.parse(text) as { savedAt?: unknown };
      return typeof f.savedAt === 'number' ? f.savedAt : null;
    } catch {
      return null;
    }
  };
  async function fetchCloud(): Promise<{ ok: true; text: string; savedAt: number } | { ok: false; error: CloudError }> {
    const got = await call('/api/save', { auth: true });
    if (!got || got.status !== 200 || typeof got.body.save !== 'object' || got.body.save === null) return { ok: false, error: errorOf(got) };
    const save = got.body.save as { savedAt?: unknown };
    const at = typeof got.body.savedAt === 'number' ? got.body.savedAt : typeof save.savedAt === 'number' ? save.savedAt : 0;
    return { ok: true, text: JSON.stringify(got.body.save), savedAt: at };
  }

  async function enter(path: string, username: string, body: object, okStatus: number): Promise<CloudResult> {
    const r = await call(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!r || r.status !== okStatus || typeof r.body.token !== 'string') return { ok: false, error: errorOf(r) };
    writeSession({ token: r.body.token, username: typeof r.body.username === 'string' ? r.body.username : username });
    return { ok: true };
  }

  return {
    username: () => readSession()?.username ?? null,
    register: (username, password, age13) => enter('/api/register', username, { username, password, age13 }, 201),
    login: (username, password) => enter('/api/login', username, { username, password }, 200),
    lastSyncedAt: readLast,
    async logout() {
      await call('/api/logout', { method: 'POST', auth: true });
      writeSession(null);
      storage.remove(CLOUD_LASTSYNC_KEY);
    },
    async resolve(choice, localText, now) {
      if (choice === 'cloud') {
        const c = await fetchCloud();
        if (!c.ok) return c;
        writeLast(c.savedAt);
        return { ok: true, action: 'download', text: c.text, savedAt: c.savedAt };
      }
      const meta = await call('/api/save/meta', { auth: true });
      if (!meta || (meta.status !== 200 && meta.status !== 404)) return { ok: false, error: errorOf(meta) };
      const remoteAt = meta.status === 200 && typeof meta.body.savedAt === 'number' ? meta.body.savedAt : 0;
      const text = localText === null ? null : restampSave(localText, remoteAt, now);
      if (text === null) return { ok: false, error: 'not_a_save' };
      const up = await call('/api/save', { method: 'PUT', auth: true, headers: { 'content-type': 'application/json' }, body: text });
      if (!up || up.status !== 200) return { ok: false, error: errorOf(up) };
      const at = savedAtOf(text) ?? remoteAt;
      writeLast(at);
      return { ok: true, action: 'kept', text, savedAt: at };
    },
    async uploadLocal(localText) {
      const r = await call('/api/save', { method: 'PUT', auth: true, headers: { 'content-type': 'application/json' }, body: localText });
      if (r && r.status === 200) {
        const at = savedAtOf(localText);
        if (at !== null) writeLast(at);
        return { ok: true };
      }
      return { ok: false, error: errorOf(r) };
    },
    async syncNow(localText) {
      const localAt = savedAtOf(localText);
      const meta = await call('/api/save/meta', { auth: true });
      if (!meta || (meta.status !== 200 && meta.status !== 404)) return { ok: false, error: errorOf(meta) };
      const remoteAt = meta.status === 200 && typeof meta.body.savedAt === 'number' ? meta.body.savedAt : null;
      const action = planSync(localAt, remoteAt, readLast());
      if (action === 'none') {
        if (localAt !== null && localAt === remoteAt) writeLast(localAt);
        return { ok: true, action: 'unchanged' };
      }
      if (action === 'ask') return { ok: true, action: 'conflict', localAt: localAt as number, remoteAt: remoteAt as number };
      if (action === 'upload') {
        const up = await this.uploadLocal(localText as string);
        return up.ok ? { ok: true, action: 'uploaded' } : up;
      }
      const c = await fetchCloud();
      if (!c.ok) return c;
      const at = c.savedAt || (remoteAt ?? 0);
      writeLast(at);
      return { ok: true, action: 'download', text: c.text, savedAt: at };
    },
  };
}
