// Automatic cloud save (docs/PLAN-ONLINE.md P1: "the client saves to the server after changes (5 s) and on tab hide").
// Only ever PUSHES (CloudSave.pushIfAhead): when the cloud changed too, it sends nothing and tells the caller once (onBehind), the player
// chooses with Sync now in the Account panel. Timers are passed in (tests drive them). No rule, no UI.

import type { CloudSave } from './cloudSave.ts';

/** Debounce after a change before the save goes up (the server accepts 1 upload per 2 s per account). */
export const CLOUD_AUTOSYNC_MS = 5000;
/** Wait after a rate limit or a network failure before trying again. */
export const CLOUD_AUTOSYNC_RETRY_MS = 30_000;

export interface AutoSyncDeps {
  cloud: Pick<CloudSave, 'username' | 'pushIfAhead'>;
  /** The stored save file text of this device, or null. */
  localText(): string | null;
  setTimer(fn: () => void, ms: number): unknown;
  clearTimer(handle: unknown): void;
  /** The cloud has a save this device has not seen: say so once (until an upload works again). */
  onBehind?(): void;
}

export interface CloudAutoSync {
  /** The local save changed: push it at most CLOUD_AUTOSYNC_MS later (a throttle: at most one push per CLOUD_AUTOSYNC_MS while playing). */
  changed(): void;
  /** Push now (tab hidden, page closing). */
  flush(): Promise<void>;
}

export function createCloudAutoSync(deps: AutoSyncDeps): CloudAutoSync {
  let timer: unknown = null;
  let busy = false;
  let again = false;
  let warned = false;

  const schedule = (ms: number): void => {
    if (timer !== null) deps.clearTimer(timer);
    timer = deps.setTimer(() => {
      timer = null;
      void flush();
    }, ms);
  };

  async function flush(): Promise<void> {
    if (deps.cloud.username() === null) return;
    if (busy) {
      again = true;
      return;
    }
    if (timer !== null) {
      deps.clearTimer(timer);
      timer = null;
    }
    busy = true;
    try {
      const r = await deps.cloud.pushIfAhead(deps.localText());
      if (!r.ok) {
        if (r.error === 'network' || r.error === 'rate_limited' || r.error === 'server_error') schedule(CLOUD_AUTOSYNC_RETRY_MS);
        return; // unauthorized, too_large, invalid...: the Account panel shows it on the next Sync now
      }
      if (r.action === 'behind') {
        if (!warned) deps.onBehind?.();
        warned = true;
      } else if (r.action === 'uploaded') warned = false;
    } finally {
      busy = false;
      if (again) {
        again = false;
        schedule(CLOUD_AUTOSYNC_MS);
      }
    }
  }

  return {
    changed() {
      // A pending push is kept (not pushed back): the game saves often while playing, so a plain debounce would never fire.
      if (deps.cloud.username() === null || timer !== null) return;
      if (busy) {
        again = true;
        return;
      }
      schedule(CLOUD_AUTOSYNC_MS);
    },
    flush,
  };
}
