import { PageShell } from '@/components/layout/shell'

/**
 * Landing page sementara.
 *
 * Fase 0 PRD 14.1 hanya menuntut halaman kosong tampil benar di mobile dan
 * desktop, jadi ini placeholder yang sudah memakai token desain dan navigasi
 * responsif. Isi sebenarnya dibangun di Blok 7 (halaman publik).
 */
export default function HomePage() {
  return (
    <PageShell>
      <section className="mx-auto max-w-2xl py-12 text-center md:py-20">
        <p className="text-xs uppercase tracking-[0.2em] text-text-secondary">
          Jurnal trading publik
        </p>
        <h1 className="mt-3 text-3xl font-bold leading-tight md:text-5xl">
          Catatan trade yang <span className="text-bull">tidak bisa</span> disembunyikan
        </h1>
        <p className="mt-4 text-text-secondary md:text-lg">
          Setiap entry trade terkunci ke entry sebelumnya lewat hash chain. Siapa pun bisa
          menghitung ulang sendiri dan melihat bila ada yang diubah diam-diam.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href="/register"
            className="glow-accent rounded bg-accent px-6 py-3 font-semibold text-white transition-opacity hover:opacity-90"
          >
            Mulai mencatat
          </a>
          <a
            href="/verify"
            className="rounded border border-border px-6 py-3 font-medium text-text-primary transition-colors hover:bg-bg-elevated"
          >
            Cek integritas
          </a>
        </div>

        <ul className="mt-12 grid gap-3 text-left sm:grid-cols-3">
          <Feature title="Hash chain" body="Setiap perubahan menambah blok baru, blok lama tetap utuh." />
          <Feature title="Statistik server" body="Win rate dan expectancy dihitung ulang dari data, bukan klaim trader." />
          <Feature title="Tanpa biaya" body="Tidak ada langganan, tidak ada sinyal berbayar, tidak ada penyimpan dana." />
        </ul>
      </section>

      <p className="mx-auto mt-16 max-w-2xl border-t border-border pt-6 text-center text-xs text-text-secondary">
        Konten di platform ini adalah catatan pribadi trader, bukan rekomendasi investasi.
        Trading forex, crypto, dan memecoin berisiko tinggi dan dapat menghilangkan seluruh
        modal yang ditempatkan.
      </p>
    </PageShell>
  )
}

function Feature({ title, body }: { title: string; body: string }) {
  return (
    <li className="rounded-card border border-border bg-bg-surface p-4">
      <h2 className="font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-text-secondary">{body}</p>
    </li>
  )
}