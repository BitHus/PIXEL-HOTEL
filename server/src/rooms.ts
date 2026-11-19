// Visits, stage A (PLAN-ONLINE P2, sections 3 and 7): every room is PRIVATE until its owner shares it (no row here = private). Sharing gives a
// 6-character visit code; 'public' also lists the room on the Rooms board. A visitor only ever gets the stored ROOM VIEW (roomView.ts), which the
// server builds from the host's accepted save, never from anything a client says about a room. Block and report are stored for later moderation.

import { readSave, type GameState } from '@pixel-hotel/shared';
import { randomInt } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Db } from './db.ts';
import { buildRoomView, VISITABLE_KINDS, type RoomView } from './roomView.ts';
import { getSave } from './saves.ts';

/** No 0/O, 1/I/L: 31 characters, 31^6 = about 887 million codes. */
export const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;
export const TITLE_MAX = 24;
export const PUBLIC_PAGE_SIZE = 20;
export const PUBLIC_PAGE_MAX = 50;
export const REPORT_NOTE_MAX = 120;
export const REPORT_KINDS = ['room', 'name', 'title', 'other'] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];
export type Visibility = 'private' | 'code' | 'public';

const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function newVisitCode(rand: (max: number) => number = randomInt): string {
  let s = '';
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[rand(CODE_ALPHABET.length)];
  return s;
}

/** A typed code in its stored form (upper case, spaces and dashes dropped), or null when it cannot be a code. */
export function normalizeCode(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > 16) return null;
  const s = v.replace(/[\s-]/g, '').toUpperCase();
  return CODE_RE.test(s) ? s : null;
}

/** A room title: letters, digits, spaces and ' - ! . , & only, at most TITLE_MAX. Null = not allowed. (The word filter is ON-11.) */
export function cleanTitle(v: unknown): string | null {
  if (typeof v !== 'string' || v.length > TITLE_MAX * 4) return null;
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length === 0 || s.length > TITLE_MAX) return null;
  return /^[\p{L}\p{N} '\-!.,&]+$/u.test(s) ? s : null;
}

export interface ShareRow {
  roomId: number;
  kind: string;
  visibility: Visibility;
  code: string | null;
  title: string | null;
}

interface DbShare {
  room_id: number;
  visibility: 'code' | 'public';
  code: string;
  title: string | null;
}

function loadState(db: Db, accountId: number): { state: GameState; savedAt: number } | null {
  const s = getSave(db, accountId);
  if (!s) return null;
  const r = readSave(s.text);
  return r.ok && r.state.playerCreated ? { state: r.state, savedAt: s.meta.savedAt } : null;
}

const pack = (view: RoomView): Buffer => gzipSync(Buffer.from(JSON.stringify(view), 'utf8'));

/** The owner's own rooms that can be shared, with their share state. Empty without a save. */
export function listMyRooms(db: Db, accountId: number): ShareRow[] {
  const loaded = loadState(db, accountId);
  if (!loaded) return [];
  const rows = db.prepare('SELECT room_id, visibility, code, title FROM room_shares WHERE account_id = ?').all(accountId) as DbShare[];
  return loaded.state.rooms
    .filter((r) => VISITABLE_KINDS.includes(r.kind))
    .map((r) => {
      const s = rows.find((x) => x.room_id === r.id);
      return { roomId: r.id, kind: r.kind, visibility: s?.visibility ?? 'private', code: s?.code ?? null, title: s?.title ?? null };
    });
}

export type ShareResult = { ok: true; room: ShareRow } | { ok: false; error: 'bad_request' | 'bad_title' | 'no_save' | 'no_room' | 'not_visitable' };

/**
 * Sets one own room private (code deleted), 'code' (visit code only) or 'public' (code + the Rooms board). `rotate` gives a new code; going
 * from public back to code also does (the old code was on the board). `title`: a string sets it, null clears it, absent keeps it.
 */
