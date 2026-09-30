import 'server-only'

/**
 * Pembacaan environment server dengan validasi.
 *
 * Prinsip PRD 9.1: secret tidak boleh bocor. Semua nilai server dibaca lewat
 * fungsi ini supaya salah konfigurasi ketahuan saat start, bukan saat request.
 */

export class MissingEnvError extends Error {
  constructor(readonly key: string) {
    super(`Environment variable belum diisi: ${key}`)
    this.name = 'MissingEnvError'
  }
}

export function env(key: string): string {
  const value = process.env[key]
  if (value === undefined || value === '') {
    throw new MissingEnvError(key)
  }
  return value
}

export function envInt(key: string, fallback: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function envBool(key: string, fallback = false): boolean {
  const raw = process.env[key]
  if (raw === undefined || raw === '') return fallback
  return raw === 'true' || raw === '1'
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function siteUrl(): string {
  return env('NEXT_PUBLIC_SITE_URL')
}

export const db = {
  url: () => env('DATABASE_URL'),
  migrateUrl: () => process.env.DATABASE_MIGRATE_URL ?? env('DATABASE_URL'),
}

export const session = {
  secret: () => env('SESSION_SECRET'),
  maxAge: () => envInt('SESSION_MAX_AGE', 60 * 60 * 24 * 30),
}

export const argon2 = {
  memoryCost: () => envInt('ARGON2_MEMORY_COST', 19456),
  timeCost: () => envInt('ARGON2_TIME_COST', 2),
  parallelism: () => envInt('ARGON2_PARALLELISM', 1),
}

export const login = {
  rateLimitPerIp: () => envInt('LOGIN_RATE_LIMIT_PER_IP', 5),
  rateLimitPerAccount: () => envInt('LOGIN_RATE_LIMIT_PER_ACCOUNT', 5),
  lockoutThreshold: () => envInt('LOGIN_LOCKOUT_THRESHOLD', 10),
  lockoutMinutes: () => envInt('LOGIN_LOCKOUT_MINUTES', 30),
  checkBreachedPasswords: () => envBool('CHECK_BREACHED_PASSWORDS', false),
}

export const passwordReset = {
  ttlSeconds: () => envInt('PASSWORD_RESET_TTL', 60 * 60),
}

export const upload = {
  dir: () => env('UPLOAD_DIR'),
  maxBytes: () => envInt('UPLOAD_MAX_BYTES', 2 * 1024 * 1024),
  maxPerTrade: () => envInt('UPLOAD_MAX_PER_TRADE', 3),
}

export const marketData = {
  enabled: () => envBool('MARKET_DATA_ENABLED', false),
  allowedHosts: () => ['api.binance.com', 'api.bybit.com'] as const,
}

export const job = {
  pollIntervalMs: () => envInt('JOB_POLL_INTERVAL_MS', 5000),
  batchSize: () => envInt('JOB_BATCH_SIZE', 10),
}