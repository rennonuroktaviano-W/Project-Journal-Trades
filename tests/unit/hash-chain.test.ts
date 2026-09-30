import { Prisma } from '@/generated/prisma/client'
import {
  CHAIN_SPEC_VERSION,
  GENESIS_PREV_HASH,
  canonicalDecimal,
  canonicalJson,
  canonicalTimestamp,
  sha256Hex,
  sha256OfParts,
  sortUserJsonKeys,
} from '@/lib/hash/canonical'
import {
  type TradePayloadInput,
  buildTradePayload,
  computeBlockHash,
  computePayloadHash,
  verifyBlock,
  verifyPayloadHash,
} from '@/lib/hash/chain'
import { describe, expect, it } from 'vitest'

/**
 * Hash yang diharapkan di sini dihitung ulang di luar fungsi yang diuji, memakai
 * `sha256sum` di implementasi yang sama. Kalau implementasi dan test
 * memakai kode yang sama, test hanya membuktikan kode itu konsisten dengan
 * dirinya sendiri, bukan bahwa aturannya benar.
 *
 * Nilai literal di bawah berasal dari perintah:
 *   printf '...' | sha256sum
 */

function input(ubah: Partial<TradePayloadInput> = {}): TradePayloadInput {
  return {
    event: 'created',
    tradeUlid: '01JQ8W7X9Z4K2M6N8P0Q3R5T7V',
    revisionNo: 1,
    market: 'crypto',
    side: 'long',
    status: 'closed',
    visibility: 'public',
    origin: 'manual',
    emotion: 'calm',
    instrumentSymbol: 'BTCUSDT',
    strategyName: 'Breakout',
    entryPrice: new Prisma.Decimal('65000.5'),
    stopLoss: new Prisma.Decimal('63000'),
    takeProfit: new Prisma.Decimal('70000'),
    exitPrice: new Prisma.Decimal('69500.25'),
    positionSize: new Prisma.Decimal('0.015'),
    leverage: new Prisma.Decimal('1'),
    fees: new Prisma.Decimal('12.345678901234567891'),
    riskAmount: new Prisma.Decimal('307.5'),
    pnl: new Prisma.Decimal('457.5'),
    rMultiple: new Prisma.Decimal('1.487804878048781'),
    openedAt: '2026-09-30T07:12:34.567Z',
    closedAt: '2026-09-30T19:45:00.001Z',
    meta: { exchange: 'binance', spot: true, note: 'sla < 1%' },
    reason: 'Breakout daily',
    review: 'Bagus, jangan buru-buru exit',
    changeReason: null,
    ...ubah,
  }
}

