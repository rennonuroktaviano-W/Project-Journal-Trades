import { config as loadEnv } from 'dotenv'
import { defineConfig } from 'prisma/config'

/**
 * Konfigurasi Prisma 7.
 *
 * Prisma 7 tidak lagi membaca .env secara otomatis, jadi file-nya diload
 * sendiri di sini. Nilai diambil dari .env.local (wajib ada untuk development)
 * atau .env sebagai cadangan.
 *
 * Migrasi memakai akun berhak DDL penuh (`DATABASE_MIGRATE_URL`), sedangkan
 * aplikasi berjalan memakai akun tanpa hak UPDATE dan DELETE pada tabel
 * append-only (PRD 7.3).
 */
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file)
  if (existsSync(path)) {
    loadEnv({ path, override: false })
    break
  }
}

const migrateUrl = process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL

if (!migrateUrl) {
  throw new Error(
    'DATABASE_MIGRATE_URL atau DATABASE_URL wajib diisi pada .env.local untuk menjalankan migrasi.',
  )
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: migrateUrl,
    // Prisma membuat shadow database untuk mendeteksi drift. Akun migrasi
    // sengaja tidak diberi hak CREATE DATABASE supaya tidak bisa dipakai
    // membuat basis data sembarangan, jadi shadow database disiapkan manual
    // oleh database/01-bootstrap.sql.
    shadowDatabaseUrl:
      process.env.DATABASE_SHADOW_URL ??
      migrateUrl.replace('/tradeledger?', '/tradeledger_shadow?'),
  },
})
