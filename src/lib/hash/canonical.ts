/**
 * Kanonikalisasi untuk hash chain TradeLedger (PRD 10.1).
 *
 * PRD 10.1 butir 1 menulis "JSON dengan urutan key tetap berisi semua field trade"
 * tanpa menyebut urutan key-nya, aturan desimalnya, atau format waktunya. File
 * ini menetapkan aturan itu sekali saja supaya blok yang sama selalu menghasilkan
 * hash yang sama, di server maupun di browser pengguna.
 *
 * Tiga aturan yang dipegang di sini:
 *
 * 1. Nilai DECIMAL tidak pernah jadi number JavaScript. `DECIMAL(36,18)` jauh
 *    di luar presisi float, jadi selalu diserialisasi sebagai string desimal
 *    dengan 18 digit di belakang titik, apa pun skalanya di database.
 * 2. Waktu selalu UTC dengan presisi milidetik, format `YYYY-MM-DDTHH:MM:SS.sssZ`.
 *    Panjangnya selalu 24 karakter, jadi lebarnya tidak ikut berubah.
 * 3. Kunci JSON level atas berurutan tetap sesuai urutan di `TRADE_PAYLOAD_KEYS`.
 *    Kunci di dalam `meta` tidak dikontrol, jadi diurutkan agar hasilnya tetap
 *    deterministik.
 *
 * Semua yang di-hash ditulis sebagai teks dengan pemisah baris baru, bukan
 * objek yang di-`JSON.stringify` langsung, supaya urutan kunci tidak pernah
 * bergantung pada perilaku mesin JavaScript.
 */

import { createHash } from 'node:crypto'

/**
 * Versi spesifikasi hash chain. Nilainya ikut di-hash, jadi mengubah aturan
 * kanonikalisasi di masa depan berarti versi baru, bukan hash lama yang diam-diam
 * berubah artinya. PRD 7.2 tidak menyediakan kolom versi pada `chain_blocks`,
 * jadi pengikatan versi lewat isi payload ini adalah pilihannya.
 */
export const CHAIN_SPEC_VERSION = 'tl-chain/1'

/** `prev_hash` blok genesis adalah 64 nol (PRD 7.2). */
export const GENESIS_PREV_HASH = '0'.repeat(64)

/** Digit desimal tetap untuk setiap nilai DECIMAL yang masuk payload. */
export const DECIMAL_PLACES = 18

/** Pola `created_at` yang boleh masuk hash: UTC, presisi milidetik. */
const ISO_MILLIS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/

const HEX_64 = /^[0-9a-f]{64}$/

/**
 * Prisma.Decimal memenuhi antarmuka ini. Disifatkan secara struktural supaya
 * modul kanonikalisasi tidak perlu mengimpor Prisma Client, dan tetap bisa dipakai
 * ulang di browser saat pengguna memverifikasi chain (PRD 10.2).
 */
export interface DecimalLike {
  toFixed(decimalPlaces: number): string
}

/** Nilai yang boleh muncul di dalam `meta` atau di payload. */
export type CanonicalValue =
  string | number | boolean | null | CanonicalValue[] | { [key: string]: CanonicalValue }

function canonicalize(value: CanonicalValue): string {
  if (value === null) return 'null'

  switch (typeof value) {
    case 'string':
      return JSON.stringify(value)
    case 'boolean':
      return value ? 'true' : 'false'
    case 'number':
      if (!Number.isFinite(value)) {
        throw new Error(`Nilai angka tidak bisa di-hash: ${value}`)
      }
      // String(-0) sudah "0", jadi nol negatif tidak jadi bentuk berbeda.
      return String(value)
    default:
      break
  }

  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`
  }

  const entries = Object.entries(value).filter(([, v]) => v !== undefined)

  // Urutan kunci di sini DIJAGA, bukan diurutkan. Kunci level atas payload
  // didefinisikan di `chain.ts` dan urutannya bagian dari spesifikasi hash;
  // mengurutkannya di sini justru membatalkan PRD 10.1 butir 1.
  return `{${entries
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v as CanonicalValue)}`)
    .join(',')}}`
}

/**
 * Urutkan kunci objek secara rekursif, dipakai hanya untuk `meta` yang
 * kuncinya berasal dari user. Nilai lain sudah berurutan tetap di kodenya.
 */
export function sortUserJsonKeys(value: CanonicalValue): CanonicalValue {
  if (value === null || typeof value !== 'object') return value

  if (Array.isArray(value)) {
    return value.map(sortUserJsonKeys)
  }

  const result: Record<string, CanonicalValue> = {}

  for (const key of Object.keys(value).sort()) {
    const item = value[key]
    if (item !== undefined) result[key] = sortUserJsonKeys(item)
  }

  return result
}

/**
 * JSON kanonik: tanpa spasi, tanpa `undefined`, dan urutan kunci mengikuti
 * urutan property yang diberikan.
 */
export function canonicalJson(value: CanonicalValue): string {
  return canonicalize(value)
}

/** Waktu UTC presisi milidetik, panjang selalu 24 karakter. */
export function canonicalTimestamp(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)

  if (Number.isNaN(date.getTime())) {
    throw new Error(`Waktu tidak valid: ${String(value)}`)
  }

  const iso = date.toISOString()

  if (!ISO_MILLIS.test(iso)) {
    throw new Error(`Waktu harus UTC presisi milidetik, dapat: ${iso}`)
  }

  return iso
}

/**
 * Nilai DECIMAL jadi string desimal dengan 18 digit di belakang titik.
 * `null` tetap `null` supaya `exit_price` yang belum diisi bisa dibedakan dari
 * nilai nol, dan supaya pemverifikasi tidak perlu menebak.
 */
export function canonicalDecimal(value: DecimalLike | null | undefined): string | null {
  if (value === null || value === undefined) return null
  return value.toFixed(DECIMAL_PLACES)
}

/** Heksadesimal huruf kecil, 64 karakter. */
export function assertHash(value: string, label: string): string {
  if (!HEX_64.test(value)) {
    throw new Error(`${label} harus 64 karakter heksadesimal huruf kecil, dapat: ${value}`)
  }
  return value
}

/** SHA-256 heksadesimal huruf kecil dari teks UTF-8. */
export function sha256Hex(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex')
}

/**
 * Hash dari beberapa bagian yang dipisahkan baris baru.
 *
 * PRD 10.1 butir 3 menulis `prev_hash + payload_hash + height + created_at`
 * tanpa menyebut pemisahnya. Baris baru dipakai karena tidak mungkin muncul di
 * hash heksadesimal maupun di stempel waktu ISO, jadi tidak ada cara dua susunan
 * bagian berbeda menghasilkan input hash yang sama.
 */
export function sha256OfParts(kind: string, parts: readonly string[]): string {
  return sha256Hex([CHAIN_SPEC_VERSION, kind, ...parts].join('\n'))
}
