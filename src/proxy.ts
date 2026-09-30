import { NextResponse, type NextRequest } from 'next/server'

/**
 * Middleware keamanan global.
 *
 * PRD 9.1 mensyaratkan Content-Security-Policy ketat tanpa `unsafe-inline`
 * untuk script. Agar React tetap bisa menyuntikkan tag script milik Next,
 * setiap request mendapat nonce acak yang/templateNonce Next teruskan ke
 * render, dan CSP memakai nonce yang sama.
 *
 * CSP ini berada di proxy, bukan di next.config.ts, karena nonce harus
 * berbeda pada setiap request. Header statis lainnya tetap di next.config.ts.
 */
const CSP_DIRECTIVES: Array<[string, string[]]> = [
  ['default-src', ["'self'"]],
  ['base-uri', ["'self'"]],
  ['form-action', ["'self'"]],
  ['frame-ancestors', ["'none'"]],
  ['object-src', ["'none'"]],
  ['script-src', ["'self'", "'strict-dynamic'", "'nonce-__nonce__'"]],
  // Tailwind dan React menyuntikkan style inline, jadi style-src longgar.
  // Ini tidak melemahkan proteksi XSS, karena style bukan sumber eksekusi.
  ['style-src', ["'self'", "'unsafe-inline'"]],
  ['img-src', ["'self'", 'data:', 'blob:']],
  ['font-src', ["'self'"]],
  ['connect-src', ["'self'"]],
  ['frame-src', ["'none'"]],
  ['worker-src', ["'self'", 'blob:']],
  ['manifest-src', ["'self'"]],
  ['upgrade-insecure-requests', []],
]

function buildCsp(nonce: string): string {
  return CSP_DIRECTIVES.map(([directive, values]) =>
    values.length === 0 ? directive : `${directive} ${values.join(' ').replace('__nonce__', nonce)}`,
  ).join('; ')
}

export default function proxy(request: NextRequest) {
  const nonce = crypto.randomUUID().replace(/-/g, '')

  // Halaman yang tidak boleh di-cache browser karena berisi data per pengguna.
  const isPrivate = ['/dashboard', '/journal', '/settings', '/analytics', '/admin'].some(
    (prefix) => request.nextUrl.pathname === prefix || request.nextUrl.pathname.startsWith(`${prefix}/`),
  )

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)
  // Beri tahu Next agar ia memakai nonce ini untuk script yang ia suntikkan.
  requestHeaders.set('x-csp-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })

  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  if (isPrivate) {
    response.headers.set('Cache-Control', 'no-store, private')
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Semua path kecuali aset statis. Aset build sudah punya nama ber-hash
     * dan tidak butuh CSP per-request.
     */
    {
      source: '/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:png|jpg|jpeg|webp|svg|ico|css|js|woff2)$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
}
