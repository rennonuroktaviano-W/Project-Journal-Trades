/**
 * Pemuat environment untuk test.
 *
 * Vitest tidak membaca `.env.local` seperti yang dilakukan Prisma CLI, tapi
 * modul server seperti `src/lib/env` membaca `process.env` secara langsung.
 * File ini memuat `.env.local` (atau `.env` sebagai cadangan) dengan override
 * palsu supaya variabel yang sudah diset di shell tidak tertimpa.
 */

import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import { config } from 'dotenv'

for (const file of ['.env.local', '.env']) {
  const path = resolve(process.cwd(), file)

  if (existsSync(path)) {
    config({ path, override: false })
    break
  }
}
