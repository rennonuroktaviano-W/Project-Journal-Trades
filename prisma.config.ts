import { config, defineConfig } from 'prisma/config'
import { config as loadEnv } from 'dotenv'

/**
 * Konfigurasi Prisma 7.
 *
 * Prisma 7 tidak lagi membaca .env secara otomatis, jadi file-nya diload
 * sendiri di sini. Nilai diambil dari .env.local (wajib ada untuk desarrollo)
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

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL ?? config.fromEnv().DATABASE_URL,
  },
})