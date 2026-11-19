// The online protocol of stage A (docs/PLAN-ONLINE.md P1 + read-only visits): HTTP paths, request and response shapes, error codes,
// and the pure account rules both sides use (the server enforces them, the client may check early). No network code here.
// Every body is JSON; a refusal is { error: ApiErrorCode } with an HTTP status. Auth: header `Authorization: Bearer <token>`.

import type { AvatarLook } from '../avatar.ts';
import type { RoomKind } from '../room.ts';
import type { Facing } from '../types.ts';

/** UTF-8 length in bytes (pure; shared/ has no TextEncoder or Buffer types). */
export function utf8Bytes(s: string): number {
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

/** Every HTTP endpoint of the server. `visit` is a prefix: GET `${API_PATHS.visit}<code>`. */
export const API_PATHS = {
  health: '/api/health',
  register: '/api/register',
  login: '/api/login',
  logout: '/api/logout',
  save: '/api/save',
  saveMeta: '/api/save/meta',
  roomsMine: '/api/rooms/mine',
  roomsShare: '/api/rooms/share',
  roomsPublic: '/api/rooms/public',
  roomsBlock: '/api/rooms/block',
  visit: '/api/visit/',
  visitReport: '/api/visit/report',
} as const;

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 16;
export const PASSWORD_MIN = 8;
/** bcrypt only reads 72 bytes. */
export const PASSWORD_MAX_BYTES = 72;
export const RESERVED_USERNAMES: readonly string[] = ['admin', 'administrator', 'root', 'moderator', 'mod', 'system', 'support', 'pocketbarrel', 'owner', 'staff', 'null', 'undefined'];
const COMMON_PASSWORDS: readonly string[] = ['password', '12345678', 'qwertyui', 'pocketbarrel'];

export type UsernameProblem = 'username_type' | 'username_length' | 'username_chars' | 'username_reserved';
export type PasswordProblem = 'password_type' | 'password_short' | 'password_long' | 'password_common';

/** 3 to 16 characters: letters, digits and underscore, starting with a letter; not a reserved name. Null = fine. */
export function usernameProblem(name: unknown): UsernameProblem | null {
  if (typeof name !== 'string') return 'username_type';
  if (name.length < USERNAME_MIN || name.length > USERNAME_MAX) return 'username_length';
  if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) return 'username_chars';
  if (RESERVED_USERNAMES.includes(name.toLowerCase())) return 'username_reserved';
  return null;
}

/** 8 characters to 72 bytes, not one repeated character or a well-known password. No other rule: length beats complexity. Null = fine. */
export function passwordProblem(pw: unknown): PasswordProblem | null {
  if (typeof pw !== 'string') return 'password_type';
  if (pw.length < PASSWORD_MIN) return 'password_short';
  if (utf8Bytes(pw) > PASSWORD_MAX_BYTES) return 'password_long';
  if (/^(.)\1+$/.test(pw) || COMMON_PASSWORDS.includes(pw.toLowerCase())) return 'password_common';
  return null;
}

/** Every error code the server sends in { error }. */
export type ApiErrorCode =
  | 'bad_request' | 'bad_json' | 'too_large' | 'rate_limited' | 'unauthorized' | 'not_found' | 'server_error'
  | 'age_required' | UsernameProblem | PasswordProblem | 'username_taken' | 'bad_login' | 'banned'
  | 'no_save' | 'not_a_save' | 'too_new' | 'too_old' | 'invalid' | 'bad_time' | 'bad_state' | 'newer_on_server'
  | 'bad_title' | 'no_room' | 'not_visitable';

export interface ApiError {
  error: ApiErrorCode;
}

// --- accounts ---
/** POST register (201) and POST login (200) bodies. `age13` must be true ("I am 13 or older"). */
export interface RegisterRequest {
  username: string;
  password: string;
  age13: true;
}
export interface LoginRequest {
  username: string;
  password: string;
}
/** Register and login answer: a random session token (30 days, sliding). */
export interface AuthResponse {
  token: string;
  username: string;
}
export interface HealthResponse {
  ok: true;
  time: number;
  saveVersion: number;
}

