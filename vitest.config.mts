import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

/**
 * Konfigurasi Vitest.
 *
 * PRD 13.4: unit untuk PnL dan hash, feature untuk auth dan otorisasi,
 * integrity untuk deteksi manipulasi, security untuk XSS, SQLi, dan upload.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // `server-only` melempar error saat diimpor di luar bundler Next.js.
      'server-only': fileURLToPath(new URL('./tests/helpers/server-only-stub.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Modul server membaca process.env langsung, jadi .env.local dimuat di sini.
    setupFiles: ['./tests/setup/env.ts'],
    // Prisma dan modul server butuh waktu boot di modul per test file.
    testTimeout: 20_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      reportsDirectory: 'coverage',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/app/**'],
      thresholds: {
        // PRD 13.4: cakupan di atas 80 persen untuk logika inti.
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
})
