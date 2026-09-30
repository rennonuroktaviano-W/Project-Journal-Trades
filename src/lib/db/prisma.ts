import 'server-only'

import { PrismaClient } from '@prisma/client'

/**
 * Klien Prisma tunggal.
 *
 * Di development Next.js sering memuat ulang modul, sehingga instance disimpan
 * di globalThis agar tidak membuka koneksi baru setiap hot reload.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}