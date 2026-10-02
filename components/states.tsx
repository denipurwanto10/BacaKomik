import Link from "next/link";
import type { MangaCard } from "@/lib/api/types";
import { MangaGridCard } from "./cards";

/** Skeleton loading untuk grid kartu. */
export function GridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 min-[420px]:gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-xl border border-line dark:border-line-dark">
          <div className="aspect-[3/4] bg-paper-3 dark:bg-ink-3" />
          <div className="space-y-1.5 p-2 sm:p-2.5">
            <div className="h-3 w-11/12 rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-2.5 w-2/3 rounded bg-paper-3 dark:bg-ink-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Skeleton loading untuk daftar baris. */
export function ListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div aria-hidden="true" className="animate-pulse divide-y divide-line dark:divide-line-dark">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-2.5 py-3 sm:gap-3">
          <div className="h-[60px] w-[92px] shrink-0 rounded-lg bg-paper-3 sm:h-[68px] sm:w-[110px] dark:bg-ink-3" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <div className="h-3.5 w-3/4 rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-3 w-1/2 rounded bg-paper-3 dark:bg-ink-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** State error: tampilkan pesan jelas, tanpa data pengganti. */
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border border-danger/25 bg-danger/5 px-4 py-10 text-center dark:border-danger-dark/30 dark:bg-danger-dark/10">
      <p className="text-sm font-semibold text-danger dark:text-danger-dark">Gagal memuat data</p>
      <p className="max-w-md text-sm text-danger/90 dark:text-danger-dark/90">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="rounded-full border border-danger/40 px-4 py-1.5 text-sm font-medium text-danger transition-colors hover:bg-danger hover:text-white active:scale-[0.97] dark:border-danger-dark/40 dark:text-danger-dark dark:hover:bg-danger-dark dark:hover:text-ink"
        >
          Coba lagi
        </button>
      )}
    </div>
  );
}

/** State kosong: API berhasil tapi tidak ada hasil. */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line px-4 py-10 text-center text-sm text-muted dark:border-line-dark dark:text-muted-dark">
      {message}
    </div>
  );
}

/** Judul section + link "Lihat semua". */
export function SectionHead({
  title,
  href,
  linkLabel = "Lihat semua",
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-2 sm:gap-3">
      <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-extrabold text-fg sm:text-xl dark:text-fg-dark">
        <span className="h-4 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-accent to-accent-strong" />
        <span className="truncate">{title}</span>
      </h2>
      {href && (
        <Link
          href={href}
          className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-accent hover:underline"
        >
          {linkLabel}
        </Link>
      )}
    </div>
  );
}

/** Grid kartu responsif: 2 kolom di HP kecil → 3 → 6 di desktop. */
export function MangaGrid({ items }: { items: MangaCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 min-[420px]:gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
      {items.map((item, i) => (
        <MangaGridCard
          key={`${item.slug}#${item.latestChapter?.url ?? item.firstChapter?.url ?? i}`}
          item={item}
        />
      ))}
    </div>
  );
}
