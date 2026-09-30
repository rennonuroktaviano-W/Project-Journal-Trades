import 'server-only'

import type { PrismaClient } from '@/generated/prisma/client'
import { prisma } from '@/lib/db/prisma'
import {
  type CanonicalValue,
  GENESIS_PREV_HASH,
  assertHash,
  canonicalTimestamp,
} from '@/lib/hash/canonical'
import { type ChainEvent, computeBlockHash, computePayloadHash } from '@/lib/hash/chain'

/**
 * Menulis satu blok ke hash chain dalam transaksi yang sama dengan perubahan
 * trade (PRD 10.1 butir 4).
 *
 * ## Soal penguncian
 *
 * PRD 7.3 butir 4 meminta `SELECT ... FOR UPDATE` pada blok terakhir pengguna
 * supaya `height` tidak bentrok. Itu tidak bisa dipakai di sini, dan alasannya
 * sudah diuji: di MySQL 8.4 sebuah locking read butuh hak `UPDATE` selain
 * `SELECT`. Akun aplikasi hanya punya `SELECT, INSERT` pada `chain_blocks`
 * (PRD 7.3 butir 1), jadi `SELECT ... FOR UPDATE` di sana ditolak `ERROR 1142`.
 *
 * Dua butir PRD itu tidak bisa dipenuhi sekaligus, dan butir 1 yang dipilih
 * karena di situlah jaminan append-only berasal, diperkuat trigger, dan diuji
 * di `prisma.test.ts`. Memberi `UPDATE` pada tabel append-only demi satu
 * locking read akan menukar keamanan yang sudah ditegakkan dengan kenyamanan.
 *
 * Serialisasi diambil dari baris `users` induknya, yang memang ada untuk setiap
 * blok karena `chain_blocks.user_id` memakai `ON DELETE RESTRICT`:
 *
 * - Mengunci baris `users` membatasi seluruh append milik satu akun, termasuk
 *   saat chain-nya masih kosong. Mengunci blok terakhir tidak bisa menutup
 *   kasus itu, karena pada blok pertama belum ada baris untuk dikunci.
 * - Pembacaan blok terakhir terjadi di transaksi yang sama, setelah kunci
 *   diambil, jadi tidak ada AppendToHashChain lain yang bisa menyisipkan blok
 *   di antaranya.
 * - `users` bukan tabel append-only dan sudah punya hak `UPDATE`, jadi locking
 *   read di sana diizinkan.
 * - `@@unique([userId, height])` tetap menjadi penjaga terakhir kalau ada
 *   jalur lain yang menulis di luar fungsi ini.
 *
 * Pemanggil yang juga menulis trade harus memakai {@link appendToHashChain} di
 * dalam `$transaction`-nya sendiri, bukan {@link appendToHashChainStandalone},
 * supaya blok dan perubahan trade benar-benar atomik.
 */

/** Klien transaksi Prisma: PrismaClient tanpa metode koneksi dan transaksi. */
export type ChainTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

export interface AppendBlockParams {
  userId: bigint
  tradeId: bigint
  event: ChainEvent
  /**
   * Baris `trade_revisions` yang jadi sumber snapshot. Wajib untuk event
   * `revised`; `null` untuk `created` dan `closed`.
   */
  revisionId?: bigint | null
  /** Wajib untuk event `revised` (PRD Flow C). */
  changeReason?: string | null
  /** Waktu server. Disuntikkan supaya bisa diuji. */
  now?: Date
}

export interface ChainBlockRow {
  id: bigint
  height: number
  prevHash: string
  payloadHash: string
  blockHash: string
  createdAt: Date
}

/** Baris blok terakhir milik seorang pengguna, atau `null` kalau belum ada. */
interface LastBlock {
  height: number
  blockHash: string
}

/**
 * `meta` disimpan sebagai JSON, sedangkan payload memakai nilai kanonik. JSON dari
 * database hanya berisi primitif, objek, dan array, jadi pemeriksaannya cukup
 * menolak nilai yang tidak bisa di-hash.
 */
function asCanonicalValue(value: unknown): CanonicalValue | null {
  if (value === null || value === undefined) return null

  if (
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value))
  ) {
    return value
  }

  if (Array.isArray(value)) {
    return value.map(asCanonicalValue)
  }

  if (typeof value === 'object') {
    const result: Record<string, CanonicalValue> = {}
    for (const [key, item] of Object.entries(value)) {
      const inner = asCanonicalValue(item)
      if (inner !== undefined) result[key] = inner
    }
    return result
  }

  throw new Error(`Nilai meta tidak bisa di-hash: ${String(value)}`)
}

