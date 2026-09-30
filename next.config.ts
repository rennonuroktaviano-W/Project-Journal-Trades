import type { NextConfig } from 'next'

/**
 * Konfigurasi Next.js TradeLedger.
 *
 * Catatan keamanan (PRD 9.1, 9.3):
 * - Header keamanan dikirim lewat `headers()` di sini, bukan lewat middleware,
 *   supaya berlaku juga untuk route yang di-cache.
 * - `poweredByHeader` dimatikan supaya versi server tidak bocor.
 * - Upload screenshot disimpan di luar public root (PRD 7.1, 9.1).
 */
const nextConfig: NextConfig = {
  poweredByHeader: false,

  reactStrictMode: true,

  // `.env.local` tidak boleh ikut ter-bundle ke client.
  env: {},

  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [],
  },

  // Header keamanan global. CSP-nya di-set di middleware.ts supaya nonce bisa
  // diganti dengan nilai acak per request.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
          },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
        ],
      },
    ]
  },

  serverExternalPackages: ['@node-rs/argon2', 'sanitize-html'],

  async redirects() {
    return [{ source: '/home', destination: '/', permanent: false }]
  },
}

export default nextConfig