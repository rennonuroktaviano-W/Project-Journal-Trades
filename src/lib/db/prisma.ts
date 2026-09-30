import 'server-only'

import { PrismaClient } from '@/generated/prisma/client'
import { db } from '@/lib/env'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'
import type { PoolConfig } from 'mariadb'

/**
 * Prisma 7 memakai driver adapter, jadi koneksi harus disuruh secara eksplisit.
 * `mysql2` tidak lagi dipakai di runtime; driver `mariadb` berbicara protokol yang
 * sama dengan MySQL 8.x sehingga tidak butuh server MariaDB terpisah.
 */
function poolConfig(): PoolConfig {
  const url = db.url()
  const parsed = new URL(url)
  const database = parsed.pathname.replace(/^\/+/, '')

  if (!database) {
    throw new Error(`DATABASE_URL tidak memuat nama basis data: ${url}`)
  }

  const ssl = db.ssl()

  return {
    host: parsed.hostname,
    port: parsed.port ? Number(parsed.port) : 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
    connectTimeout: 10_000,
    allowPublicKeyRetrieval: !ssl,
    ...(ssl ? { ssl: { rejectUnauthorized: true } } : {}),
  }
}

/**
 * Klien Prisma tunggal.
 *
 * Di development Next.js sering memuat ulang modul, sehingga instance disimpan
 * di globalThis agar tidak membuka koneksi baru setiap hot reload.
 */
const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient
  prismaAdapter?: PrismaMariaDb
}

const prismaAdapter = globalForPrisma.prismaAdapter ?? new PrismaMariaDb(poolConfig())

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: prismaAdapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
  globalForPrisma.prismaAdapter = prismaAdapter
}
