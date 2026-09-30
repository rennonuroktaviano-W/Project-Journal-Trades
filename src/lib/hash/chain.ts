/**
 * Pembentukan dan verifikasi hash block TradeLedger (PRD 10.1).
 *
 * Rantai_blok bersifat per pengguna: `prev_hash` selalu milik blok sebelumnya
 * milik user yang sama (PRD 10.1 butir 3). Modul ini murni, tanpa database, jadi
 * aturan yang sama bisa dipakai server maupun browser untuk menghitung ulang
 * hash saat pengguna menekan tombol Verifikasi (PRD 10.2, SOC-04).
 */

import {
  assertHash,
  canonicalDecimal,
  canonicalJson,
  canonicalTimestamp,
  CHAIN_SPEC_VERSION,
  sha256Hex,
  sha256OfParts,
  sortUserJsonKeys,
  type CanonicalValue,
  type DecimalLike,
} from './canonical'

/** Tiga event yang membentuk blok baru (PRD 10.1 butir 1). */
export type ChainEvent = 'created' | 'revised' | 'closed'

/**
 * Bagian payload yang di-hash, sudah dinormalisasi ke bentuk teks.
 *
 * Yang tidak ikut dan alasannya:
 *
 * - `user_id` dan `id`: keduanya BIGINT AUTO_INCREMENT. Memakai ULID publik
 *   membuat payload tahan anomisasi akun (PRD 9.4), dan/user sudah tersirat dari
 *   chain-nya sendiri yang per user.
 * - `updated_at` dan `deleted_at`: waktu administer, bukan isi trade.
 * - `chain_block_id`: menunjuk balik ke blok yang sedang dibuat, jadi tidak
 *   mungkin ikut dihitung tanpa lingkaran.
 * - `current_revision`: nilainya sama dengan `revision_no` yang sudah ada.
 */
export interface TradePayloadInput {
  event: ChainEvent
  tradeUlid: string
  revisionNo: number
  market: string
  side: string
  status: string
  visibility: string
  origin: string
  emotion: string | null
  instrumentSymbol: string
  strategyName: string | null
  entryPrice: DecimalLike | null
  stopLoss: DecimalLike | null
  takeProfit: DecimalLike | null
  exitPrice: DecimalLike | null
  positionSize: DecimalLike | null
  leverage: DecimalLike
  fees: DecimalLike
  riskAmount: DecimalLike | null
  pnl: DecimalLike | null
  rMultiple: DecimalLike | null
  openedAt: Date | string
  closedAt: Date | string | null
  meta: CanonicalValue | null
  reason: string | null
  review: string | null
  changeReason: string | null
}

/**
 * Urutan kunci level atas. PRD 10.1 hanya menyebut "urutan key tetap", jadi
 * daftar ini adalah definisinya dan tidak boleh diubah tanpa menaikkan
 * {@link CHAIN_SPEC_VERSION}.
 */
const PAYLOAD_KEYS = [
  'spec',
  'event',
  'trade_ulid',
  'revision_no',
  'market',
  'side',
  'status',
  'visibility',
  'origin',
  'emotion',
  'instrument_symbol',
  'strategy_name',
  'entry_price',
  'stop_loss',
  'take_profit',
  'exit_price',
  'position_size',
  'leverage',
  'fees',
  'risk_amount',
  'pnl',
  'r_multiple',
  'opened_at',
  'closed_at',
  'meta',
  'reason',
  'review',
  'change_reason',
] as const

/**
 * Payload kanonik sebagai teks JSON.
 *
 * `spec` ikut di dalam payload supaya versi spesifikasi terikat secara
 * kriptografis, bukan cuma lewat dokumentasi.
 */
