# TODO — TradeLedger

Sumber tunggal progres project. Setiap item selesai di-commit + push ke GitHub.

PRD: `docs/PRD TradeLedger - Jurnal Trading Publik Transparan.docx`

## Status

| Blok | Isi                                                 | Status |
| ---- | --------------------------------------------------- | ------ |
| 0    | Git init, remote, commit pertama, push              | DONE   |
| 1a   | MySQL Laragon + database `tradeledger`              | DONE   |
| 1b   | Scaffold Next.js 16 + TS strict + Tailwind + ESLint | DONE   |
| 1c   | Design token, font, layout responsif                | DONE   |
| 1d   | CI GitHub Actions                                   | TODO   |
| 1e   | TODO.md                                             | DONE   |
| 2    | Prisma schema 27 tabel + trigger append-only        | DONE   |
| 3    | Hash chain engine + Merkle root                     | TODO   |
| 4    | Auth (register, verifikasi email, rate limit, 2FA)  | TODO   |
| 5    | Jurnal trade JRN-01..08                             | TODO   |
| 6    | Analitik performa                                   | TODO   |
| 7    | Halaman publik + verifikasi hash                    | TODO   |
| 8    | Chart candlestick                                   | TODO   |
| 9    | Admin & moderasi                                    | TODO   |
| 10   | Test (unit, feature, integritas, keamanan)          | TODO   |
| 11   | Hardening + dokumen legal                           | TODO   |

## Deviasi dari PRD

PRD bagian 6 menyebut Laravel 11. Keputusan proyek: memakai **Next.js 16** (App Router,
TypeScript strict) dengan pemetaan berikut.

| PRD (Laravel)           | Implementasi Next.js                                          |
| ----------------------- | ------------------------------------------------------------- |
| Blade + Alpine.js       | React Server Components + Tailwind                            |
| Eloquent + Policy       | Prisma ORM + DAL guard + middleware RBAC                      |
| CSRF bawaan framework   | Token CSRF manual + cookie `SameSite=Lax`                     |
| Argon2id bawaan         | `@node-rs/argon2`, fallback `bcryptjs`                        |
| Laravel Queue + Redis   | Tabel `jobs` di MySQL + runner CLI, Redis menyusul            |
| Pint + Larastan         | ESLint + Prettier + `tsc --noEmit`                            |
| `SELECT ... FOR UPDATE` | `prisma.$queryRaw` di dalam `$transaction`                    |
| Nginx + PHP-FPM         | Nginx + Node.js (PM2)                                         |
| HTMLPurifier            | `sanitize-html` whitelist ketat                               |
| Koneksi PDO `mysql`     | Driver adapter `mariadb` (Prisma 7 tidak punya adapter MySQL) |

### Jumlah tabel

PRD bagian 7 menulis 23 tabel, skema yang dibuat berisi 27. Empat tambahan muncul karena
PRD menyiratkan kebutuhan yang tidak punya tabel sendiri di daftar awal:

| Tabel tambahan             | Alasan                                                  |
| -------------------------- | ------------------------------------------------------- |
| `password_history`         | PRD 9.2: password lama tidak boleh dipakai ulang        |
| `password_reset_tokens`    | AUTH-04: token reset harus bisa kedaluwarsa dan dicabut |
| `user_two_factor_recovery` | PRD 9.1: kode pemulihan 2FA                             |
| `login_attempts`           | AUTH-03: rate limit dan lockout butuh riwayat percobaan |

Tabel `jobs` dan `job_runs` tidak dihitung sebagai penambahan karena PRD bagian 6 sudah
menyebut antrean di tabel database. Kalau suatu saat daftar tabel di PRD diperketat lagi,
keempat tabel di atas adalah kandidat pertama untuk digabung ke tabel induknya.

## Environment lokal

- PHP 8.3, Composer 2.9, Node 22.22, npm 10.9, Git 2.55
- MySQL 8.4 (Laragon) — database `tradeledger`, charset utf8mb4 / utf8mb4_0900_ai_ci
- Database `tradeledger_shadow` untuk deteksi drift saat `prisma migrate dev`
- Tiga akun MySQL dengan hak minimum (PRD 7.3), kredensial di `.env.local`:
  - `tradeledger_app` — allow-list per tabel: `SELECT`+`INSERT` pada
    `chain_blocks`, `trade_revisions`, `audit_logs`, `merkle_anchors`;
    `SELECT`+`INSERT`+`UPDATE`+`DELETE` pada 23 tabel lainnya
  - `tradeledger_migrate` — DDL penuh pada `tradeledger` dan `tradeledger_shadow`,
    hanya untuk `prisma migrate`
  - `_prisma_migrations` tidak diberi hak apa pun ke akun aplikasi
- Redis belum ada — queue pakai tabel `jobs`

## Setup dari nol

```bash
# 1. Start MySQL Laragon, lalu bootstrap database dan ketiga akun
mysql -u root -p < database/01-bootstrap.sql

# 2. Salin konfigurasi dan isi kredensial
cp .env.example .env.local

# 3. Buat skema
npm run db:migrate

# 4. Pasang allow-list hak dan trigger append-only
#    WAJIB diulang setiap kali migrasi menambah tabel baru.
#    WAJIB juga diulang setelah `npm run db:reset`.
mysql -u root -p < database/02-append-only-guard.sql

# 5. Isi data referensi
npm run db:seed
```

## Checklist Jawaban PRD 14.3

- [x] Semua trade wajib publik? → Publik default, ada opsi commit-private (PRD §4.2 JRN-06)
- [x] Monetisasi? → Tidak di versi 1, desain tidak menutup jalan
- [x] Penyedia data harga? → Iterasi 1: Binance/Bybit public API (crypto), forex ditunda
- [x] Login via wallet? → Tidak di versi 1 (P2)
- [x] Bahasa awal? → Indonesia dulu, struktur siap i18n
- [ ] Hosting & anggaran bulanan → belum ditentukan

## Catatan Keamanan

Tidak ada fitur untuk mengubah hash chain. Admin tidak punya akses tulis ke tabel append-only.
Tabel `trade_revisions`, `chain_blocks`, `audit_logs`, `merkle_anchors` dilindungi dua lapis:

1. Allow-list hak MySQL. `UPDATE` dan `DELETE` tidak pernah diberikan ke `tradeledger_app`
   pada keempat tabel itu. Pendekatan allow-list wajib dipakai karena MySQL tidak bisa
   mengurangi hak yang diberikan di level `database`.* — begitu `GRANT ... ON tradeledger.*`
   ada, `REVOKE` per tabel tidak berefek.
2. Trigger `BEFORE UPDATE/DELETE` yang melempar error. Lapis ini juga menahan akun lain
   yang punya hak penuh, selama trigger tidak di-drop.

Keduanya sudah diuji: `UPDATE` dari akun aplikasi ditolak `ERROR 1142`, dan `UPDATE` dari
akun migrasi ditolak `ERROR 1644` oleh trigger.