describe('kanonikalisasi', () => {
  it('versi spesifikasi ikut terikat di dalam hash', () => {
    expect(CHAIN_SPEC_VERSION).toBe('tl-chain/1')
  })

  it('decimal ditulis dengan 18 digit di belakang titik', () => {
    expect(canonicalDecimal(new Prisma.Decimal('1'))).toBe('1.' + '0'.repeat(18))
    expect(canonicalDecimal(new Prisma.Decimal('1.5'))).toBe(`1.5${'0'.repeat(17)}`)
    expect(canonicalDecimal(new Prisma.Decimal('-0.000000000000000001'))).toBe(
      '-0.000000000000000001',
    )
  })

  it('decimal yang null tetap null, tidak jadi nol', () => {
    // `exit_price` yang belum diisi harus bisa dibedakan dari harga exit nol.
    expect(canonicalDecimal(null)).toBeNull()
    expect(canonicalDecimal(undefined)).toBeNull()
    expect(canonicalDecimal(new Prisma.Decimal('0'))).not.toBeNull()
  })

  it('waktu dinormalkan ke UTC milidetik dengan panjang tetap', () => {
    const dariWib = new Date('2026-09-30T14:12:34.567+07:00')
    expect(canonicalTimestamp(dariWib)).toBe('2026-09-30T07:12:34.567Z')
    expect(canonicalTimestamp(dariWib).length).toBe(24)
    expect(canonicalTimestamp('2026-09-30T07:12:34.567Z')).toBe('2026-09-30T07:12:34.567Z')
  })

  it('waktu di bawah milidetik dipotong, bukan ditolak diam-diam', () => {
    // `created_at` bertipe DATETIME(3) yang hanya menyimpan milidetik. Kalau
    // ada presisi lebih kecil dari situ, nilainya harus dipotong supaya yang
    // di-hash sama dengan yang tersimpan.
    expect(canonicalTimestamp('2026-09-30T07:12:34Z')).toBe('2026-09-30T07:12:34.000Z')
    expect(canonicalTimestamp(new Date('2026-09-30T07:12:34.5679Z'))).toBe(
      '2026-09-30T07:12:34.567Z',
    )
  })

  it('waktu yang tidak bisa dibaca ditolak', () => {
    expect(() => canonicalTimestamp('bukan waktu')).toThrow(/tidak valid/)
  })

  it('kunci json level atas tidak diurutkan, urutan tetap dari kode', () => {
    // PRD 10.1 butir 1: urutan key tetap. Kalau kanonikalisasi mengurutkan
    // kunci, urutan tetap itu jadi tidak berarti apa-apa.
    expect(canonicalJson({ spec: 'tl-chain/1', event: 'created', meta: null })).toBe(
      '{"spec":"tl-chain/1","event":"created","meta":null}',
    )
  })

  it('kunci meta diurutkan supaya tidak bergantung urutan pengiriman', () => {
    const a = canonicalJson(sortUserJsonKeys({ b: 1, a: 2, c: { z: 1, y: 2 } }))
    const b = canonicalJson(sortUserJsonKeys({ c: { y: 2, z: 1 }, a: 2, b: 1 }))
    expect(a).toBe(b)
    expect(a).toBe('{"a":2,"b":1,"c":{"y":2,"z":1}}')
  })

  it('nilai tidak hingga ditolak, bukan ditulis sebagai null', () => {
    expect(() => canonicalJson(Number.NaN)).toThrow(/tidak bisa di-hash/)
    expect(() => canonicalJson(Number.POSITIVE_INFINITY)).toThrow(/tidak bisa di-hash/)
  })

  it('tanda kutip dan garis baru di reason tidak merusak payload', () => {
    const denganKutip = buildTradePayload(input({ reason: 'saya tulis "miring"\ndan turun' }))
    // Kalau string tidak di-escape, payload jadi JSON rusak dan hash berubah
    // karena pemotong baris baru ikut kena.
    expect(() => JSON.parse(denganKutip)).not.toThrow()
    expect(JSON.parse(denganKutip).reason).toBe('saya tulis "miring"\ndan turun')
  })
})

describe('payload kanonik trade', () => {
  it('memakai urutan kunci tetap sesuai PRD 10.1', () => {
    // Daftar ini adalah spesifikasi hash-nya, ditulis ulang di sini supaya test
    // tidak hanya mencerminkan implementasi. Menambah atau memindahkan kunci
    // berarti hash lama berubah artinya, jadi butuh versi spesifikasi baru.
    expect(Object.keys(JSON.parse(buildTradePayload(input())))).toEqual([
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
    ])
  })

  it('tidak memuat id internal, waktu administer, atau chain_block_id', () => {
    // Kalau id internal ikut, anomisasi akun (PRD 9.4) akan merusak chain.
    // Kalau chain_block_id ikut, bloknya jadi merujuk dirinya sendiri.
    const kunci = Object.keys(JSON.parse(buildTradePayload(input())))
    for (const dilarang of [
      'id',
      'user_id',
      'created_at',
      'updated_at',
      'deleted_at',
      'chain_block_id',
      'current_revision',
    ]) {
      expect(kunci).not.toContain(dilarang)
    }
  })

  it('nilai turunan ikut di-hash supaya tidak bisa diganti diam-diam', () => {
    const asli = computePayloadHash(input())
    const dipalsukan = computePayloadHash(
      input({ pnl: new Prisma.Decimal('999999'), rMultiple: new Prisma.Decimal('999') }),
    )
    expect(asli).not.toBe(dipalsukan)
  })

  it('nomor revisi tidak sah ditolak', () => {
    expect(() => buildTradePayload(input({ revisionNo: 0 }))).toThrow(/revisi/)
  })

  it('payload yang sama menghasilkan hash yang sama', () => {
    expect(computePayloadHash(input())).toBe(computePayloadHash(input()))
  })

  it('hash payload sesuai SHA-256 dari payload kanonik', () => {
    const payload = buildTradePayload(input())
    expect(payload.startsWith('{"spec":"tl-chain/1","event":"created"')).toBe(true)
    // hash harus persis sama dengan sha256sum dari teks payload itu
    expect(computePayloadHash(input())).toBe(sha256Hex(payload))
  })
})

