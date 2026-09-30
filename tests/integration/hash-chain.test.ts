import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { appendToHashChain } from '@/lib/chain/append-to-hash-chain'
import { prisma } from '@/lib/db/prisma'
import { GENESIS_PREV_HASH } from '@/lib/hash/canonical'
import { computeBlockHash, verifyBlock } from '@/lib/hash/chain'
import { merkleRoot } from '@/lib/hash/merkle'

/**
 * Uji hash chain terhadap MySQL sungguhan.
 *
 * Yang tidak bisa diuji tanpa database: penguncian `FOR UPDATE`, urutan
 * `height` yang tidak melompat, dan `created_at` yang harus sama persis dengan
 * waktu yang di-hash setelah disimpan.
 *
 * Test dilewati kalau `DATABASE_URL` tidak diisi, mengikuti `prisma.test.ts`.
 *
 *(chain_blocks) append-only, jadi baris yang dibuat di sini tidak bisa dihapus
 * dan jumlah blok akan bertambah setiap kali test dijalankan. Itu memang bukti
 * bahwa append-only-nya bekerja, jadi assertion-nya tidak mengharuskan tabel
 * kosong.
 */

const adaDatabase = Boolean(process.env.DATABASE_URL)

/** ULID 26 karakter, hanya untuk Sleep test ini. */
function ulid(suffix: string): string {
  return `01JTEST${suffix.padStart(18, '0')}`.slice(0, 26)
}

