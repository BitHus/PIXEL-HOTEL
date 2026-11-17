// Cloud save store (stage A): the whole GameState as the client's save file { version, savedAt, state }. The newest savedAt wins; the
// server keeps the last backups. It validates the file with the same shared reader (migrations, shape) and a few cheap invariants; it never replays the game.

import { readSave } from '@pixel-hotel/shared';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Db } from './db.ts';

/** A savedAt more than this far ahead of the server clock is a wrong device clock or a trick: refused. */
export const SAVE_FUTURE_SLACK_MS = 5 * 60_000;

export interface SaveMeta {
  revision: number;
  version: number;
  savedAt: number;
}

export type PutResult =
  | { ok: true; meta: SaveMeta }
  | { ok: false; error: 'bad_json' | 'not_a_save' | 'too_new' | 'too_old' | 'invalid' | 'bad_time' | 'bad_state' | 'newer_on_server'; current?: SaveMeta };

/** Cheap invariants of a readable state: no negative wallet, unique furniture uids. */
function stateProblem(state: { player: { wallet: { gold: number; gems: number } }; items: { uid: number }[] }): boolean {
  if (state.player.wallet.gold < 0 || state.player.wallet.gems < 0) return true;
  return new Set(state.items.map((i) => i.uid)).size !== state.items.length;
}

export function getSaveMeta(db: Db, accountId: number): SaveMeta | null {
  const r = db.prepare('SELECT revision, version, saved_at AS savedAt FROM saves WHERE account_id = ?').get(accountId) as SaveMeta | undefined;
  return r ?? null;
}

/** The stored save file text and its meta. */
export function getSave(db: Db, accountId: number): { meta: SaveMeta; text: string } | null {
  const r = db.prepare('SELECT revision, version, saved_at AS savedAt, blob FROM saves WHERE account_id = ?').get(accountId) as (SaveMeta & { blob: Buffer }) | undefined;
  if (!r) return null;
  return { meta: { revision: r.revision, version: r.version, savedAt: r.savedAt }, text: gunzipSync(r.blob).toString('utf8') };
}

export function putSave(db: Db, accountId: number, text: string, now: number, backupsKept: number): PutResult {
  const read = readSave(text);
  if (!read.ok) return { ok: false, error: read.problem };
  const file = JSON.parse(text) as { version: number; savedAt: unknown };
  const savedAt = file.savedAt;
  if (typeof savedAt !== 'number' || !Number.isInteger(savedAt) || savedAt < 0 || savedAt > now + SAVE_FUTURE_SLACK_MS) return { ok: false, error: 'bad_time' };
  if (stateProblem(read.state)) return { ok: false, error: 'bad_state' };
  const blob = gzipSync(Buffer.from(text, 'utf8'));
  return db.transaction((): PutResult => {
    const cur = db.prepare('SELECT revision, version, saved_at AS savedAt, blob FROM saves WHERE account_id = ?').get(accountId) as (SaveMeta & { blob: Buffer }) | undefined;
    if (cur && cur.savedAt > savedAt) return { ok: false, error: 'newer_on_server', current: { revision: cur.revision, version: cur.version, savedAt: cur.savedAt } };
    const revision = (cur?.revision ?? 0) + 1;
    if (cur) {
      db.prepare('INSERT OR REPLACE INTO save_backups (account_id, revision, version, saved_at, blob) VALUES (?, ?, ?, ?, ?)').run(accountId, cur.revision, cur.version, cur.savedAt, cur.blob);
      db.prepare('DELETE FROM save_backups WHERE account_id = ? AND revision <= ?').run(accountId, cur.revision - backupsKept);
    }
    db.prepare('INSERT INTO saves (account_id, revision, version, saved_at, blob) VALUES (?, ?, ?, ?, ?) ON CONFLICT(account_id) DO UPDATE SET revision = excluded.revision, version = excluded.version, saved_at = excluded.saved_at, blob = excluded.blob').run(accountId, revision, file.version, savedAt, blob);
    return { ok: true, meta: { revision, version: file.version, savedAt } };
  })();
}

export function listBackups(db: Db, accountId: number): SaveMeta[] {
  return db.prepare('SELECT revision, version, saved_at AS savedAt FROM save_backups WHERE account_id = ? ORDER BY revision DESC').all(accountId) as SaveMeta[];
}
