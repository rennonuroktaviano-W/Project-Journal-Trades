import type { Metadata, Viewport } from 'next'

import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'TradeLedger — Jurnal trading publik yang bisa diverifikasi',
    template: '%s | TradeLedger',
  },
  description:
    'Catat trade forex, crypto, dan memecoin. Setiap entry terkunci ke entry sebelumnya lewat hash chain sehingga manipulasi tidak bisa disembunyikan.',
  openGraph: {
    type: 'website',
    siteName: 'TradeLedger',
    locale: 'id_ID',
  },
}

export const viewport: Viewport = {
  themeColor: '#0B0E11',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="min-h-dvh bg-bg-base text-text-primary antialiased">
        <a
          href="#konten"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-bg-elevated focus:px-4 focus:py-2"
        >
          Lompat ke konten
        </a>
        {children}
      </body>
    </html>
  )
}