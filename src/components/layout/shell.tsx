import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * Navigasi utama.
 *
 * PRD 11.5: di mobile navigasi pindah ke bawah (Feed, Jurnal, +Trade, Profil)
 * supaya tombol +Trade mudah dijangkau ibu jari. Di desktop menjadi navigasi atas.
 */
export function SiteHeader({ user }: { user: { username: string } | null }) {
  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg-base/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span aria-hidden className="inline-block h-5 w-1.5 bg-bull" />
          TradeLedger
        </Link>

        <nav aria-label="Navigasi utama" className="ml-4 hidden items-center gap-1 md:flex">
          <NavLink href="/feed">Feed</NavLink>
          <NavLink href="/leaderboard">Leaderboard</NavLink>
          <NavLink href="/verify">Verifikasi</NavLink>
        </nav>

        <div className="ml-auto hidden items-center gap-2 md:flex">
          {user ? (
            <NavLink href={`/u/${user.username}`}>Profil</NavLink>
          ) : (
            <>
              <NavLink href="/login">Masuk</NavLink>
              <NavLink href="/register">Daftar</NavLink>
            </>
          )}
        </div>
      </div>
    </header>
  )
}

/** Navigasi bawah khusus mobile (PRD 11.5). */
export function BottomNav({ user }: { user: { username: string } | null }) {
  return (
    <nav
      aria-label="Navigasi bawah"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg-surface md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-4">
        <li>
          <NavLink href="/feed" className="flex flex-col items-center gap-0.5 py-2 text-xs">
            <span aria-hidden>▤</span> Feed
          </NavLink>
        </li>
        <li>
          <NavLink href="/journal" className="flex flex-col items-center gap-0.5 py-2 text-xs">
            <span aria-hidden>◷</span> Jurnal
          </NavLink>
        </li>
        <li>
          <NavLink
            href="/journal/create"
            className="flex flex-col items-center gap-0.5 py-2 text-xs font-semibold text-accent"
          >
            <span aria-hidden className="text-lg leading-none">
              +
            </span>
            Trade
          </NavLink>
        </li>
        <li>
          <NavLink
            href={user ? `/u/${user.username}` : '/login'}
            className="flex flex-col items-center gap-0.5 py-2 text-xs"
          >
            <span aria-hidden>◎</span> Profil
          </NavLink>
        </li>
      </ul>
    </nav>
  )
}

export function PageShell({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader user={null} />
      <main id="konten" className="page-enter mx-auto w-full max-w-7xl px-4 pb-24 pt-6 md:pb-12">
        {children}
      </main>
      <BottomNav user={null} />
    </>
  )
}

function NavLink({
  href,
  children,
  className = '',
}: {
  href: string
  children: ReactNode
  className?: string
}) {
  return (
    <Link
      href={href}
      className={`flex min-h-11 items-center rounded px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-bg-elevated hover:text-text-primary ${className}`}
    >
      {children}
    </Link>
  )
}