export function buildTradePayload(input: TradePayloadInput): string {
  if (!Number.isInteger(input.revisionNo) || input.revisionNo < 1) {
    throw new Error(`revision_no harus bilangan bulat mulai 1, dapat: ${input.revisionNo}`)
  }

  const payload: Record<string, CanonicalValue> = {
    spec: CHAIN_SPEC_VERSION,
    event: input.event,
    trade_ulid: input.tradeUlid,
    revision_no: input.revisionNo,
    market: input.market,
    side: input.side,
    status: input.status,
    visibility: input.visibility,
    origin: input.origin,
    emotion: input.emotion,
    instrument_symbol: input.instrumentSymbol,
    strategy_name: input.strategyName,
    entry_price: canonicalDecimal(input.entryPrice),
    stop_loss: canonicalDecimal(input.stopLoss),
    take_profit: canonicalDecimal(input.takeProfit),
    exit_price: canonicalDecimal(input.exitPrice),
    position_size: canonicalDecimal(input.positionSize),
    leverage: canonicalDecimal(input.leverage),
    fees: canonicalDecimal(input.fees),
    risk_amount: canonicalDecimal(input.riskAmount),
    pnl: canonicalDecimal(input.pnl),
    r_multiple: canonicalDecimal(input.rMultiple),
    opened_at: canonicalTimestamp(input.openedAt),
    closed_at: input.closedAt === null ? null : canonicalTimestamp(input.closedAt),
    // `meta` satu-satunya bagian yang kuncinya berasal dari user, jadi diurutkan.
    meta: input.meta === null ? null : sortUserJsonKeys(input.meta),
    reason: input.reason,
    review: input.review,
    change_reason: input.changeReason,
  }

  const keys = Object.keys(payload)
  const expected = PAYLOAD_KEYS.join(',')

  if (keys.join(',') !== expected) {
    // Penjaga supaya kunci yang tertinggal atau bertambah ketahuan di sini,
    // bukan lewat hash yang diam-diam berbeda.
    throw new Error(`Urutan kunci payload tidak cocok dengan spesifikasi: ${keys.join(',')}`)
  }

  return canonicalJson(payload)
}

/** PRD 10.1 butir 2: SHA-256 dari payload kanonik. */
export function computePayloadHash(input: TradePayloadInput): string {
  return sha256Hex(buildTradePayload(input))
}

/** Bagian yang sudah tervalidasi untuk menghitung `block_hash`. */
export interface BlockHashInput {
  prevHash: string
  payloadHash: string
  height: number
  createdAt: Date | string
}

/**
 * PRD 10.1 butir 3: `block_hash = SHA-256(prev_hash + payload_hash + height +
 * created_at)`, dengan pemisah baris baru supaya tidak ambigu.
 *
 * Input divalidasi ketat. Karena PRD 7.2 tidak menyediakan kolom versi pada
 * `chain_blocks`, hash yang salah tidak akan pernah ketahuan setelah tersimpan;
 * lebih baik gagal saat menulis daripada menyimpan blok yang mustahil
 * diverifikasi siapa pun.
 */
export function computeBlockHash(input: BlockHashInput): string {
  assertHash(input.prevHash, 'prev_hash')
  assertHash(input.payloadHash, 'payload_hash')

  if (!Number.isInteger(input.height) || input.height < 0) {
    throw new Error(`height harus bilangan bulat mulai 0, dapat: ${input.height}`)
  }

  return sha256OfParts('block', [
    input.prevHash,
    input.payloadHash,
    String(input.height),
    canonicalTimestamp(input.createdAt),
  ])
}

/** Hasil pemeriksaan satu blok. */
export type BlockVerdict = { valid: true } | { valid: false; reason: string }

/** Nilai blok yang tersimpan di `chain_blocks`, untuk diverifikasi ulang. */
export interface StoredBlock {
  blockHash: string
  prevHash: string
  payloadHash: string
  height: number
  createdAt: Date | string
}

/**
 * Periksa satu blok terhadap nilai yang tersimpan.
 *
 * Dua hal diperiksa: `block_hash` dihitung ulang dari empat bendanya, dan
 * `prev_hash`-nya cocok dengan blok sebelumnya. `payloadHash` tidak dihitung
 * ulang di sini karena itu butuh isi trade; pemanggil yang punya trade
 * memakai {@link verifyPayloadHash}. Yang diperiksa fungsi ini murni keutuhan blok
 * dan sambungannya.
 */
export function verifyBlock(stored: StoredBlock, expectedPrevHash?: string): BlockVerdict {
  if (expectedPrevHash !== undefined && stored.prevHash !== expectedPrevHash) {
    return {
      valid: false,
      reason: `prev_hash tidak nyambung: blok menyebut ${stored.prevHash}, blok sebelumnya menyertakan ${expectedPrevHash}`,
    }
  }

  let recomputed: string

  try {
    recomputed = computeBlockHash(stored)
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) }
  }

  if (recomputed !== stored.blockHash) {
    return {
      valid: false,
      reason: `block_hash tidak cocok: tersimpan ${stored.blockHash}, dihitung ulang ${recomputed}`,
    }
  }

  return { valid: true }
}

/** Hitung ulang `payload_hash` dari isi trade untuk dicocokkan dengan blok. */
export function verifyPayloadHash(input: TradePayloadInput, expected: string): BlockVerdict {
  let recomputed: string

  try {
    recomputed = computePayloadHash(input)
  } catch (error) {
    return { valid: false, reason: error instanceof Error ? error.message : String(error) }
  }

  if (recomputed !== expected) {
    return {
      valid: false,
      reason: `payload_hash tidak cocok: tersimpan ${expected}, dihitung ulang ${recomputed}`,
    }
  }

  return { valid: true }
}
