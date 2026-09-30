"use client";

import Link from "next/link";
import { prefetchApi } from "@/lib/client";
import type { NovelCard } from "@/lib/api/novel";

/** Path chapter Meionovels (/novel/<slug>/<srv>/chapter-N/) → route reader internal. */
export function novelChapterToRoute(path: string): string {
  const m = path.match(/\/novel\/([^/]+)\/(.+?)\/?$/);
  if (!m) return path;
  return `/baca-novel/${m[1]}/${encodeURIComponent(m[2].replace(/\/+$/g, ""))}`;
}

/**
 * Kartu list novel: judul + "genre | waktu" + sinopsis 2 baris +
 * tombol chapter/volume Awal + Terbaru.
 */
export function NovelListCard({ item }: { item: NovelCard }) {
  const warm = () => prefetchApi(`/api/novel/${encodeURIComponent(item.slug)}`);
  const metaLeft = item.genre || item.type || "Novel";
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="flex min-w-0 gap-2.5 border-b border-line py-3 last:border-0 sm:gap-3.5 sm:py-3.5 dark:border-line-dark"
    >
      <Link
        href={`/novel/${item.slug}`}
        aria-label={item.title}
        className="relative h-[132px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-paper-3 sm:h-[112px] sm:w-[168px] dark:bg-ink-3"
      >
        {item.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-1 text-center text-[11px] text-muted dark:text-muted-dark">
            Tanpa cover
          </span>
        )}
        <div className="absolute left-1 top-1 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white">
          Novel
        </div>
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/novel/${item.slug}`}
          className="min-w-0 break-words font-display text-[13px] font-bold leading-snug text-fg hover:text-accent sm:text-[15px] dark:text-fg-dark"
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {item.title}
        </Link>
        <p className="mt-1 truncate text-[11px] leading-tight text-muted sm:text-xs dark:text-muted-dark">
          <span className="font-medium text-accent">{metaLeft}</span>
          {item.updatedAt && <span> | {item.updatedAt}</span>}
        </p>
        {item.synopsis && (
          <p className="mt-1 line-clamp-2 break-words text-[11px] leading-relaxed text-fg/70 sm:text-xs dark:text-fg-dark/65">
            {item.synopsis}
          </p>
        )}
        <div className="mt-1.5 flex min-w-0 items-center gap-1.5 sm:mt-2 sm:gap-2">
          {item.firstChapter ? (
            <Link
              href={novelChapterToRoute(item.firstChapter.url)}
              className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center truncate rounded-full border border-line bg-paper px-3.5 py-1 text-xs font-semibold text-fg transition-colors hover:border-accent hover:text-accent sm:min-h-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs dark:border-line-dark dark:bg-ink dark:text-fg-dark"
            >
              <span className="truncate">{item.firstChapter.label}</span>
            </Link>
          ) : (
            <Link
              href={`/novel/${item.slug}`}
              className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center truncate rounded-full border border-line bg-paper px-3.5 py-1 text-xs font-semibold text-muted sm:min-h-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs dark:border-line-dark dark:bg-ink dark:text-muted-dark"
            >
              <span className="truncate">Awal</span>
            </Link>
          )}
          {item.latestChapter ? (
            <Link
              href={novelChapterToRoute(item.latestChapter.url)}
              className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center truncate rounded-full bg-accent px-3.5 py-1 text-xs font-semibold text-white transition-transform active:scale-[0.97] sm:min-h-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs"
            >
              <span className="truncate">{item.latestChapter.label}</span>
            </Link>
          ) : (
            <Link
              href={`/novel/${item.slug}`}
              className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center truncate rounded-full bg-ink/60 px-3.5 py-1 text-xs font-semibold text-white sm:min-h-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs"
            >
              <span className="truncate">Detail</span>
            </Link>
          )}
        </div>
      </div>
    </article>
  );
}

export function NovelListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="min-w-0 divide-y divide-line dark:divide-line-dark" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex animate-pulse gap-2.5 py-3 sm:gap-3.5 sm:py-3.5">
          <div className="h-[132px] w-[96px] shrink-0 rounded-lg bg-paper-3 sm:h-[112px] sm:w-[168px] dark:bg-ink-3" />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-4 w-3/4 rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-3 w-1/3 rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-8 w-1/2 rounded-full bg-paper-3 dark:bg-ink-3" />
          </div>
        </div>
      ))}
    </div>
  );
}
