// The HTTP API (node:http, no framework): /api/health, /api/register, /api/login, /api/logout, /api/save (GET, PUT), /api/save/meta.
// Every input is validated, bodies are size-limited, rate limits follow docs/PLAN-ONLINE.md section 4, CORS allows only the configured origins.

import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { authenticate, checkLogin, createSession, endSession, hashIp, registerAccount } from './accounts.ts';
import type { ServerConfig } from './config.ts';
import type { Db } from './db.ts';
import { RateLimiter } from './rateLimit.ts';
import { getSave, getSaveMeta, putSave } from './saves.ts';

const SMALL_BODY_MAX = 4096;

export interface AppDeps {
  config: ServerConfig;
  db: Db;
  /** Wall clock in ms (passed in so tests can drive it). */
  now: () => number;
}

class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}

function readBody(req: IncomingMessage, max: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    if (declared > max) return reject(new HttpError(413, 'too_large'));
    const chunks: Buffer[] = [];
    let size = 0;
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > max) {
        reject(new HttpError(413, 'too_large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => reject(new HttpError(400, 'bad_request')));
  });
}

function parseJson(text: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(text);
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new Error('shape');
    return v as Record<string, unknown>;
  } catch {
    throw new HttpError(400, 'bad_json');
  }
}

export function createApp(deps: AppDeps): { handle: (req: IncomingMessage, res: ServerResponse) => void; sweep: () => void } {
  const { config, db, now } = deps;
  const registerPerIp = new RateLimiter(3, 3_600_000);
  const loginPerIp = new RateLimiter(5, 60_000);
  const loginPerName = new RateLimiter(10, 3_600_000);
  const savePerAccount = new RateLimiter(1, 2_000);
  const generalPerIp = new RateLimiter(50, 10_000);

  const clientIp = (req: IncomingMessage): string => {
    if (config.trustProxy) {
      const xff = req.headers['x-forwarded-for'];
      const first = (Array.isArray(xff) ? xff[0] : xff)?.split(',')[0]?.trim();
      if (first) return first;
    }
    return req.socket.remoteAddress ?? 'unknown';
  };

  const send = (res: ServerResponse, status: number, body: unknown, origin: string | null, extra: Record<string, string> = {}): void => {
    const text = JSON.stringify(body);
    res.writeHead(status, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': Buffer.byteLength(text),
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
      ...extra,
    });
    res.end(text);
  };

  const bearer = (req: IncomingMessage): string | null => {
    const h = req.headers.authorization;
    return typeof h === 'string' && h.startsWith('Bearer ') ? h.slice(7).trim() : null;
  };

  async function route(req: IncomingMessage, res: ServerResponse, origin: string | null): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://x');
    const path = url.pathname;
    const method = req.method ?? 'GET';
    const t = now();
    const ip = clientIp(req);
    if (!generalPerIp.take(ip, t)) throw new HttpError(429, 'rate_limited');

    if (path === '/api/health' && method === 'GET') {
      db.prepare('SELECT 1').get();
      return send(res, 200, { ok: true, time: t }, origin);
    }

    if (path === '/api/register' && method === 'POST') {
      if (!registerPerIp.take(hashIp(ip, config.ipKey), t)) throw new HttpError(429, 'rate_limited');
      const body = parseJson(await readBody(req, SMALL_BODY_MAX));
      const r = await registerAccount(db, { username: body.username, password: body.password, age13: body.age13 }, config.bcryptCost, t);
      if (!r.ok) throw new HttpError(r.error === 'username_taken' ? 409 : 400, r.error);
      const token = createSession(db, r.accountId, hashIp(ip, config.ipKey), config.sessionDays, t);
      return send(res, 201, { token, username: body.username }, origin);
    }

    if (path === '/api/login' && method === 'POST') {
      const ipKey = hashIp(ip, config.ipKey);
      const body = parseJson(await readBody(req, SMALL_BODY_MAX));
      const nameKey = typeof body.username === 'string' ? body.username.toLowerCase().slice(0, 64) : '';
      // Failed or not, every attempt counts (a throttle on guessing).
      if (!loginPerIp.take(ipKey, t) || !loginPerName.take(nameKey, t)) throw new HttpError(429, 'rate_limited');
      const r = await checkLogin(db, body.username, body.password, config.bcryptCost);
      if (!r.ok) throw new HttpError(401, 'bad_login');
      const token = createSession(db, r.accountId, ipKey, config.sessionDays, t);
      return send(res, 200, { token, username: r.username }, origin);
    }

    // Everything below needs a session.
    const token = bearer(req);
    const who = authenticate(db, token, config.sessionDays, t);
    if (!who || !token) throw new HttpError(401, 'unauthorized');

    if (path === '/api/logout' && method === 'POST') {
      endSession(db, token);
      return send(res, 200, { ok: true }, origin);
    }

    if (path === '/api/save/meta' && method === 'GET') {
      const meta = getSaveMeta(db, who.accountId);
      if (!meta) throw new HttpError(404, 'no_save');
      return send(res, 200, meta, origin);
    }

    if (path === '/api/save' && method === 'GET') {
      const s = getSave(db, who.accountId);
      if (!s) throw new HttpError(404, 'no_save');
      return send(res, 200, { ...s.meta, save: JSON.parse(s.text) as unknown }, origin);
    }

    if (path === '/api/save' && method === 'PUT') {
      if (!savePerAccount.take(String(who.accountId), t)) throw new HttpError(429, 'rate_limited');
      const text = await readBody(req, config.saveMaxBytes);
      const r = putSave(db, who.accountId, text, t, config.backupsKept);
      if (r.ok) return send(res, 200, r.meta, origin);
      if (r.error === 'newer_on_server') return send(res, 409, { error: r.error, current: r.current }, origin);
      throw new HttpError(r.error === 'too_new' ? 409 : 422, r.error);
    }

    throw new HttpError(404, 'not_found');
  }

  const handle = (req: IncomingMessage, res: ServerResponse): void => {
    const originHeader = req.headers.origin;
    const origin = typeof originHeader === 'string' && config.allowedOrigins.includes(originHeader) ? originHeader : null;
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        ...(origin ? { 'access-control-allow-origin': origin, vary: 'Origin' } : {}),
        'access-control-allow-methods': 'GET, POST, PUT, OPTIONS',
        'access-control-allow-headers': 'authorization, content-type',
        'access-control-max-age': '600',
      });
      res.end();
      return;
    }
    route(req, res, origin).catch((e: unknown) => {
      if (res.headersSent) return;
      if (e instanceof HttpError) return send(res, e.status, { error: e.code }, origin);
      // Never leak internals or log secrets.
      console.error('server error', e instanceof Error ? e.message : 'unknown');
      send(res, 500, { error: 'server_error' }, origin);
    });
  };

  const sweep = (): void => {
    const t = now();
    for (const l of [registerPerIp, loginPerIp, loginPerName, savePerAccount, generalPerIp]) l.sweep(t);
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(t);
  };

  return { handle, sweep };
}

export function createApiServer(deps: AppDeps): Server {
  const app = createApp(deps);
  const server = createServer(app.handle);
  const timer = setInterval(app.sweep, 60_000);
  timer.unref();
  server.on('close', () => clearInterval(timer));
  return server;
}
