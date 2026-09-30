import { afterAll, describe, expect, it } from 'vitest'

import { prisma } from '@/lib/db/prisma'

/**
 * Uji koneksi ke MySQL.
 *
 * Test ini butuh database yang sudah dimigrasi, jadi dilewati kalau
 * `DATABASE_URL` tidak diisi. Dengan begitu `npm test` tetap bisa jalan di CI
 * tanpa MySQL, tapi di mesin lokal sungguhan menguji driver adapter-nya.
 */
const adaDatabase = Boolean(process.env.DATABASE_URL)

describe.skipIf(!adaDatabase)('koneksi Prisma ke MySQL', () => {
  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('basis data terhubung dan bisa dibaca', async () => {
    const rows = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT COUNT(*) AS n FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()
    `
    expect(Number(rows[0]?.n)).toBeGreaterThan(0)
  })

  it('akun aplikasi tidak boleh menyentuh _prisma_migrations', async () => {
    // Allow-list per tabel (PRD 7.3) tidak memberi hak apa pun pada tabel
    // internal Prisma, jadi aplikasi tidak bisa menyelipkan riwayat migrasi
    // palsu. Penolakan di sini adalah perilaku yang diharapkan, bukan bug.
    await expect(
      prisma.$queryRawUnsafe('SELECT migration_name FROM _prisma_migrations LIMIT 1'),
    ).rejects.toThrow()
  })

  it('tabel append-only memang ada dan bisa dibaca', async () => {
    expect(await prisma.chainBlock.count()).toBe(0)
    expect(await prisma.tradeRevision.count()).toBe(0)
    expect(await prisma.auditLog.count()).toBe(0)
    expect(await prisma.merkleAnchor.count()).toBe(0)
  })

  it('akun aplikasi tidak boleh mengubah tabel append-only', async () => {
    // Lapis 1 dari PRD 7.3: UPDATE dan DELETE tidak pernah diberikan ke
    // tradeledger_app pada keempat tabel ini, jadi penolakannya harus terjadi
    // di level hak MySQL, bukan cuma lewat trigger.
    await expect(
      prisma.$executeRawUnsafe("UPDATE audit_logs SET action = 'dipalsukan'"),
    ).rejects.toThrow()
    await expect(prisma.$executeRawUnsafe('DELETE FROM chain_blocks')).rejects.toThrow()
    await expect(
      prisma.$executeRawUnsafe("UPDATE trade_revisions SET change_reason = 'dipalsukan'"),
    ).rejects.toThrow()
    await expect(prisma.$executeRawUnsafe('DELETE FROM merkle_anchors')).rejects.toThrow()
  })

  it('akun aplikasi boleh menulis pada tabel biasa', async () => {
    // `emailHash` Char(64), jadi isinya harus persis 64 karakter.
    const emailHash = 'a'.repeat(64)
    const row = await prisma.loginAttempt.create({
      data: { emailHash, failureReason: 'sengaja' },
    })

    await prisma.loginAttempt.update({
      where: { id: row.id },
      data: { successful: true },
    })
    await prisma.loginAttempt.delete({ where: { id: row.id } })

    expect(await prisma.loginAttempt.count({ where: { emailHash } })).toBe(0)
  })
})
