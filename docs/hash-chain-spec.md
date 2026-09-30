# Spesifikasi hash chain TradeLedger

Versi spesifikasi: **`tl-chain/1`**

Dokumen ini supaya hash yang tersimpan di `chain_blocks` bisa dihitung ulang oleh
siapa pun tanpa membaca kode server (PRD 10.2, SOC-04: "cek hash entry atau
seluruh chain trader secara independen"). Semua hash adalah SHA-256, heksadesimal
huruf kecil, 64 karakter.

PRD 10.1 butir 1 sampai 3 menetapkan aturannya, tapi tidak
menyebutkan pemisah antar-bagian, format waktu, urutan kunci, maupun aturan
desimal. Bagian yang tidak disebut itu ditetapkan di sini, dan catatan tentang
mana yang punya PRD disebutkan.

---

## 1. Ringkas

| Langkah | Rumus |
| --- | --- |
| Payload | JSON kanonik trade, urutan kunci tetap (bagian 3) |
| `payload_hash` | `SHA-256(payload)` |
| `block_hash` | `SHA-256("tl-chain/1\nblock\n" + prev_hash + "\n" + payload_hash + "\n" + height + "\n" + created_at)` |

Rantai bersifat **per pengguna**. `prev_hash` selalu milik blok sebelumnya milik
user yang sama (PRD 10.1 butir 3). Blok pertama punya `height = 0` dan
`prev_hash` = 64 nol (PRD 7.2).

---

## 2. Format bagian

### 2.1 Hash

- Panjang tetap 64 karakter.
- Heksadesimal **huruf kecil**, `0-9a-f`. Hash huruf besar ditolak, supaya
  tidak ada dua bentuk teks untuk hash yang sama.
- `prev_hash` dan `payload_hash` masuk sebagai teks heksa 64 karakter, bukan
  sebagai 32 byte biner.

### 2.2 `height`

- Integer desimal tanpa tanda, tanpa nol di depan: `0`, `1`, `17`.
- Dimulai dari 0 per pengguna (PRD 7.2).

### 2.3 `created_at`

- UTC, presisi milidetik, format persis `YYYY-MM-DDTHH:MM:SS.sssZ`.
- Panjang selalu 24 karakter, jadi lebarnya tidak pernah berubah.
- Precision lebih kecil dari milidetik dipotong, bukan ditolak. Kolomnya
  `DATETIME(3)` yang hanya menyimpan milidetik, jadi pemotongan justru
  diperlukan agar yang di-hash sama dengan yang tersimpan.
- `appendToHashChain` membandingkan nilai yang di-hash dengan nilai yang
  kembali dari database dan menolak menulis kalau berbeda.

### 2.4 Pemisah

PRD 10.1 butir 3 menulis `prev_hash + payload_hash + height + created_at`
tanpa menyebut pemisahnya. Dipakai **baris baru** (`\n`, satu byte `0x0A`).

Baris baru aman karena tidak mungkin muncul di hash heksadesimal maupun di
stempel waktu ISO, jadi dua susunan bagian yang berbeda tidak akan pernah
menghasilkan input hash yang sama.

---

## 3. Payload kanonik

Payload adalah JSON tanpa spasi, urutan kunci **tetap** seperti tabel di bawah,
dan seluruh string di-escape sebagai JSON.

Kunci **tidak** diurutkan alfabetis. "Urutan key tetap" PRD 10.1 butir 1 hanya
bermakna kalau urutannya dijaga; mengurutkannya akan membatalkan maksudnya.
Satu-satunya bagian yang diurutkan adalah kunci di dalam `meta` (bagian 3.4).

| # | Kunci | Tipe | Sumber |
| --- | --- | --- | --- |
| 1 | `spec` | string | `"tl-chain/1"` |
| 2 | `event` | string | `created` \| `revised` \| `closed` |
| 3 | `trade_ulid` | string | `trades.ulid` |
| 4 | `revision_no` | integer | `1` untuk `created` |
| 5 | `market` | string | enum `trades.market` |
| 6 | `side` | string | enum `trades.side` |
| 7 | `status` | string | enum `trades.status` |
| 8 | `visibility` | string | enum `trades.visibility` |
| 9 | `origin` | string | enum `trades.origin` |
| 10 | `emotion` | string \| null | enum `trades.emotion` |
| 11 | `instrument_symbol` | string | `instruments.symbol` |
| 12 | `strategy_name` | string \| null | `strategies.name` |
| 13 | `entry_price` | string \| null | desimal, 18 digit |
| 14 | `stop_loss` | string \| null | desimal, 18 digit |
| 15 | `take_profit` | string \| null | desimal, 18 digit |
| 16 | `exit_price` | string \| null | desimal, 18 digit |
| 17 | `position_size` | string \| null | desimal, 18 digit |
| 18 | `leverage` | string | desimal, 18 digit |
| 19 | `fees` | string | desimal, 18 digit |
| 20 | `risk_amount` | string \| null | desimal, 18 digit |
| 21 | `pnl` | string \| null | desimal, 18 digit |
| 22 | `r_multiple` | string \| null | desimal, 18 digit |
| 23 | `opened_at` | string | `trades.opened_at` |
| 24 | `closed_at` | string \| null | `trades.closed_at` |
| 25 | `meta` | object \| null | `trades.meta` |
| 26 | `reason` | string \| null | `trades.reason` |
| 27 | `review` | string \| null | `trades.review` |
| 28 | `change_reason` | string \| null | wajib untuk `revised` (PRD Flow C) |

### 3.1 Yang sengaja tidak ikut

| Kolom | Alasan |
| --- | --- |
| `trades.id`, `chain_blocks.user_id` | BIGINT AUTO_INCREMENT. Memakai ULID membuat payload tahan anomisasi akun (PRD 9.4) dan mencegah Someone menebak urutan pembuatan akun. `user` sudah tersirat dari chain yang per user. |
| `trades.created_at`, `updated_at`, `deleted_at` | Waktu administer, bukan isi trade. |
| `trades.chain_block_id` | Menunjuk balik ke blok yang sedang dibuat, jadi tidak mungkin ikut dihitung tanpa lingkaran. |
| `trades.current_revision` | Nilainya sama dengan `revision_no` yang sudah ada. |

### 3.2 Angka desimal

Semua kolom `DECIMAL` jadi **string** dengan tepat 18 digit di belakang titik,
apa pun skalanya di database:

```
65000.5      -> "65000.500000000000000000"
1            -> "1.000000000000000000"
0.015        -> "0.015000000000000000"
-0.000000000000000001 -> "-0.000000000000000001"
```

Alasannya: `DECIMAL(36,18)` jauh di luar presisi `number` JavaScript, jadi
mengubahnya jadi angka float akan menghilangkan digit dan membuat hash berbeda
untuk nilai yang identik.

`null` tetap `null`, bukan `"0"` atau `""`, supaya `exit_price` yang belum diisi
bisa dibedakan dari harga exit nol.

### 3.3 Teks

String di-escape sebagai string JSON: `"` menjadi `\"`, `\` menjadi `\\`,
baris baru menjadi `\n`, dan seterusnya. Penghitung ulang payload
harus melakukan escaping yang sama persis.

### 3.4 `meta`

`meta` berasal dari user dan bentuknya bebas (PRD 4.2 JRN-03: pip/lot, exchange,
chain/contract/DEX). Karena itu:

- Kunci di dalam `meta` diurutkan **secara rekursif** sebelum di-hash, supaya
  hasilnya tidak bergantung pada urutan property yang dikirim.
- Nilai non-primitif yang tidak mungkin (misalnya `NaN`) ditolak, bukan ditulis
  diam-diam sebagai `null`.
- Key numerik di dalam `meta` suffers keterbatasan presisi `number` JavaScript.
  Untuk nilai yang butuh presisi penuh, tulis sebagai string.

### 3.5 `spec` di dalam payload

`spec` ikut di-hash supaya versi spesifikasi terikat secara kriptografis, bukan
hanya lewat dokumentasi. PRD 7.2 tidak menyediakan kolom versi pada
`chain_blocks`, jadi pengikatan lewat isi payload adalah pilihannya.

Mengubah aturan kanonikalisasi di masa depan berarti menaikkan versi ini.
Menyisipkan atau memindahkan kunci pada versi yang sama akan membuat hash lama
berubah artinya tanpa ada pemberitahuan, jadi itu dilarang.

---

## 4. Blok

```
block_hash = SHA-256(
  "tl-chain/1" + "\n" +
  "block" + "\n" +
  prev_hash + "\n" +
  payload_hash + "\n" +
  height + "\n" +
  created_at
)
```

Semua input divalidasi sebelum di-hash. Karena `chain_blocks` tidak menyimpan
versi, hash yang salah tidak akan pernah ketahuan setelah tersimpan; lebih baik
gagal saat menulis daripada menyimpan blok yang tidak bisa diverifikasi siapa pun.

### 4.1 Genesis

`height = 0`, `prev_hash` = 64 nol (`"0000...0"`). Ini satu-satunya penyebutan
genesis di PRD (7.2).

### 4.2 Tiga event pembentuk blok

PRD 10.1 butir 1 menyebut tiga event. Tidak ada blok untuk hal lain seperti
upload media, komentar, atau follow.

| `event` | Kapan | `revision_no` | `revision_id` |
| --- | --- | --- | --- |
| `created` | Trade dibuat | `1` | `null` |
| `revised` | Trade diedit (PRD JRN-07, Flow C) | `trades.current_revision` | baris `trade_revisions` baru |
| `closed` | Trade ditutup | `trades.current_revision` | `null` |

PRD tidak menyatakan nomor revisi untuk `created` dan `closed`; tabel di atas
adalah keputusan proyek, dan `trade_revisions` tidak wajib ada untuk kedua event
itu.

`change_reason` wajib diisi untuk `revised` dan ditolak kosong oleh service.

### 4.3 Trade yang sudah dibatalkan

`status = cancelled` tidak boleh menambah blok baru. PRD tidak membuka jalur
revisi untuk trade yang dibatalkan, dan blok yang sudah terlanjur tersimpan tidak
boleh dirapikan diam-diam.

---

## 5. Akar Merkle harian

PRD 7.2 menulis `merkle_root` sebagai "gabungan hash blok terakhir semua user"
dan PRD 10.2 menyebutnya "satu hash ringkasan seluruh chain semua user per
hari". Algoritma pohonnya tidak disebutkan sama sekali, jadi ditetapkan di sini.

### 5.1 Daun

Satu daun per pengguna yang punya blok sampai akhir hari anchor. Daunnya memuat
`user_id`, `height`, dan `block_hash` blok terakhir pengguna itu.

```
daun(user_id, height, block_hash) = SHA-256("tl-chain/1\nmerkle-leaf\n" + user_id + "\n" + height + "\n" + block_hash)
```

`user_id` dan `height` ikut di-hash supaya daun tidak bisa dipindah antar
pengguna atau height-nya dipalsukan. Tanpa itu, anchor tidak membuktikan apa pun
tentang *siapa* yang punya blok tersebut.

- `user_id` ditulis sebagai angka desimal, diurutkan **numerik** (`9` sebelum
  `10`, bukan `"10"` sebelum `"9"`).
- `user_id` yang sama dua kali ditolak, karena blok terakhir pengguna itu
  ambigu.

### 5.2 Pohon

- Biner. Simpul internal adalah SHA-256 dari 32 byte kiri diikuti 32 byte kanan,
  dihitung atas **byte biner**, bukan atas teks heksa:

  ```
  node(kiri, kanan) = SHA-256(bytes32(kiri) || bytes32(kanan))
  ```

- Daun ganjil: daun terakhir **diulang**, lalu dipairingkan seperti daun biasa.
  Level `[A, B, C]` menjadi `[A, B, C, C]`, lalu `root = node(node(A,B), node(C,C))`.
- Tanpa daun: `merkle_root = SHA-256("tl-chain/1\nmerkle-empty\n")` =
  `f15a4c72e1a6ee7dfdb009d04ed0ad29c00e323f6b77b28bd426a015bee76d31`.
  Anchor tanpa blok tidak ditulis sama sekali karena tidak memuat bukti.

### 5.3 Batas hari

Semua waktu disimpan UTC (PRD 7), jadi satu hari anchor adalah
`[00:00:00.000Z, 24:00:00.000Z)` untuk `anchor_date` berikutnya. Batas atas
eksklusif supaya blok tepat pada tengah malam tidak ambigu.

---

## 6. Contoh yang bisa dihitung ulang

### 6.1 Payload

Trade BTCUSDT long baru dibuka, tanpa strategi, `exit_price` masih kosong.

```
{"spec":"tl-chain/1","event":"created","trade_ulid":"01JQ8W7X9Z4K2M6N8P0Q3R5T7V","revision_no":1,"market":"crypto","side":"long","status":"open","visibility":"public","origin":"manual","emotion":null,"instrument_symbol":"BTCUSDT","strategy_name":null,"entry_price":"65000.500000000000000000","stop_loss":"63000.000000000000000000","take_profit":"70000.000000000000000000","exit_price":null,"position_size":"0.015000000000000000","leverage":"1.000000000000000000","fees":"0.000000000000000000","risk_amount":"307.500000000000000000","pnl":null,"r_multiple":null,"opened_at":"2026-09-30T07:12:34.567Z","closed_at":null,"meta":{"exchange":"binance"},"reason":"Breakout daily","review":null,"change_reason":null}
```

```
payload_hash = 503814a4217076fcddc16dc97f5a2823f9ebceefb8d5e14d7a10a22d226000df
```

### 6.2 Blok genesis

`prev_hash` 64 nol, `height` 0, `created_at` `2026-09-30T07:13:00.000Z`:

```
block_hash = b91c51c141b6600488e302d2258b291df8911068e7bf6c11bb86b21d058114eb
```

### 6.3 Akar Merkle dua pengguna

User `1` blok terakhir `height` 0 `block_hash` `aaaa...aa`, user `2` blok
terakhir `height` 4 `block_hash` `bbbb...bb`:

```
merkle_root = 20735dadd49332f57fa6ed34795a2c729fc737210aaf2c6bd42504e744770d01
```

Nilai-nilai ini dikunci oleh `tests/unit/hash-chain.test.ts` dan
`tests/unit/merkle.test.ts`, yang menghitung ulang hash-nya sendiri di luar
modul yang diuji.

---

## 7. Yang tidak dibuktikan

PRD 10.4 sendiri yang memperingatkan ini, UI wajib jujur soal
kelima hal ini:

1. Hash chain membuktikan data **tidak diubah setelah dicatat**, bukan bahwa
   trade-nya benar terjadi di exchange.
2. Trade yang dicatat manual boleh diberi label berbeda dari trade yang
   diverifikasi dari exchange.
3. `verifikasi` yang gagal berarti ada yang berubah. Tidak berarti siapa yang
   berubah, atau apakah perubahan itu disengaja.
4. Akun yang punya akses tulis ke `chain_blocks` secara teknis bisa menulis
   blok palsu dengan hash yang saling cocok. Yang mencegah ini adalah hak MySQL
   dan trigger, bukan hash. Hash adalah bukti untuk pihak luar yang tidak punya
   akses database.
5. Anchor harian adalah bukti waktu, bukan bukti kebenaran isi.
