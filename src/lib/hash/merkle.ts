/**
 * Akar Merkle harian untuk menggabungkan seluruh chain semua pengguna menjadi
 * satu bukti ringkas (PRD 10.2, tabel `merkle_anchors`).
 *
 * PRD hanya menyebutkan tujuannya, yaitu "gabungan hash blok terakhir semua
 * user", tanpa algoritma pohonnya. Modul ini menetapkan bentuknya supaya hasilnya
 * bisa dihitung ulang pihak ketiga tanpa akses ke kode server (PRD 10.2).
 *
 * Aturan yang dipakai:
 *
 * - Satu daun per pengguna yang punya blok sampai akhir hari anchor. Daunnya
 *   memuat `user_id`, `height`, dan `block_hash` blok terakhir pengguna itu.
 *   `user_id` ikut di-hash supaya daun tidak bisa dipindah antar pengguna.
 * - Daun diurutkan `user_id` menaik secara numerik sebelum pohon dibangun, jadi
 *   urutan query database tidak memengaruhi root.
 * - Pohon biner. Simpul internal adalah SHA-256 dari 32 byte kiri diikuti 32
 *   byte kanan, dihitung atas byte biner, bukan atas teks heksa.
 * - Jumlah daun ganjil: daun terakhir diulang, cara standar yang tidak
 *   membutuhkan daun tambahan.
 * - Tanpa daun: hasilnya tetap hash yang terdefinisi, bukan string kosong, agar
 *   `merkle_root` selalu 64 karakter. Anchor tanpa blok tidak ditulis sama sekali
 *   oleh pemanggil karena tidak memuat bukti apa pun.
 */

import { createHash } from 'node:crypto'

import { CHAIN_SPEC_VERSION, assertHash, sha256OfParts } from './canonical'

/** Satu daun: blok terakhir sebuah pengguna pada hari anchor. */
export interface MerkleLeaf {
  /** `users.id` sebagai desimal, supaya bisa diurutkan dan di-hash apa adanya. */
  userId: string
  height: number
  blockHash: string
}

/** Root untuk hari tanpa blok apa pun. */
export const EMPTY_MERKLE_ROOT = sha256OfParts('merkle-empty', [])

function hashLeaf(leaf: MerkleLeaf): Buffer {
  if (!/^\d+$/.test(leaf.userId)) {
    throw new Error(`user_id harus angka desimal, dapat: ${leaf.userId}`)
  }
  if (!Number.isInteger(leaf.height) || leaf.height < 0) {
    throw new Error(`height harus bilangan bulat mulai 0, dapat: ${leaf.height}`)
  }
  assertHash(leaf.blockHash, 'block_hash daun')

  return Buffer.from(
    sha256OfParts('merkle-leaf', [leaf.userId, String(leaf.height), leaf.blockHash]),
    'hex',
  )
}

function hashNode(left: Buffer, right: Buffer): Buffer {
  return createHash('sha256').update(left).update(right).digest()
}

/**
 * Hitung akar Merkle dari kumpulan daun.
 *
 * Urutan masukan tidak berpengaruh, daun dinormalkan lebih dulu. `userId` yang
 * sama dua kali ditolak, karena itu berarti blok terakhir pengguna ambigu dan
 * anchor-nya tidak bisa diverifikasi.
 */
export function merkleRoot(leaves: readonly MerkleLeaf[]): string {
  if (leaves.length === 0) return EMPTY_MERKLE_ROOT

  const seen = new Set<string>()

  for (const leaf of leaves) {
    if (seen.has(leaf.userId)) {
      throw new Error(`user_id ${leaf.userId} muncul lebih dari sekali pada anchor yang sama`)
    }
    seen.add(leaf.userId)
  }

  const sorted = [...leaves].sort((a, b) => {
    const left = BigInt(a.userId)
    const right = BigInt(b.userId)
    return left < right ? -1 : left > right ? 1 : 0
  })

  let level = sorted.map(hashLeaf)

  while (level.length > 1) {
    // Daun ganjil diulang supaya setiap pasangan punya dua sisi tanpa harus
    // membuat daun tambahan yang isinya tidak berasal dari data mana pun.
    if (level.length % 2 === 1) {
      const last = level[level.length - 1]
      if (!last) throw new Error('Level pohon Merkle kosong')
      level.push(last)
    }

    const next: Buffer[] = []

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]
      const right = level[i + 1]
      if (!left || !right) throw new Error('Pasangan node Merkle tidak lengkap')
      next.push(hashNode(left, right))
    }

    level = next
  }

  const root = level[0]
  if (!root) throw new Error('Pohon Merkle tidak menghasilkan akar')

  return root.toString('hex')
}

/**
 * Batas waktu `anchorDate` untuk menghitung blok yang masuk anchor.
 *
 * Semua waktu disimpan UTC (PRD 7), jadi satu hari anchor adalah
 * `[00:00:00.000Z, 24:00:00.000Z)`. Batas dipakai eksklusif supaya blok tepat
 * pada tengah malam hari berikutnya masuk anchor besok, tidak ambigu.
 */
export function anchorWindowUtc(anchorDate: string): { from: Date; until: Date } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(anchorDate)) {
    throw new Error(`anchor_date harus format YYYY-MM-DD, dapat: ${anchorDate}`)
  }

  const from = new Date(`${anchorDate}T00:00:00.000Z`)

  if (Number.isNaN(from.getTime())) {
    throw new Error(`anchor_date tidak valid: ${anchorDate}`)
  }

  return { from, until: new Date(from.getTime() + 86_400_000) }
}

/** Versi spesifikasi yang dipakai modul ini, untuk dicocokkan saat verifikasi. */
export const MERKLE_SPEC_VERSION = CHAIN_SPEC_VERSION