export function setShare(db: Db, accountId: number, input: Record<string, unknown>, now: number, rand?: (max: number) => number): ShareResult {
  const { roomId, visibility, title, rotate } = input;
  if (typeof roomId !== 'number' || !Number.isInteger(roomId) || roomId < 0 || roomId > 1_000_000) return { ok: false, error: 'bad_request' };
  if (visibility !== 'private' && visibility !== 'code' && visibility !== 'public') return { ok: false, error: 'bad_request' };
  if (rotate !== undefined && typeof rotate !== 'boolean') return { ok: false, error: 'bad_request' };
  let newTitle: string | null | undefined;
  if (title === null) newTitle = null;
  else if (title !== undefined) {
    newTitle = cleanTitle(title);
    if (newTitle === null) return { ok: false, error: 'bad_title' };
  }
  const loaded = loadState(db, accountId);
  if (!loaded) return { ok: false, error: 'no_save' };
  const room = loaded.state.rooms.find((r) => r.id === roomId);
  if (!room) return { ok: false, error: 'no_room' };
  const view = buildRoomView(loaded.state, roomId, loaded.savedAt);
  if (!view) return { ok: false, error: 'not_visitable' };

  if (visibility === 'private') {
    db.prepare('DELETE FROM room_shares WHERE account_id = ? AND room_id = ?').run(accountId, roomId);
    return { ok: true, room: { roomId, kind: room.kind, visibility, code: null, title: null } };
  }
  const cur = db.prepare('SELECT room_id, visibility, code, title FROM room_shares WHERE account_id = ? AND room_id = ?').get(accountId, roomId) as DbShare | undefined;
  const fresh = !cur || rotate === true || (cur.visibility === 'public' && visibility === 'code');
  const keptTitle = newTitle === undefined ? (cur?.title ?? null) : newTitle;
  for (let attempt = 0; ; attempt++) {
    const code = cur && !fresh ? cur.code : newVisitCode(rand);
    try {
      db.prepare(
        `INSERT INTO room_shares (account_id, room_id, visibility, code, title, kind, owner_name, stars, view, shared_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(account_id, room_id) DO UPDATE SET visibility = excluded.visibility, code = excluded.code, title = excluded.title,
           kind = excluded.kind, owner_name = excluded.owner_name, stars = excluded.stars, view = excluded.view, updated_at = excluded.updated_at`,
      ).run(accountId, roomId, visibility, code, keptTitle, room.kind, view.owner.name, view.stars, pack(view), now, now);
      return { ok: true, room: { roomId, kind: room.kind, visibility, code, title: keptTitle } };
    } catch (e) {
      // A code collision (UNIQUE): draw again, a few times.
      if (!fresh || attempt >= 5) throw e;
    }
  }
}

/** After an accepted save: rebuild the stored view of every shared room of that account; a room that is gone stops being shared. */
export function refreshShares(db: Db, accountId: number, now: number): void {
  const rows = db.prepare('SELECT room_id FROM room_shares WHERE account_id = ?').all(accountId) as { room_id: number }[];
  if (rows.length === 0) return;
  const loaded = loadState(db, accountId);
  for (const r of rows) {
    const view = loaded ? buildRoomView(loaded.state, r.room_id, loaded.savedAt) : null;
    if (!view) db.prepare('DELETE FROM room_shares WHERE account_id = ? AND room_id = ?').run(accountId, r.room_id);
    else db.prepare('UPDATE room_shares SET kind = ?, owner_name = ?, stars = ?, view = ?, updated_at = ? WHERE account_id = ? AND room_id = ?').run(view.room.kind, view.owner.name, view.stars, pack(view), now, accountId, r.room_id);
  }
}

export interface VisitResult {
  code: string;
  title: string | null;
  view: RoomView;
}

/** The room behind a code for this visitor, or null: unknown code, a room made private, a deleted host, or a visitor the host blocked (all look the same). */
export function visitByCode(db: Db, visitorId: number, code: string): VisitResult | null {
  const row = db.prepare('SELECT account_id, code, title, kind, view FROM room_shares WHERE code = ?').get(code) as { account_id: number; code: string; title: string | null; kind: string; view: Buffer } | undefined;
  // Owner 19 Nov scope: a stored share of a kind that is not visitable (an old row, a tavern, kitchen, cellar, farm...) is never served.
  if (!row || !isVisitableKind(row.kind)) return null;
  if (row.account_id !== visitorId && isBlocked(db, row.account_id, visitorId)) return null;
  const view = JSON.parse(gunzipSync(row.view).toString('utf8')) as RoomView;
  if (!isVisitableKind(view.room?.kind)) return null;
  return { code: row.code, title: row.title, view };
}

