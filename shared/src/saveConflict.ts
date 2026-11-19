// Cloud save sync plan (docs/PLAN-ONLINE.md ON-5). Pure: compares this device's save time and the cloud save time with the time of
// the last successful sync on this device. Only one side changed since then = take that side; BOTH changed = ask the player.

export type SyncPlan = 'upload' | 'download' | 'none' | 'ask';

/**
 * localAt / remoteAt: savedAt of the save on this device / in the cloud (null = none).
 * lastSyncAt: the savedAt both sides had after the last sync (null = never synced on this device).
 */
export function planSync(localAt: number | null, remoteAt: number | null, lastSyncAt: number | null): SyncPlan {
  if (localAt === null && remoteAt === null) return 'none';
  if (remoteAt === null) return 'upload';
  if (localAt === null) return 'download';
  if (localAt === remoteAt) return 'none';
  if (lastSyncAt === null) return 'ask'; // two different saves and no shared past: never overwrite one silently
  const localChanged = localAt > lastSyncAt;
  const remoteChanged = remoteAt > lastSyncAt;
  if (localChanged && remoteChanged) return 'ask';
  if (localChanged) return 'upload';
  if (remoteChanged) return 'download';
  return localAt > remoteAt ? 'upload' : 'download'; // neither is past the last sync: the newest wins
}

/** The side that is newest (the default choice in the dialog). */
export function newestSide(localAt: number, remoteAt: number): 'local' | 'cloud' {
  return localAt > remoteAt ? 'local' : 'cloud';
}

/** The local save text with savedAt raised above the cloud one, so the server accepts it when the player keeps this device. */
export function restampSave(localText: string, remoteAt: number, now: number): string | null {
  try {
    const f = JSON.parse(localText) as { savedAt?: unknown };
    if (typeof f !== 'object' || f === null) return null;
    f.savedAt = Math.max(now, remoteAt + 1, typeof f.savedAt === 'number' ? f.savedAt : 0);
    return JSON.stringify(f);
  } catch {
    return null;
  }
}
