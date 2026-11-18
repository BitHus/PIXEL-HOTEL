// Read-only visits client (docs/PLAN-ONLINE.md stage A): share own rooms, open a room by visit code, the public Rooms board,
// block and report. Same build flag as the cloud save (cloudConfig: VITE_CLOUD_SAVE=1 + VITE_SERVER_URL, default OFF) and the same
// session (CLOUD_SESSION_KEY, written by cloudSave.ts at login). A visit only ever READS a RoomView; nothing here changes the game.
// Shapes: shared/src/net/protocol.ts. No UI is wired yet (P2 VisitView, ON-10).

import {
  API_PATHS, isVisitResponse, type ApiErrorCode, type BlockRequest, type PublicRoomsPage, type ReportRequest, type ShareRequest,
  type ShareRow, type VisitResponse,
} from '@pixel-hotel/shared';
import { CLOUD_SESSION_KEY, type CloudConfig } from './cloudSave.ts';
import type { SaveStorage } from './saveStorage.ts';

export type CloudApiError = ApiErrorCode | 'network' | 'bad_answer' | `http_${number}`;
export type CloudApiResult<T> = { ok: true; value: T } | { ok: false; error: CloudApiError };

export interface CloudApi {
  /** True when a session is stored (signed in through the Account section). */
  signedIn(): boolean;
  myRooms(): Promise<CloudApiResult<ShareRow[]>>;
  share(req: ShareRequest): Promise<CloudApiResult<ShareRow>>;
  publicRooms(page: number, sort: 'new' | 'stars'): Promise<CloudApiResult<PublicRoomsPage>>;
  /** The read-only view of a shared room. Unknown, private and blocked all give 'no_room'. */
  visit(code: string): Promise<CloudApiResult<VisitResponse>>;
  report(req: ReportRequest): Promise<CloudApiResult<true>>;
  block(req: BlockRequest): Promise<CloudApiResult<true>>;
}

export function createCloudApi(cfg: CloudConfig, storage: SaveStorage, fetchFn: typeof fetch = (...a) => fetch(...a)): CloudApi {
  const token = (): string | null => {
    try {
      const raw = storage.get(CLOUD_SESSION_KEY);
      const o = raw === null ? null : (JSON.parse(raw) as { token?: unknown });
      return o && typeof o.token === 'string' ? o.token : null;
    } catch {
      return null;
    }
  };

  async function call<T>(path: string, method: 'GET' | 'PUT' | 'POST', body: unknown, check: (b: unknown) => b is T): Promise<CloudApiResult<T>> {
    const t = token();
    if (!t) return { ok: false, error: 'unauthorized' };
    const headers: Record<string, string> = { authorization: `Bearer ${t}` };
    if (body !== undefined) headers['content-type'] = 'application/json';
    let res: Response;
    try {
      res = await fetchFn(cfg.baseUrl + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      return { ok: false, error: 'network' };
    }
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      // the status alone tells
    }
    if (res.status === 401) storage.remove(CLOUD_SESSION_KEY); // the session ended: sign in again
    if (res.status < 200 || res.status >= 300) {
      const e = (parsed as { error?: unknown } | null)?.error;
      return { ok: false, error: typeof e === 'string' ? (e as ApiErrorCode) : `http_${res.status}` };
    }
    return check(parsed) ? { ok: true, value: parsed } : { ok: false, error: 'bad_answer' };
  }

  const isObj = (b: unknown): b is Record<string, unknown> => typeof b === 'object' && b !== null;
  const isShareRow = (b: unknown): b is ShareRow => isObj(b) && typeof b.roomId === 'number' && typeof b.visibility === 'string';
  const isOk = (b: unknown): b is true => isObj(b) && b.ok === true;

  return {
    signedIn: () => token() !== null,
    async myRooms() {
      const r = await call(API_PATHS.roomsMine, 'GET', undefined, (b): b is { rooms: ShareRow[] } => isObj(b) && Array.isArray(b.rooms) && b.rooms.every(isShareRow));
      return r.ok ? { ok: true, value: r.value.rooms } : r;
    },
    share: (req) => call(API_PATHS.roomsShare, 'PUT', req, isShareRow),
    publicRooms: (page, sort) =>
      call(`${API_PATHS.roomsPublic}?page=${Math.max(0, Math.floor(page))}&sort=${sort}`, 'GET', undefined, (b): b is PublicRoomsPage => isObj(b) && Array.isArray(b.rooms) && typeof b.more === 'boolean'),
    visit: (code) => call(API_PATHS.visit + encodeURIComponent(code.slice(0, 16)), 'GET', undefined, isVisitResponse),
    async report(req) {
      const r = await call(API_PATHS.visitReport, 'POST', req, isOk);
      return r.ok ? { ok: true, value: true } : r;
    },
    async block(req) {
      const r = await call(API_PATHS.roomsBlock, 'POST', req, isOk);
      return r.ok ? { ok: true, value: true } : r;
    },
  };
}