// --- cloud save ---
/** PUT save body = the client's save file text { version, savedAt, state } (at most 1 MB). */
export interface CloudSaveMeta {
  revision: number;
  version: number;
  savedAt: number;
}
/** GET save answer. */
export interface CloudSaveResponse extends CloudSaveMeta {
  save: { version: number; savedAt: number; state: unknown };
}
/** PUT save refused with 409 because the cloud copy is newer (newest savedAt wins). */
export interface SaveConflictResponse {
  error: 'newer_on_server';
  current: CloudSaveMeta;
}

// --- visits (read only) ---
export type RoomVisibility = 'private' | 'code' | 'public';

/** PUT rooms/share body. `title`: a string sets it, null clears it, absent keeps it. `rotate` gives a new code. */
export interface ShareRequest {
  roomId: number;
  visibility: RoomVisibility;
  title?: string | null;
  rotate?: boolean;
}
/** One own room with its share state (rooms/mine lists them as { rooms }; rooms/share answers one). */
export interface ShareRow {
  roomId: number;
  kind: string;
  visibility: RoomVisibility;
  code: string | null;
  title: string | null;
}
export interface PublicRoom {
  code: string;
  title: string | null;
  owner: string;
  kind: string;
  stars: number;
  updatedAt: number;
}
/** GET rooms/public?page=N&sort=new|stars answer (20 per page). */
export interface PublicRoomsPage {
  rooms: PublicRoom[];
  page: number;
  more: boolean;
}
/** POST rooms/block body: the owner keeps an account out of all their rooms (or lets it back in). */
export interface BlockRequest {
  username: string;
  blocked: boolean;
}
export type ReportKind = 'room' | 'name' | 'title' | 'other';
/** POST visit/report body (note at most 120 characters). */
export interface ReportRequest {
  code: string;
  kind: ReportKind;
  note?: string;
}

/** Bump when RoomView changes. */
export const ROOM_VIEW_VERSION = 1;

export interface RoomViewItem {
  uid: number;
  typeId: string;
  x: number;
  y: number;
  facing: Facing;
  onItemUid: number | null;
  on?: boolean;
}

export interface RoomViewPlant {
  seed: string;
  plantedAt: number;
  readyAt: number;
  with?: string;
}

/** What a visitor gets: only what is needed to DRAW one room. Never a wallet, bag, ledger, tavern state or other rooms. */
export interface RoomView {
  v: number;
  owner: { name: string; look: AvatarLook };
  room: {
    kind: RoomKind;
    level: number;
    shape: string;
    w: number;
    h: number;
    floorStyle: string;
    floorCells: Record<string, string>;
    wallStyle: string;
    /** Block ids per cell, bottom first (key "col,row"). */
    blocks: Record<string, string[]>;
    plants: Record<string, RoomViewPlant>;
  };
  items: RoomViewItem[];
  /** 1 to 5 (shared roomScore). */
  stars: number;
  /** The savedAt of the host's save this view was built from. */
  savedAt: number;
}

/** GET visit/<code> answer. */
export interface VisitResponse {
  code: string;
  title: string | null;
  view: RoomView;
}

/** A cheap shape check of a visit answer on the client (the server built it; this guards a wrong or old server). */
export function isVisitResponse(v: unknown): v is VisitResponse {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  const view = o.view as Record<string, unknown> | undefined;
  if (typeof o.code !== 'string' || (o.title !== null && typeof o.title !== 'string') || typeof view !== 'object' || view === null) return false;
  const room = view.room as Record<string, unknown> | undefined;
  const owner = view.owner as Record<string, unknown> | undefined;
  return (
    view.v === ROOM_VIEW_VERSION && typeof owner === 'object' && owner !== null && typeof owner.name === 'string' &&
    typeof room === 'object' && room !== null && typeof room.kind === 'string' && Array.isArray(view.items) && typeof view.stars === 'number'
  );
}

/** The visit code in a page URL query (`?visit=K7QX2M`), upper-cased, or null. Same alphabet as the server (no 0 O 1 I L). */
export function visitCodeFromQuery(search: string): string | null {
  const m = /[?&]visit=([^&#]*)/.exec(search);
  if (!m) return null;
  let raw: string;
  try {
    raw = decodeURIComponent(m[1] ?? '');
  } catch {
    return null;
  }
  const s = raw.replace(/[\s-]/g, '').toUpperCase();
  return /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/.test(s) ? s : null;
}