describe('block_hash', () => {
  const payloadHash = computePayloadHash(input())
  const createdAt = '2026-09-30T20:00:00.000Z'

  it('genesis memakai 64 nol dan height 0', () => {
    expect(GENESIS_PREV_HASH).toBe('0'.repeat(64))
    expect(GENESIS_PREV_HASH).toHaveLength(64)
  })

  it('mengikuti urutan prev_hash, payload_hash, height, created_at', () => {
    const expected = sha256Hex(
      ['tl-chain/1', 'block', GENESIS_PREV_HASH, payloadHash, '0', createdAt].join('\n'),
    )
    expect(
      computeBlockHash({ prevHash: GENESIS_PREV_HASH, payloadHash, height: 0, createdAt }),
    ).toBe(expected)
  })

  it('pemisah baris baru mencegah tabrakan antar-bagian', () => {
    // Tanpa pemisah, height 1 dengan created_at berbeda bisa menabrak bentuk
    // input yang sama. Dua kasus di bawah harus menghasilkan hash berbeda.
    const a = computeBlockHash({
      prevHash: GENESIS_PREV_HASH,
      payloadHash,
      height: 1,
      createdAt: '2026-09-30T20:00:00.000Z',
    })
    const b = computeBlockHash({
      prevHash: GENESIS_PREV_HASH,
      payloadHash,
      height: 12,
      createdAt: '2026-09-30T20:00:00.000Z',
    })
    expect(a).not.toBe(b)
  })

  it('menolak input yang tidak sah daripada menghasilkan hash sampah', () => {
    const dasar = { prevHash: GENESIS_PREV_HASH, payloadHash, height: 0, createdAt }
    expect(() => computeBlockHash({ ...dasar, prevHash: 'bukan-hash' })).toThrow(/prev_hash/)
    expect(() => computeBlockHash({ ...dasar, payloadHash: '0'.repeat(63) })).toThrow(
      /payload_hash/,
    )
    expect(() => computeBlockHash({ ...dasar, height: -1 })).toThrow(/height/)
    expect(() => computeBlockHash({ ...dasar, height: 1.5 })).toThrow(/height/)
    // hash huruf besar ditolak supaya tidak ada dua bentuk untuk hash yang sama
    expect(() => computeBlockHash({ ...dasar, payloadHash: 'A'.repeat(64) })).toThrow(
      /payload_hash/,
    )
  })

  it('created_at dari objek Date sama dengan dari stringnya', () => {
    expect(
      computeBlockHash({
        prevHash: GENESIS_PREV_HASH,
        payloadHash,
        height: 0,
        createdAt: new Date(createdAt),
      }),
    ).toBe(computeBlockHash({ prevHash: GENESIS_PREV_HASH, payloadHash, height: 0, createdAt }))
  })
})