/** True for the room kinds a visitor may see (VISITABLE_KINDS; owner 19 Nov: hotel room only until the garden and public spaces are decided). */
export function isVisitableKind(kind: unknown): boolean {
  return typeof kind === 'string' && (VISITABLE_KINDS as readonly string[]).includes(kind);
}

const KIND_SQL = `kind IN (${VISITABLE_KINDS.map(() => '?').join(', ')})`;

export interface PublicRoom {
  code: string;
  title: string | null;
  owner: string;
  kind: string;
  stars: number;
  updatedAt: number;
}

/** One page of the Rooms board (public rooms only; rooms of hosts who blocked the viewer are left out). */
export function listPublic(db: Db, viewerId: number, page: number, sort: 'new' | 'stars'): { rooms: PublicRoom[]; page: number; more: boolean } {
  const order = sort === 'stars' ? 'stars DESC, updated_at DESC' : 'updated_at DESC';
  const rows = db.prepare(
    `SELECT code, title, owner_name AS owner, kind, stars, updated_at AS updatedAt FROM room_shares s
     WHERE visibility = 'public' AND ${KIND_SQL} AND NOT EXISTS (SELECT 1 FROM visit_blocks b WHERE b.owner_id = s.account_id AND b.blocked_id = ?)
     ORDER BY ${order}, code LIMIT ? OFFSET ?`,
  ).all(...VISITABLE_KINDS, viewerId, PUBLIC_PAGE_SIZE + 1, page * PUBLIC_PAGE_SIZE) as PublicRoom[];
  return { rooms: rows.slice(0, PUBLIC_PAGE_SIZE), page, more: rows.length > PUBLIC_PAGE_SIZE };
}

/** The owner blocks (or unblocks) an account from all their rooms. An unknown name changes nothing and is not told apart. False = bad input. */
export function setBlock(db: Db, ownerId: number, username: unknown, blocked: unknown, now: number): boolean {
  if (typeof username !== 'string' || username.length < 1 || username.length > 16 || typeof blocked !== 'boolean') return false;
  const target = db.prepare('SELECT id FROM accounts WHERE username = ?').get(username) as { id: number } | undefined;
  if (target && target.id !== ownerId) {
    if (blocked) db.prepare('INSERT OR IGNORE INTO visit_blocks (owner_id, blocked_id, created_at) VALUES (?, ?, ?)').run(ownerId, target.id, now);
    else db.prepare('DELETE FROM visit_blocks WHERE owner_id = ? AND blocked_id = ?').run(ownerId, target.id);
  }
  return true;
}

export function isBlocked(db: Db, ownerId: number, visitorId: number): boolean {
  return db.prepare('SELECT 1 FROM visit_blocks WHERE owner_id = ? AND blocked_id = ?').get(ownerId, visitorId) !== undefined;
}

export type ReportResult = { ok: true } | { ok: false; error: 'bad_request' | 'no_room' };

/** Stores a report about a shared room (read later by an admin tool). The note is trimmed and stripped of control characters. */
export function addReport(db: Db, reporterId: number, input: Record<string, unknown>, now: number): ReportResult {
  const code = normalizeCode(input.code);
  const kind = input.kind;
  if (!code || typeof kind !== 'string' || !(REPORT_KINDS as readonly string[]).includes(kind)) return { ok: false, error: 'bad_request' };
  if (input.note !== undefined && (typeof input.note !== 'string' || input.note.length > REPORT_NOTE_MAX)) return { ok: false, error: 'bad_request' };
  const note = typeof input.note === 'string' ? [...input.note].map((c) => (c.charCodeAt(0) < 32 || c.charCodeAt(0) === 127 ? ' ' : c)).join('').trim() : '';
  const row = db.prepare('SELECT account_id, room_id, kind FROM room_shares WHERE code = ?').get(code) as { account_id: number; room_id: number; kind: string } | undefined;
  if (!row || !isVisitableKind(row.kind) || row.account_id === reporterId || isBlocked(db, row.account_id, reporterId)) return { ok: false, error: 'no_room' };
  db.prepare("INSERT INTO reports (reporter_id, target_id, room_id, kind, note, created_at, status) VALUES (?, ?, ?, ?, ?, ?, 'open')").run(reporterId, row.account_id, row.room_id, kind, note, now);
  return { ok: true };
}
