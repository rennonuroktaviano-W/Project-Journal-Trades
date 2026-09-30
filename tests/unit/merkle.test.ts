import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import { CHAIN_SPEC_VERSION } from '@/lib/hash/canonical'
import { EMPTY_MERKLE_ROOT, type MerkleLeaf, anchorWindowUtc, merkleRoot } from '@/lib/hash/merkle'

/**
 * Hash yang diharapkan dihitung ulang di luar modul yang diuji, mengikuti
 * aturan yang tertulis di `docs/hash-chain-spec.md`. Kalau test memakai helper
 * yang sama dengan implementasi, test hanya membuktikan konsistensi diri.
 */

const H = (parts: string[]) =>
  createHash('sha256')
    .update([CHAIN_SPEC_VERSION, ...parts].join('\n'))
    .digest('hex')

function daun(userId: string, height: number): MerkleLeaf {
  const blockHash = createHash('sha256').update(`blok-${userId}-${height}`).digest('hex')
  return { userId, height, blockHash }
}

/** Hash daun. Simpul internal dihitung atas nilai ini, bukan atas block_hash. */
const hashDaun = (d: MerkleLeaf) => H(['merkle-leaf', d.userId, String(d.height), d.blockHash])

function node(left: string, right: string): string {
  return createHash('sha256')
    .update(Buffer.from(left, 'hex'))
    .update(Buffer.from(right, 'hex'))
    .digest('hex')
}

/** Pohon acuan yang ditulis ulang dari aturan spesifikasi, bukan dari modul. */
function akarAcuan(daun: readonly MerkleLeaf[]): string {
  if (daun.length === 0) return H(['merkle-empty'])

  let level: Buffer[] = [...daun]
    .sort((a, b) => (BigInt(a.userId) < BigInt(b.userId) ? -1 : 1))
    .map((d) => Buffer.from(hashDaun(d), 'hex'))

  while (level.length > 1) {
    if (level.length % 2 === 1) level.push(level[level.length - 1] as Buffer)

    const next: Buffer[] = []

    for (let i = 0; i < level.length; i += 2) {
      next.push(
        createHash('sha256')
          .update(level[i] as Buffer)
          .update(level[i + 1] as Buffer)
          .digest(),
      )
    }

    level = next
  }

  return (level[0] as Buffer).toString('hex')
}

describe('akar merkle', () => {
  it('tanpa daun menghasilkan root yang tetap 64 karakter', () => {
    expect(merkleRoot([])).toBe(EMPTY_MERKLE_ROOT)
    expect(merkleRoot([])).toMatch(/^[0-9a-f]{64}$/)
  })

  it('satu daun adalah hash daunnya sendiri', () => {
    const d = daun('7', 3)
    expect(merkleRoot([d])).toBe(hashDaun(d))
  })

  it('dua daun dihitung atas byte biner, bukan teks heksa', () => {
    const a = daun('1', 0)
    const b = daun('2', 5)
    expect(merkleRoot([a, b])).toBe(node(hashDaun(a), hashDaun(b)))
  })

  it('dua daun terbalik tetap menghasilkan root yang sama', () => {
    const a = daun('1', 0)
    const b = daun('2', 5)
    expect(merkleRoot([a, b])).toBe(merkleRoot([b, a]))
  })

  it('daun ganjil mengulang daun terakhir sebelum di-pairing', () => {
    // Level [A, B, C] jadi [A, B, C, C], lalu node = node(node(A,B), node(C,C)).
    // Daun yang diulang jadi sisi node, bukan disisipkan apa adanya sebagai node.
    const a = daun('1', 0)
    const b = daun('2', 5)
    const c = daun('3', 9)
    expect(merkleRoot([a, b, c])).toBe(
      node(node(hashDaun(a), hashDaun(b)), node(hashDaun(c), hashDaun(c))),
    )
    expect(akarAcuan([a, b, c])).toBe(merkleRoot([a, b, c]))
  })

  it('urutan user_id diurutkan secara numerik, bukan leksikografis', () => {
    // "10" < "9" secara teks, tapi user 9 harus lebih dulu secara angka.
    const sembilan = daun('9', 0)
    const sepuluh = daun('10', 0)
    expect(merkleRoot([sembilan, sepuluh])).toBe(merkleRoot([sepuluh, sembilan]))
    expect(merkleRoot([sembilan, sepuluh])).toBe(node(hashDaun(sembilan), hashDaun(sepuluh)))
  })

  it('cocok dengan pohon acuan untuk beberapa ukuran', () => {
    for (const n of [1, 2, 3, 4, 5, 7, 8, 9, 16]) {
      const daftar = Array.from({ length: n }, (_, i) => daun(String(i + 1), i))
      expect(merkleRoot(daftar)).toBe(akarAcuan(daftar))
    }
  })

  it('mengikat user_id ke daunnya, jadi daun tidak bisa dipindah', () => {
    // Tanpa user_id di hash, daun yang sama bisa ditukar antar pengguna dan
    // root-nya tetap sama. PRD 10.2 menyebut root sebagai bukti seluruh chain.
    const asli = daun('1', 0)
    const dipindah = { ...asli, userId: '2' }
    expect(merkleRoot([asli])).not.toBe(merkleRoot([dipindah]))
  })

  it('mengikat height ke daunnya', () => {
    const asli = daun('1', 0)
    expect(merkleRoot([asli])).not.toBe(merkleRoot([{ ...asli, height: 1 }]))
  })

  it('menolak user yang sama dua kali karena blok terakhirnya ambigu', () => {
    const a = daun('1', 0)
    expect(() => merkleRoot([a, { ...a, height: 4 }])).toThrow(/lebih dari sekali/)
  })

  it('menolak daun yang bentuknya salah', () => {
    expect(() => merkleRoot([{ userId: 'abc', height: 0, blockHash: 'a'.repeat(64) }])).toThrow(
      /user_id/,
    )
    expect(() => merkleRoot([{ userId: '1', height: -1, blockHash: 'a'.repeat(64) }])).toThrow(
      /height/,
    )
    expect(() => merkleRoot([{ userId: '1', height: 0, blockHash: 'pendek' }])).toThrow(
      /block_hash/,
    )
  })
})

describe('jendela anchor harian', () => {
  it('satu hari anchor adalah 24 jam UTC', () => {
    const { from, until } = anchorWindowUtc('2026-09-30')
    expect(from.toISOString()).toBe('2026-09-30T00:00:00.000Z')
    expect(until.toISOString()).toBe('2026-10-01T00:00:00.000Z')
    expect(until.getTime() - from.getTime()).toBe(86_400_000)
  })

  it('batas atas eksklusif supaya blok tengah malam tidak ambigu', () => {
    const { until } = anchorWindowUtc('2026-09-30')
    expect(until.getTime()).toBeGreaterThan(new Date('2026-09-30T23:59:59.999Z').getTime())
  })

  it('format tanggal ditolak kalau salah', () => {
    expect(() => anchorWindowUtc('30-09-2026')).toThrow(/anchor_date/)
    expect(() => anchorWindowUtc('2026-09-30T00:00:00Z')).toThrow(/anchor_date/)
  })
})
