import { describe, expect, it } from 'vitest'

import { splitSqlStatements } from '../../scripts/lib/sql-file'

describe('pemecah file SQL', () => {
  it('memisahkan statement sederhana', () => {
    expect(splitSqlStatements('SELECT 1; SELECT 2;')).toEqual(['SELECT 1', 'SELECT 2'])
  })

  it('membuang statement yang hanya berisi komentar', () => {
    const source = ['-- komentar pembuka', 'SELECT 1;', '-- penutup', ''].join('\n')
    expect(splitSqlStatements(source)).toEqual(['-- komentar pembuka\nSELECT 1'])
  })

  it('menahan pemisah di dalam literal', () => {
    const source = "INSERT INTO t VALUES ('a;b'); SELECT 2;"
    expect(splitSqlStatements(source)).toEqual(["INSERT INTO t VALUES ('a;b')", 'SELECT 2'])
  })

  it('menahan pemisah di dalam nama kolom backtick', () => {
    const source = 'SELECT `a;b` FROM t; SELECT 2;'
    expect(splitSqlStatements(source)).toEqual(['SELECT `a;b` FROM t', 'SELECT 2'])
  })

  it('menghormati tanda kutip yang ter-escape', () => {
    // Literal yang berisi tanda kutip ditulis dengan kutip ganda di dalamnya.
    const source = "INSERT INTO u (n) VALUES ('a''b''c'); SELECT 2;"
    expect(splitSqlStatements(source)).toEqual(["INSERT INTO u (n) VALUES ('a''b''c')", 'SELECT 2'])
  })

  it('tidak memotong file yang literal-nya memang belum tertutup', () => {
    // Pemecah tidak menebak: input rusak tetap dikembalikan utuh
    // supaya error asli dari MySQL yang muncul, bukan hasil pemotongan diam-diam.
    const source = "SELECT 'belum tertutup; SELECT 2;"
    expect(splitSqlStatements(source)).toEqual(["SELECT 'belum tertutup; SELECT 2;"])
  })

  it('menghormati backslash di dalam literal', () => {
    const source = "SELECT 'a\\';b'; SELECT 2;"
    expect(splitSqlStatements(source)).toEqual(["SELECT 'a\\';b'", 'SELECT 2'])
  })

  it('DELIMITER mengganti pemisah dan tahan titik koma di dalam blok', () => {
    const source = [
      'DROP PROCEDURE IF EXISTS p;',
      'DELIMITER $$',
      'CREATE PROCEDURE p()',
      'BEGIN',
      "  SET @x := 'a;b';",
      '  SELECT 1;',
      'END$$',
      'DELIMITER ;',
      'CALL p();',
    ].join('\n')

    expect(splitSqlStatements(source)).toEqual([
      'DROP PROCEDURE IF EXISTS p',
      "CREATE PROCEDURE p()\nBEGIN\n  SET @x := 'a;b';\n  SELECT 1;\nEND",
      'CALL p()',
    ])
  })

  it('menahan pemisah di dalam komentar multiline', () => {
    const source = ['/* satu; dua; */', 'SELECT 1;', 'SELECT 2;'].join('\n')
    expect(splitSqlStatements(source)).toHaveLength(2)
  })

  it('menahan statement terakhir tanpa pemisah', () => {
    expect(splitSqlStatements('SELECT 1')).toEqual(['SELECT 1'])
  })

  it('menghasilkan nol statement untuk file kosong', () => {
    expect(splitSqlStatements('')).toEqual([])
    expect(splitSqlStatements('\n\n-- cuma komentar\n')).toEqual([])
  })

  it('memecah kedua file SQL database menjadi statement yang dapat dieksekusi', async () => {
    const { readFile } = await import('node:fs/promises')

    for (const file of ['01-bootstrap.sql', '02-append-only-guard.sql']) {
      const source = await readFile(`database/${file}`, 'utf8')
      const statements = splitSqlStatements(source)

      expect(statements.length, `${file} tidak menghasilkan statement`).toBeGreaterThan(0)

      for (const statement of statements) {
        expect(statement, `${file} punya statement tak ber terminated`).not.toContain('DELIMITER')
        expect(
          /;\s*$/.test(statement),
          `${file} punya statement yang masih diakhiri titik koma: ${statement.slice(-40)}`,
        ).toBe(false)
      }
    }
  })
})