describe.skipIf(!adaDatabase)('hash chain di MySQL', () => {
  let userId: bigint
  let tradeId: bigint

  beforeAll(async () => {
    const suffix = String(Date.now()).slice(-6)

    const user = await prisma.user.create({
      data: {
        ulid: ulid(suffix),
        username: `uji_chain_${suffix}`,
        email: `uji-chain-${suffix}@example.test`,
        passwordHash: 'x'.repeat(60),
      },
    })
    userId = user.id

    const instrument = await prisma.instrument.create({
      data: {
        symbol: `UJI${suffix}`,
        name: 'Instrument uji hash chain',
        market: 'crypto',
        precision: 8,
      },
    })

    const trade = await prisma.trade.create({
      data: {
        ulid: ulid(`9${suffix}`),
        userId,
        instrumentId: instrument.id,
        market: 'crypto',
        side: 'long',
        status: 'closed',
        entryPrice: '100',
        exitPrice: '110',
        positionSize: '1',
        leverage: '1',
        fees: '0.1',
        riskAmount: '10',
        pnl: '9.9',
        rMultiple: '0.99',
        openedAt: new Date('2026-09-30T07:00:00.000Z'),
        closedAt: new Date('2026-09-30T19:00:00.000Z'),
      },
    })
    tradeId = trade.id
  })

  afterAll(async () => {
    // Baris trade tidak bisa dihapus karena `chain_blocks` menunjuknya dengan
    // ON DELETE RESTRICT. Test data-nya sengaja dibiarkan.
    await prisma.$disconnect()
  })

  it('blok pertama mulai dari height 0 dengan prev_hash 64 nol', async () => {
    const blok = await prisma.$transaction((tx) =>
      appendToHashChain(tx, {
        userId,
        tradeId,
        event: 'created',
        now: new Date('2026-09-30T20:00:00.000Z'),
      }),
    )

    expect(blok.height).toBe(0)
    expect(blok.prevHash).toBe(GENESIS_PREV_HASH)
    expect(blok.blockHash).toMatch(/^[0-9a-f]{64}$/)
    expect(blok.payloadHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('created_at yang tersimpan sama dengan waktu yang di-hash', async () => {
    // Kalau MySQL memotong atau membulatkan milidetik, blok yang tersimpan
    // tidak akan bisa diverifikasi siapa pun. `appendToHashChain` sudah
    // menolak kasus ini, dan test ini memastikan nilainya memang tersimpan utuh.
    const baris = await prisma.chainBlock.findFirstOrThrow({
      where: { userId },
      orderBy: { height: 'asc' },
    })

    expect(baris.createdAt.toISOString()).toBe('2026-09-30T20:00:00.000Z')
    expect(
      computeBlockHash({
        prevHash: baris.prevHash,
        payloadHash: baris.payloadHash,
        height: baris.height,
        createdAt: baris.createdAt,
      }),
    ).toBe(baris.blockHash)
  })

  it('blok kedua menyambung ke blok pertama dan height naik satu', async () => {
    const blok = await prisma.$transaction((tx) =>
      appendToHashChain(tx, {
        userId,
        tradeId,
        event: 'closed',
        now: new Date('2026-10-01T20:00:00.000Z'),
      }),
    )

    const pertama = await prisma.chainBlock.findFirstOrThrow({
      where: { userId, height: 0 },
    })

    expect(blok.height).toBe(1)
    expect(blok.prevHash).toBe(pertama.blockHash)
  })

  it('height tidak melompat dan tidak ganda untuk satu pengguna', async () => {
    for (let i = 2; i < 5; i += 1) {
      await prisma.$transaction((tx) => appendToHashChain(tx, { userId, tradeId, event: 'closed' }))
    }

    const heights = await prisma.chainBlock.findMany({
      where: { userId },
      orderBy: { height: 'asc' },
      select: { height: true },
    })

    expect(heights.map((h) => h.height)).toEqual([0, 1, 2, 3, 4])
  })

  it('seluruh rantai pengguna terverifikasi dari blok pertama', async () => {
    const blok = await prisma.chainBlock.findMany({
      where: { userId },
      orderBy: { height: 'asc' },
    })

    let prev = GENESIS_PREV_HASH

    for (const baris of blok) {
      expect(
        verifyBlock(
          {
            blockHash: baris.blockHash,
            prevHash: baris.prevHash,
            payloadHash: baris.payloadHash,
            height: baris.height,
            createdAt: baris.createdAt,
          },
          prev,
        ),
      ).toEqual({ valid: true })

      prev = baris.blockHash
    }
  })

  it('trades.chain_block_id menunjuk blok terakhir', async () => {
    const trade = await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } })
    const terakhir = await prisma.chainBlock.findFirstOrThrow({
      where: { userId },
      orderBy: { height: 'desc' },
    })

    expect(trade.chainBlockId).toBe(terakhir.id)
  })

  it('append yang gagal tidak meninggalkan blok separuh jadi', async () => {
    // PRD 10.1 butir 4: blok dan perubahan trade dalam satu transaksi. Kalau
    // penambahan blok ditolak, `chain_block_id` tidak boleh ikut berubah.
    const sebelum = await prisma.chainBlock.count({ where: { userId } })
    const tradeSebelum = await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } })

    await expect(
      prisma.$transaction((tx) =>
        appendToHashChain(tx, {
          userId,
          tradeId,
          event: 'revised',
          changeReason: null,
        }),
      ),
    ).rejects.toThrow(/alasan/)

    expect(await prisma.chainBlock.count({ where: { userId } })).toBe(sebelum)

    const tradeSesudah = await prisma.trade.findUniqueOrThrow({ where: { id: tradeId } })
    expect(tradeSesudah.chainBlockId).toBe(tradeSebelum.chainBlockId)
  })

  it('perubahan trade menghasilkan blok dengan payload_hash berbeda', async () => {
    // PRD JRN-07 dan Flow C: revisi menambah blok baru, blok lama utuh.
    const sebelum = await prisma.chainBlock.findMany({
      where: { userId },
      orderBy: { height: 'asc' },
      select: { payloadHash: true },
    })

    const revisi = await prisma.tradeRevision.create({
      data: {
        tradeId,
        revisionNo: 2,
        snapshot: { catatan: 'revisi uji' },
        changeReason: 'salah ketik harga exit',
        createdBy: userId,
      },
    })

    await prisma.trade.update({ where: { id: tradeId }, data: { review: 'direvisi' } })

    const blokBaru = await prisma.$transaction((tx) =>
      appendToHashChain(tx, {
        userId,
        tradeId,
        event: 'revised',
        revisionId: revisi.id,
        changeReason: 'salah ketik harga exit',
        now: new Date('2026-10-02T20:00:00.000Z'),
      }),
    )

    const sesudah = await prisma.chainBlock.findMany({
      where: { userId },
      orderBy: { height: 'asc' },
      select: { payloadHash: true },
    })

    expect(sesudah).toHaveLength(sebelum.length + 1)
    // Blok lama tidak boleh berubah sama sekali.
    expect(sesudah.slice(0, sebelum.length).map((b) => b.payloadHash)).toEqual(
      sebelum.map((b) => b.payloadHash),
    )
    expect(blokBaru.payloadHash).not.toBe(sebelum[sebelum.length - 1]?.payloadHash)
  })

  it('blok yang ditulis ulang manual membuat verifikasi gagal (PRD 13.4)', async () => {
    // Simulasi penyerang yang menulis `block_hash` palsu langsung ke database.
    // Akun aplikasi tidak boleh bisa melakukannya, jadi disimulasikan lewat
    // nilai yang salah dihitung di sisi pembacaan, sama dengan hasil manipulasi
    // yang berhasil kalau append-only dilanggar.
    const baris = await prisma.chainBlock.findFirstOrThrow({
      where: { userId },
      orderBy: { height: 'asc' },
    })

    const dipalsukan = {
      blockHash: 'f'.repeat(64),
      prevHash: baris.prevHash,
      payloadHash: baris.payloadHash,
      height: baris.height,
      createdAt: baris.createdAt,
    }

    expect(verifyBlock(dipalsukan, GENESIS_PREV_HASH).valid).toBe(false)
  })

  it('akar merkle mencakup satu daun per pengguna', async () => {
    const blok = await prisma.chainBlock.findMany({
      where: { userId },
      orderBy: { height: 'desc' },
      take: 1,
    })

    const root = merkleRoot([
      { userId: userId.toString(), height: blok[0]!.height, blockHash: blok[0]!.blockHash },
    ])

    expect(root).toMatch(/^[0-9a-f]{64}$/)
  })
})