export async function appendToHashChain(
  tx: ChainTransaction,
  params: AppendBlockParams,
): Promise<ChainBlockRow> {
  const { userId, tradeId, event } = params

  if (event === 'revised' && !params.changeReason) {
    throw new Error('Perubahan wajib menyertakan alasan (PRD Flow C)')
  }

  // Mengunci baris pengguna membatasi AppendToHashChain milik satu akun,
  // termasuk saat chain-nya masih kosong. `FOR UPDATE` di `users` diizinkan
  // karena tabel ini bukan append-only dan sudah punya hak `UPDATE`.
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`

  // Dibaca tanpa locking clause: kuncinya sudah di atas. `SELECT ... FOR UPDATE`
  // di sini akan ditolak `ERROR 1142`, lihat catatan penguncian di atas.
  const last = await tx.$queryRaw<LastBlock[]>`
    SELECT height, block_hash AS blockHash
      FROM chain_blocks
     WHERE user_id = ${userId}
     ORDER BY height DESC
     LIMIT 1
  `

  const previous = last[0]
  const height = previous ? previous.height + 1 : 0
  const prevHash = previous ? previous.blockHash : GENESIS_PREV_HASH

  const trade = await tx.trade.findUnique({
    where: { id: tradeId },
    select: {
      ulid: true,
      currentRevision: true,
      status: true,
      market: true,
      side: true,
      visibility: true,
      origin: true,
      emotion: true,
      entryPrice: true,
      stopLoss: true,
      takeProfit: true,
      exitPrice: true,
      positionSize: true,
      leverage: true,
      fees: true,
      riskAmount: true,
      pnl: true,
      rMultiple: true,
      openedAt: true,
      closedAt: true,
      meta: true,
      reason: true,
      review: true,
      instrument: { select: { symbol: true } },
      strategy: { select: { name: true } },
    },
  })

  if (!trade) {
    throw new Error(`Trade ${tradeId} tidak ditemukan`)
  }

  if (trade.status === 'cancelled') {
    throw new Error('Trade yang sudah dibatalkan tidak boleh menambah blok')
  }

  // Event `created` selalu revisi pertama. Revisi dan penutupan mengikuti nomor
  // revisi yang sedang aktif.
  const revisionNo = event === 'created' ? 1 : trade.currentRevision
  const createdAt = params.now ?? new Date()

  const payloadHash = computePayloadHash({
    event,
    tradeUlid: trade.ulid,
    revisionNo,
    market: trade.market,
    side: trade.side,
    status: trade.status,
    visibility: trade.visibility,
    origin: trade.origin,
    emotion: trade.emotion,
    instrumentSymbol: trade.instrument.symbol,
    strategyName: trade.strategy?.name ?? null,
    entryPrice: trade.entryPrice,
    stopLoss: trade.stopLoss,
    takeProfit: trade.takeProfit,
    exitPrice: trade.exitPrice,
    positionSize: trade.positionSize,
    leverage: trade.leverage,
    fees: trade.fees,
    riskAmount: trade.riskAmount,
    pnl: trade.pnl,
    rMultiple: trade.rMultiple,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    meta: asCanonicalValue(trade.meta),
    reason: trade.reason,
    review: trade.review,
    changeReason: event === 'revised' ? (params.changeReason ?? null) : null,
  })

  const blockHash = computeBlockHash({ prevHash, payloadHash, height, createdAt })

  const created = await tx.chainBlock.create({
    data: {
      userId,
      tradeId,
      height,
      revisionNo,
      revisionId: event === 'revised' ? (params.revisionId ?? null) : null,
      payloadHash,
      prevHash,
      blockHash,
      // Waktu server, bukan dari user (PRD 10.3). `created_at` ikut di-hash,
      // jadi waktu yang benar-benar tersimpan harus sama dengan waktu yang
      // di-hash, bukan pendekatan satu milidetik.
      createdAt,
    },
    select: { id: true, height: true, createdAt: true },
  })

  const storedTimestamp = canonicalTimestamp(created.createdAt)

  if (storedTimestamp !== canonicalTimestamp(createdAt)) {
    throw new Error(
      `Waktu blok berubah saat disimpan: di-hash ${canonicalTimestamp(createdAt)}, tersimpan ${storedTimestamp}`,
    )
  }

  // `chain_block_id` sengaja tidak ikut di payload, jadi pembaruan ini tidak
  // membatalkan hash blok yang baru saja ditulis.
  await tx.trade.update({
    where: { id: tradeId },
    data: { chainBlockId: created.id },
  })

  return {
    id: created.id,
    height,
    prevHash: assertHash(prevHash, 'prev_hash'),
    payloadHash: assertHash(payloadHash, 'payload_hash'),
    blockHash: assertHash(blockHash, 'block_hash'),
    createdAt: created.createdAt,
  }
}

/** P2002 Prisma: pelanggaran index unik, di sini berarti `height` bentrok. */
function isHeightConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  )
}

/**
 * Menulis blok dalam transaksinya sendiri, dengan percobaan ulang bila `height`
 * bentrok. Hanya untuk kasus yang tidak menyertai perubahan trade lain.
 */
export async function appendToHashChainStandalone(
  params: AppendBlockParams,
  maxAttempts = 3,
): Promise<ChainBlockRow> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await prisma.$transaction((tx) => appendToHashChain(tx, params), {
        isolationLevel: 'RepeatableRead',
      })
    } catch (error) {
      if (attempt >= maxAttempts || !isHeightConflict(error)) throw error
      await new Promise((resolve) => setTimeout(resolve, 10 * attempt))
    }
  }
}
