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
