// Server configuration from the environment only (no secret is ever in the repo). Defaults are safe for local development.

import { randomBytes } from 'node:crypto';

export interface ServerConfig {
  host: string;
  port: number;
  /** SQLite file, or ':memory:' (tests). */
  dbPath: string;
  /** The one origin that may call the API from a browser (CORS), plus dev origins. */
  allowedOrigins: string[];
  bcryptCost: number;
  /** Key for hashing IP addresses (never stored raw). Set PB_IP_KEY in production; a random one per process is used otherwise. */
  ipKey: string;
  /** Trust X-Forwarded-For (only behind nginx on 127.0.0.1). */
  trustProxy: boolean;
  /** Largest accepted save upload in bytes. */
  saveMaxBytes: number;
  sessionDays: number;
  backupsKept: number;
}

/**
 * Reasons the server must NOT start with this environment. Production (behind nginx, PB_TRUST_PROXY=1) needs a real PB_IP_KEY
 * (at least 32 characters, not the example placeholder) and https-only origins; any setup refuses a public bind without PB_ALLOW_PUBLIC=1.
 */
export function configProblems(env: Record<string, string | undefined>, config: ServerConfig = loadConfig(env)): string[] {
  const out: string[] = [];
  const production = config.trustProxy;
  const key = env.PB_IP_KEY;
  if (production && (!key || key === 'CHANGE_ME' || key.length < 32)) out.push('PB_IP_KEY must be set to a random value of at least 32 characters (openssl rand -hex 32)');
  if (production && config.allowedOrigins.some((o) => !o.startsWith('https://'))) out.push('PB_ORIGINS must list only https:// origins in production');
  if (!['127.0.0.1', '::1', 'localhost'].includes(config.host) && env.PB_ALLOW_PUBLIC !== '1') out.push('PB_HOST is not a loopback address: keep 127.0.0.1 behind nginx (or set PB_ALLOW_PUBLIC=1 on purpose)');
  if (!Number.isInteger(config.port) || config.port < 0 || config.port > 65535) out.push('PB_PORT must be a port number');
  if (config.saveMaxBytes < 10_000 || config.saveMaxBytes > 10_000_000) out.push('PB_SAVE_MAX_BYTES must be between 10000 and 10000000');
  if (config.sessionDays < 1 || config.sessionDays > 365) out.push('PB_SESSION_DAYS must be between 1 and 365');
  if (config.backupsKept < 1 || config.backupsKept > 100) out.push('PB_BACKUPS_KEPT must be between 1 and 100');
  return out;
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const num = (v: string | undefined, d: number): number => {
    const n = v === undefined || v === '' ? d : Number(v);
    return Number.isFinite(n) ? n : d;
  };
  return {
    host: env.PB_HOST ?? '127.0.0.1',
    port: num(env.PB_PORT, 8080),
    dbPath: env.PB_DB ?? 'data/pb.sqlite',
    allowedOrigins: (env.PB_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()).filter(Boolean),
    bcryptCost: Math.min(14, Math.max(4, num(env.PB_BCRYPT_COST, 10))),
    ipKey: env.PB_IP_KEY ?? randomBytes(16).toString('hex'),
    trustProxy: env.PB_TRUST_PROXY === '1',
    saveMaxBytes: num(env.PB_SAVE_MAX_BYTES, 1_000_000),
    sessionDays: num(env.PB_SESSION_DAYS, 30),
    backupsKept: num(env.PB_BACKUPS_KEPT, 10),
  };
}
