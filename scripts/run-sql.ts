/**
 * Menjalankan file SQL dari folder `database/`.
 *
 * File SQL-nya sengaja ditulis sebagai SQL murni supaya tetap bisa dijalankan
 * lewat `mysql` CLI. Runner ini dipakai supaya kredensial tidak pernah
 * ditulis ke dalam file: password dibaca dari environment lalu disisipkan saat
 * file dibaca, dan teks hasilnya hanya hidup di memori.
 *
 * Pemakaian:
 *   npm run db:bootstrap
 *   npm run db:guard
 */

import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { config } from 'dotenv'
import mariadb from 'mariadb'

import { splitSqlStatements } from './lib/sql-file'

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file)

  if (existsSync(path)) {
    config({ path, override: false })
    break
  }
}

type Kredensial = {
  host: string
  port: number
  user: string
  password: string
  appPassword: string
  migratePassword: string
}

function readCredentials(): Kredensial {
  const appUrl = process.env.DATABASE_URL
  const migrateUrl = process.env.DATABASE_MIGRATE_URL ?? appUrl
  const rootUrl = process.env.MYSQL_ROOT_URL

  if (!appUrl || !migrateUrl || !rootUrl) {
    throw new Error(
      'DATABASE_URL, DATABASE_MIGRATE_URL, dan MYSQL_ROOT_URL wajib diisi pada .env.local.',
    )
  }

  const app = new URL(appUrl)
  const migrate = new URL(migrateUrl)
  const root = new URL(rootUrl)
  const decode = (value: string) => decodeURIComponent(value)

  return {
    host: app.hostname,
    port: app.port ? Number(app.port) : 3306,
    user: decode(root.username),
    password: decode(root.password),
    appPassword: decode(app.password),
    migratePassword: decode(migrate.password),
  }
}

async function main() {
  const target = process.argv[2]

  if (!target) {
    throw new Error('Pemakaian: tsx scripts/run-sql.ts <file-sql>')
  }

  const credentials = readCredentials()
  const raw = await readFile(resolve(process.cwd(), target), 'utf8')

  // Kutip tunggal di-escape dua kali supaya aman disisipkan ke literal SQL.
  const escapeSql = (value: string) => value.replaceAll("'", "''")

  const sql = raw
    .replaceAll('GANTI_DENGAN_PASSWORD_APP', escapeSql(credentials.appPassword))
    .replaceAll('GANTI_DENGAN_PASSWORD_MIGRATE', escapeSql(credentials.migratePassword))

  if (sql.includes('GANTI_DENGAN_')) {
    throw new Error(
      `Masih ada placeholder GANTI_DENGAN_ di ${target}. Password mungkin belum terbaca dari environment.`,
    )
  }

  const statements = splitSqlStatements(sql)
  const connection = await mariadb.createConnection({
    host: credentials.host,
    port: credentials.port,
    user: credentials.user,
    password: credentials.password,
    connectTimeout: 15_000,
    allowPublicKeyRetrieval: process.env.DATABASE_SSL !== 'true',
  })

  try {
    for (const statement of statements) {
      await connection.query(statement)
    }
  } finally {
    await connection.end()
  }

  console.log(`${target} selesai: ${statements.length} statement dijalankan.`)
}

main().catch((error) => {
  console.error('Gagal menjalankan SQL:', error instanceof Error ? error.message : error)
  process.exit(1)
})
