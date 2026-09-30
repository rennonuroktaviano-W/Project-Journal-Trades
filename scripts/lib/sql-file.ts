/**
 * Pemecah file SQL yang sadar perintah `DELIMITER`.
 *
 * mysql CLI bisa membaca `DELIMITER`, tapi protokol database yang dipakai
 * driver (`mariadb`) tidak mengenal perintah itu. Pemecah ini meniru
 * perilaku mysql CLI supaya file yang sama bisa dijalankan lewat keduanya.
 *
 * Yang ditangani:
 *   - `DELIMITER $$` mengganti pemisah, dan `;` di dalam blok itu berhenti
 *     memisahkan statement.
 *   - Literal `'...'`, `"..."`, dan `` `...` ``, termasuk yang memuat tanda
 *     kutip ganda di dalamnya.
 *   - Komentar `-- ...` sampai akhir baris dan `/* ... *\/` multiline.
 */

export type SqlStatement = string

type State = 'normal' | 'single' | 'double' | 'backtick' | 'line-comment' | 'block-comment'

/**
 * Memecah isi file SQL menjadi statement yang siap dieksekusi satu per satu.
 *
 * Statement dikembalikan tanpa tanda pemisah di ujung, dan statement yang
 * isinya hanya komentar tidak ikut dikembalikan.
 */
export function splitSqlStatements(source: string): SqlStatement[] {
  const statements: SqlStatement[] = []

  let delimiter = ';'
  let buffer = ''
  let state: State = 'normal'
  let atLineStart = true

  /** Memakai indeks satu per satu supaya pola berulang tidak menghitung ulang. */
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i] as string
    const next = source[i + 1]

    if (state === 'normal' && atLineStart) {
      // Perintah DELIMITER hanya dibaca di awal baris. Baris saat ini diambil
      // penuh supaya pola tidak ikut mencocokkan isi baris berikutnya.
      const akhirBaris = source.indexOf('\n', i)
      const baris = akhirBaris === -1 ? source.slice(i) : source.slice(i, akhirBaris)
      const directive = /^\s*delimiter\s+(\S+)\s*(?:--.*)?$/i.exec(baris)

      if (directive?.[1]) {
        delimiter = directive[1]
        i += baris.length - 1
        atLineStart = false
        continue
      }
    }

    if (state === 'normal') {
      // Pemisah dicek sebelum karakter dimasukkan ke buffer, supaya tanda
      // pisahnya sendiri tidak ikut tersimpan.
      if (source.startsWith(delimiter, i)) {
        statements.push(buffer.trim())
        buffer = ''
        i += delimiter.length - 1
        atLineStart = false
        continue
      }

      if (char === '-' && next === '-') {
        state = 'line-comment'
        buffer += char
        atLineStart = false
        continue
      }

      if (char === '/' && next === '*') {
        state = 'block-comment'
        buffer += char
        atLineStart = false
        continue
      }

      if (char === "'") {
        state = 'single'
      } else if (char === '"') {
        state = 'double'
      } else if (char === '`') {
        state = 'backtick'
      }

      buffer += char
      atLineStart = char === '\n'
      continue
    }

    if (state === 'line-comment') {
      buffer += char
      if (char === '\n') {
        state = 'normal'
        atLineStart = true
      }
      continue
    }

    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        buffer += char + next
        i += 1
        state = 'normal'
        continue
      }
      buffer += char
      atLineStart = char === '\n'
      continue
    }

    // Di dalam literal: backslash meloloskan karakter berikutnya.
    if (char === '\\') {
      buffer += char + (next ?? '')
      i += 1
      continue
    }

    const penutup = state === 'single' ? "'" : state === 'double' ? '"' : '`'

    if (char === penutup) {
      // Dua tanda kutip berturut-turut berarti tanda kutip yang ter-escape,
      // bukan penutup literal.
      if (next === penutup) {
        buffer += char + next
        i += 1
        continue
      }
      state = 'normal'
    }

    buffer += char
    atLineStart = char === '\n'
  }

  const sisa = buffer.trim()
  if (sisa !== '' && adaSql(sisa)) {
    statements.push(sisa)
  }

  return statements.filter((statement) => adaSql(statement))
}

/** Buang statement yang isinya cuma komentar. */
function adaSql(statement: string): boolean {
  return statement
    .split('\n')
    .map((line) => line.trim())
    .some(
      (line) =>
        line !== '' && !line.startsWith('--') && !line.startsWith('/*') && !line.startsWith('*'),
    )
}
