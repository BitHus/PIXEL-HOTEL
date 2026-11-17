// Cloud save client (docs/PLAN-ONLINE.md ON-1, stage A). A small module on its own: the game rules and LocalGameAPI know nothing about it.
// Behind a build flag that defaults to OFF: VITE_CLOUD_SAVE=1 plus VITE_SERVER_URL (the live game does not change without them).
// The local save stays the offline copy; the newest savedAt wins (the server decides on upload, decideSync decides here).

import type { SaveStorage } from './saveStorage.ts';

export const CLOUD_SESSION_KEY = 'pixel-hotel-cloud-session';

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
export type SyncResult = CloudResult<{ action: 'uploaded' | 'unchanged' } | { action: 'download'; text: string; savedAt: number }>;

export interface CloudSave {
  /** The signed-in name, or null. */
  username(): string | null;
  register(username: string, password: string, age13: boolean): Promise<CloudResult>;
  login(username: string, password: string): Promise<CloudResult>;
  logout(): Promise<void>;
  /** Compares this device's save with the cloud one and uploads or fetches the newer. `localText` is the stored save file text (or null). */
  syncNow(localText: string | null): Promise<SyncResult>;
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
    async logout() {
      await call('/api/logout', { method: 'POST', auth: true });
      writeSession(null);
    },
    async uploadLocal(localText) {
      const r = await call('/api/save', { method: 'PUT', auth: true, headers: { 'content-type': 'application/json' }, body: localText });
      return r && r.status === 200 ? { ok: true } : { ok: false, error: errorOf(r) };
    },
    async syncNow(localText) {
      let localAt: number | null = null;
      if (localText !== null) {
        try {
          const f = JSON.parse(localText) as { savedAt?: unknown };
          if (typeof f.savedAt === 'number') localAt = f.savedAt;
        } catch {
          localAt = null;
        }
      }
      const meta = await call('/api/save/meta', { auth: true });
      if (!meta || (meta.status !== 200 && meta.status !== 404)) return { ok: false, error: errorOf(meta) };
      const remoteAt = meta.status === 200 && typeof meta.body.savedAt === 'number' ? meta.body.savedAt : null;
      const action = decideSync(localAt, remoteAt);
      if (action === 'none') return { ok: true, action: 'unchanged' };
      if (action === 'upload') {
        const up = await this.uploadLocal(localText as string);
        return up.ok ? { ok: true, action: 'uploaded' } : up;
      }
      const got = await call('/api/save', { auth: true });
      if (!got || got.status !== 200 || typeof got.body.save !== 'object' || got.body.save === null) return { ok: false, error: errorOf(got) };
      return { ok: true, action: 'download', text: JSON.stringify(got.body.save), savedAt: remoteAt ?? 0 };
    },
  };
}
