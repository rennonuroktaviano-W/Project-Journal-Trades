/**
 * Seed data referensi TradeLedger.
 *
 * Dijalankan otomatis oleh `prisma migrate reset` dan bisa dipanggil manual
 * dengan `npm run db:seed`. Script ini harus idempoten: menjalankannya berkali
 * kali tidak boleh mengubah hasil.
 *
 * Seed sengaja TIDAK membuat user. Password belum di-hash karena blok
 * autentikasi belum ada, dan user dummy di database pengembangan mudah ikut
 * terbawa ke produksi.
 */

import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import { PrismaClient } from '../src/generated/prisma/client'

const migrateUrl = process.env.DATABASE_MIGRATE_URL ?? process.env.DATABASE_URL

if (!migrateUrl) {
  throw new Error(
    'DATABASE_MIGRATE_URL atau DATABASE_URL wajib diisi pada .env.local untuk menjalankan seed.',
  )
}

const parsed = new URL(migrateUrl)
const adapter = new PrismaMariaDb({
  host: parsed.hostname,
  port: parsed.port ? Number(parsed.port) : 3306,
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: parsed.pathname.replace(/^\/+/, ''),
  connectTimeout: 10_000,
  allowPublicKeyRetrieval: process.env.DATABASE_SSL !== 'true',
})

const prisma = new PrismaClient({ adapter })

/** Nilai bawaan yang wajib ada supaya aplikasi tidak perlu hard-code. */
const PENGATURAN_AWAL: Array<{ key: string; value: unknown }> = [
  { key: 'site.tagline', value: 'Jurnal trading yang tidak bisa disunting diam-diam' },
  { key: 'site.registrasi_buka', value: false },
  { key: 'trade.max_median', value: 50 },
  { key: 'moderasi.komentar_dimatikan', value: false },
  { key: 'market_data.enabled', value: false },
]

async function main() {
  for (const { key, value } of PENGATURAN_AWAL) {
    // `update` dikosongkan supaya nilai yang sudah diubah operator tidak
    // ditimpa setiap kali seed dijalankan ulang.
    await prisma.setting.upsert({
      where: { key },
      create: { key, value: value as never, updatedAt: new Date() },
      update: {},
    })
  }

  const total = await prisma.setting.count()
  console.log(`Seed selesai. Pengaturan yang tersedia: ${total}.`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error('Seed gagal:', error instanceof Error ? error.message : error)
    await prisma.$disconnect()
    process.exit(1)
  })
