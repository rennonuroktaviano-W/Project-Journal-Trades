import { afterEach, describe, expect, it } from 'vitest'

import { MissingEnvError, db, env, envBool, envInt, login, passwordReset, upload } from '@/lib/env'

const KUNCI = [
  'VARIABEL_YANG_TIDAK_ADA',
  'TES_BOOL',
  'TES_INT',
  'LOGIN_RATE_LIMIT_PER_IP',
  'LOGIN_LOCKOUT_THRESHOLD',
  'UPLOAD_MAX_BYTES',
  'PASSWORD_RESET_TTL',
  'DATABASE_URL',
  'DATABASE_MIGRATE_URL',
  'DATABASE_SSL',
]

afterEach(() => {
  for (const key of KUNCI) delete process.env[key]
})

describe('pembacaan environment', () => {
  it('menandai variabel yang tidak ada', () => {
    expect(() => env('VARIABEL_YANG_TIDAK_ADA')).toThrow(MissingEnvError)
    expect(() => env('VARIABEL_YANG_TIDAK_ADA')).toThrow(/VARIABEL_YANG_TIDAK_ADA/)
  })

  it('envBool memakai nilai bawaan saat variabel kosong', () => {
    delete process.env.TES_BOOL
    expect(envBool('TES_BOOL')).toBe(false)
    expect(envBool('TES_BOOL', true)).toBe(true)
  })

  it('envBool membaca nilai boolean yang benar', () => {
    process.env.TES_BOOL = 'true'
    expect(envBool('TES_BOOL')).toBe(true)

    process.env.TES_BOOL = '1'
    expect(envBool('TES_BOOL')).toBe(true)

    process.env.TES_BOOL = 'false'
    expect(envBool('TES_BOOL')).toBe(false)

    process.env.TES_BOOL = '0'
    expect(envBool('TES_BOOL')).toBe(false)
  })

  it('envInt memakai nilai bawaan saat variabel bukan angka', () => {
    delete process.env.TES_INT
    expect(envInt('TES_INT', 42)).toBe(42)

    process.env.TES_INT = 'bukan-angka'
    expect(envInt('TES_INT', 42)).toBe(42)

    process.env.TES_INT = '7'
    expect(envInt('TES_INT', 42)).toBe(7)
  })

  it('nilai bawaan rate limit sesuai PRD 8.2 dan 9.1', () => {
    // Login dibatasi 5 percobaan per menit per IP.
    expect(login.rateLimitPerIp()).toBe(5)
    expect(login.rateLimitPerAccount()).toBe(5)
    // Lockout bertahap mulai 10 kegagalan.
    expect(login.lockoutThreshold()).toBe(10)
    expect(login.lockoutMinutes()).toBe(30)
  })

  it('batas upload sesuai PRD 4.2 JRN-05', () => {
    // Screenshot maksimal 2 MB dan 3 berkas per trade.
    expect(upload.maxBytes()).toBe(2 * 1024 * 1024)
    expect(upload.maxPerTrade()).toBe(3)
  })

  it('token reset password berlaku 60 menit (AUTH-04)', () => {
    expect(passwordReset.ttlSeconds()).toBe(3600)
  })

  it('TLS database mati secara bawaan untuk loopback lokal', () => {
    delete process.env.DATABASE_SSL
    expect(db.ssl()).toBe(false)

    process.env.DATABASE_SSL = 'true'
    expect(db.ssl()).toBe(true)
  })

  it('kredensial migrasi dipakai hanya bila ada, lalu jatuh ke DATABASE_URL', () => {
    delete process.env.DATABASE_URL
    delete process.env.DATABASE_MIGRATE_URL
    expect(() => db.url()).toThrow(MissingEnvError)

    process.env.DATABASE_URL = 'mysql://app:rahasia@127.0.0.1:3306/tradeledger'
    expect(db.url()).toBe(process.env.DATABASE_URL)
    expect(db.migrateUrl()).toBe(process.env.DATABASE_URL)

    process.env.DATABASE_MIGRATE_URL = 'mysql://migrate:rahasia@127.0.0.1:3306/tradeledger'
    expect(db.migrateUrl()).toBe(process.env.DATABASE_MIGRATE_URL)
  })
})
