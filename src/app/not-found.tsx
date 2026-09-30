import Link from 'next/link'

import { PageShell } from '@/components/layout/shell'

export default function NotFound() {
  return (
    <PageShell>
      <div className="mx-auto max-w-md py-24 text-center">
        <p className="font-mono text-5xl font-bold text-warning">404</p>
        <h1 className="mt-4 text-xl font-semibold">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-text-secondary">
          Alamat yang kamu tuju tidak ada, atau entry tersebut memang tidak dipublikasikan.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block rounded bg-accent px-5 py-2.5 font-medium text-white hover:opacity-90"
        >
          Kembali ke beranda
        </Link>
      </div>
    </PageShell>
  )
}