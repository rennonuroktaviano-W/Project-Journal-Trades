# TODO — TradeLedger

Sumber tunggal progres project. Setiap item selesai di-commit + push ke GitHub.

PRD: `docs/PRD TradeLedger - Jurnal Trading Publik Transparan.docx`

## Status

| Blok | Isi | Status |
| --- | --- | --- |
| 0 | Git init, remote, commit pertama, push | DONE |
| 1a | MySQL Laragon + database `tradeledger` | TODO |
| 1b | Scaffold Next.js 15 + TS strict + Tailwind + ESLint | TODO |
| 1c | Design token, font, layout responsif | TODO |
| 1d | CI GitHub Actions | TODO |
| 1e | TODO.md | DONE |
| 2 | Prisma schema 23 tabel + trigger append-only | TODO |
| 3 | Hash chain engine + Merkle root | TODO |
| 4 | Auth (register, verifikasi email, rate limit, 2FA) | TODO |
| 5 | Jurnal trade JRN-01..08 | TODO |
| 6 | Analitik performa | TODO |
| 7 | Halaman publik + verifikasi hash | TODO |
| 8 | Chart candlestick | TODO |
| 9 | Admin & moderasi | TODO |
| 10 | Test (unit, feature, integritas, keamanan) | TODO |
| 11 | Hardening + dokumen legal | TODO |

## Deviasi dari PRD

PRD bagian 6 menyebut Laravel 11. Keputusan proyek: memakai **Next.js 15** (App Router,
TypeScript strict) dengan pemetaan berikut.

| PRD (Laravel) | Implementasi Next.js |
| --- | --- |
| Blade + Alpine.js | React Server Components + Tailwind |
| Eloquent + Policy | Prisma ORM + DAL guard + middleware RBAC |
| CSRF bawaan framework | Token CSRF manual + cookie `SameSite=Lax` |
| Argon2id bawaan | `@node-rs/argon2`, fallback `bcryptjs` |
| Laravel Queue + Redis | Tabel `jobs` di MySQL + runner CLI, Redis menyusul |
| Pint + Larastan | ESLint + Prettier + `tsc --noEmit` |
| `SELECT ... FOR UPDATE` | `prisma.$queryRaw` di dalam `$transaction` |
| Nginx + PHP-FPM | Nginx + Node.js (PM2) |
| HTMLPurifier | `sanitize-html` whitelist ketat |

## Environment lokal

- PHP 8.3, Composer 2.9, Node 22.22, npm 10.9, Git 2.55
- MySQL 8.4 (Laragon) — belum dijalankan, start manual lewat Laragon
- Redis belum ada — queue pakai tabel `jobs`

## Checklist Jawaban PRD 14.3

- [x] Semua trade wajib publik? → Publik default, ada opsi commit-private (PRD §4.2 JRN-06)
- [x] Monetisasi? → Tidak di versi 1, desain tidak menutup jalan
- [x] Penyedia data harga? → Iterasi 1: Binance/Bybit public API (crypto), forex ditunda
- [x] Login via wallet? → Tidak di versi 1 (P2)
- [x] Bahasa awal? → Indonesia dulu, struktur siap i18n
- [ ] Hosting & anggaran bulanan → belum ditentukan

## Catatan Keamanan

Tidak ada fitur untuk mengubah hash chain. Admin tidak punya akses tulis ke tabel append-only.
Tabel `trade_revisions`, `chain_blocks`, `audit_logs`, `merkle_anchors` dilindungi trigger
`BEFORE UPDATE/DELETE` yang melempar error, plus akun MySQL aplikasi hanya punya `INSERT`/`SELECT`.