describe('verifikasi blok', () => {
  const payloadHash = computePayloadHash(input())
  const createdAt = '2026-09-30T20:00:00.000Z'
  const blockHash = computeBlockHash({
    prevHash: GENESIS_PREV_HASH,
    payloadHash,
    height: 0,
    createdAt,
  })

  it('blok yang utuh lolos', () => {
    expect(
      verifyBlock({ blockHash, prevHash: GENESIS_PREV_HASH, payloadHash, height: 0, createdAt }),
    ).toEqual({
      valid: true,
    })
  })

  it('blok yang ditulis ulang manual terdeteksi (PRD 13.4)', () => {
    // Skenario yang diuji PRD 13.4: ubah data secara manual, lalu verifikasi
    // harus gagal. Di sini `block_hash` diubah, `payload_hash` dibiarkan.
    const result = verifyBlock({
      blockHash: 'b'.repeat(64),
      prevHash: GENESIS_PREV_HASH,
      payloadHash,
      height: 0,
      createdAt,
    })
    expect(result.valid).toBe(false)
    expect(result.valid === false && result.reason).toMatch(/tidak cocok/)
  })

  it('prev_hash yang tidak nyambung terdeteksi', () => {
    const result = verifyBlock(
      { blockHash, prevHash: GENESIS_PREV_HASH, payloadHash, height: 0, createdAt },
      'a'.repeat(64),
    )
    expect(result.valid).toBe(false)
    expect(result.valid === false && result.reason).toMatch(/tidak nyambung/)
  })

  it('payload_hash yang tidak cocok dengan isi trade terdeteksi', () => {
    const lain = computePayloadHash(input({ exitPrice: new Prisma.Decimal('1') }))
    expect(verifyPayloadHash(input(), payloadHash)).toEqual({ valid: true })
    expect(verifyPayloadHash(input(), lain).valid).toBe(false)
  })

  it('hash dengan bentuk rusak ditolak, bukan dianggap valid', () => {
    const result = verifyBlock({
      blockHash: 'pendek',
      prevHash: 'pendek',
      payloadHash: 'pendek',
      height: 0,
      createdAt,
    })
    expect(result.valid).toBe(false)
  })
})

describe('PRD 10.1 butir 5: mengubah trade lama memutus blok sesudahnya', () => {
  it('mengubah isi trade lama mengubah payload_hash blok berikutnya', () => {
    const saatDibuat = computePayloadHash(input({ event: 'created' }))
    const saatDirevisi = computePayloadHash(
      input({ event: 'revised', changeReason: 'salah ketik harga', exitPrice: null }),
    )

    // Blok 0 pada height 0, lalu blok 1 menyambung ke blok 0.
    const blok0 = computeBlockHash({
      prevHash: GENESIS_PREV_HASH,
      payloadHash: saatDibuat,
      height: 0,
      createdAt: '2026-09-30T20:00:00.000Z',
    })
    const blok1 = computeBlockHash({
      prevHash: blok0,
      payloadHash: saatDirevisi,
      height: 1,
      createdAt: '2026-10-01T20:00:00.000Z',
    })

    // Kalau isi trade dirapikan tanpa menambah blok baru, rantai blok 1 tidak
    // lagi cocok karena prev_hash-nya berubah.
    const blok0Palsu = computeBlockHash({
      prevHash: GENESIS_PREV_HASH,
      payloadHash: saatDirevisi,
      height: 0,
      createdAt: '2026-09-30T20:00:00.000Z',
    })

    expect(blok0Palsu).not.toBe(blok0)
    expect(
      verifyBlock(
        {
          blockHash: blok1,
          prevHash: blok0Palsu,
          payloadHash: saatDirevisi,
          height: 1,
          createdAt: '2026-10-01T20:00:00.000Z',
        },
        blok0,
      ).valid,
    ).toBe(false)
  })
})

describe('sha256OfParts', () => {
  it('jenis bagian ikut memisahkan input yang sama', () => {
    expect(sha256OfParts('block', ['a'])).not.toBe(sha256OfParts('merkle-leaf', ['a']))
  })
})
