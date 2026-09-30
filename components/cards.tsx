import Link from "next/link";
import { prefetchApi } from "@/lib/client";
import { captureCoverMorph } from "@/lib/morph";
import type { MangaCard } from "@/lib/api/types";

/** Saat cover diklik: rekam posisi + gambar untuk animasi terbang ke detail. */
function coverMorphProps(slug: string) {
  return {
    onClick: (e: React.MouseEvent<HTMLAnchorElement>) =>
      captureCoverMorph(slug, e.currentTarget.closest("article")),
  };
}

/** Ubah path chapter Komiku "/slug-chapter-11-2/" → route internal "/baca/slug/11-2". */
export function chapterPathToRoute(komikuPath: string): string {
  const m = komikuPath.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)-chapter-(.+?)\/?$/i);
  if (!m) return "/";
  return `/baca/${m[1]}/${m[2]}`;
}

const TYPE_STYLE: Record<string, string> = {
  manga: "bg-mark-manga",
  manhwa: "bg-mark-manhwa",
  manhua: "bg-mark-manhua",
};

/** Tanda tipe komik — kecil, seperti cap kertas, satu warna per tipe. */
export function TypeBadge({ type, className = "" }: { type?: string; className?: string }) {
  if (!type) return null;
  const color = TYPE_STYLE[type.toLowerCase()] ?? "bg-muted";
  return (
    <span
      className={`inline-block max-w-full shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-bold uppercase leading-tight text-white ${color} ${className}`}
    >
      {type}
    </span>
  );
}

/** Tanda source data — hanya tampil bila kartu berasal dari gabungan multi-source. */
export function SourceBadge({ sources, className = "" }: { sources?: string[]; className?: string }) {
  if (!sources || sources.length === 0) return null;
  const label = sources.length > 1 ? "2 sumber" : sources[0] === "komikindo" ? "Komikindo" : "Komiku";
  return (
    <span
      className={`inline-block max-w-full shrink-0 truncate rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted dark:text-muted-dark ${className}`}
    >
      {label}
    </span>
  );
}

/** Tanda source chapter terbaru (kartu gabungan) — kecil, di sebelah
 *  tombol/label chapter. Tanpa field latestSource = disembunyikan. */
export function LatestSourceTag({ source, className = "" }: { source?: string; className?: string }) {
  if (!source) return null;
  return (
    <span
      className={`inline-block shrink-0 rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-muted dark:border-line-dark dark:text-muted-dark ${className}`}
    >
      {source === "komikindo" ? "Komikindo" : "Komiku"}
    </span>
  );
}

/** Kartu grid vertikal: cover + judul + chapter terbaru. */
export function MangaGridCard({ item }: { item: MangaCard }) {
  const detailPath = `/api/manga/${encodeURIComponent(item.slug)}`;
  // Hover/sentuh = niat membuka — panaskan data detail agar halaman
  // tujuan terbuka dari cache (terasa instan).
  const warm = () => prefetchApi(detailPath);
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="group flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-paper-2 transition-shadow hover:shadow-lg hover:shadow-black/5 dark:border-line-dark dark:bg-ink-2 dark:hover:shadow-black/30"
    >
      <Link
        href={`/komik/${item.slug}`}
        aria-label={item.title}
        {...coverMorphProps(item.slug)}
        className="relative block aspect-[3/4] w-full shrink-0 overflow-hidden bg-paper-3 dark:bg-ink-3"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted dark:text-muted-dark">
            Tanpa cover
          </div>
        )}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
        {item.type && (
          <div className="absolute right-1.5 top-1.5">
            <TypeBadge type={item.type} />
          </div>
        )}
        {item.sources && item.sources.length > 1 && (
          <div className="absolute left-1.5 top-1.5">
            <SourceBadge sources={item.sources} className="bg-black/55 text-white" />
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-2.5">
        <Link
          href={`/komik/${item.slug}`}
          className="truncate text-xs font-semibold leading-snug text-fg hover:text-accent sm:text-[13px] dark:text-fg-dark"
        >
          {item.title}
        </Link>
        {item.genre && (
          <p className="mt-0.5 hidden truncate text-[11px] leading-tight text-muted min-[420px]:block dark:text-muted-dark">
            {item.genre}
          </p>
        )}
        {item.latestChapter && (
          <Link
            href={chapterPathToRoute(item.latestChapter.url)}
            className="mt-auto w-fit max-w-full truncate pt-1.5 text-[11px] font-semibold leading-tight text-accent hover:underline"
          >
            {item.latestChapter.label}
          </Link>
        )}
        <LatestSourceTag source={item.latestSource} />
      </div>
    </article>
  );
}

/** Baris update horizontal: thumb landscape + judul + meta + chapter. */
export function UpdateRow({ item }: { item: MangaCard }) {
  const detailPath = `/api/manga/${encodeURIComponent(item.slug)}`;
  const warm = () => prefetchApi(detailPath);
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="flex min-w-0 gap-2.5 border-b border-line py-2.5 last:border-0 sm:gap-3 sm:py-3 dark:border-line-dark"
    >
      <Link
        href={`/komik/${item.slug}`}
        aria-label={item.title}
        {...coverMorphProps(item.slug)}
        className="relative h-[58px] w-[88px] shrink-0 overflow-hidden rounded-lg bg-paper-3 min-[420px]:h-[68px] min-[420px]:w-[110px] dark:bg-ink-3"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
        {item.type && (
          <div className="absolute right-1 top-1">
            <TypeBadge type={item.type} className="px-1 text-[9px]" />
          </div>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-center gap-1.5">
          <Link
            href={`/komik/${item.slug}`}
            className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-snug text-fg hover:text-accent sm:text-sm dark:text-fg-dark"
          >
            {item.title}
          </Link>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
          {item.genre && (
            <p className="min-w-0 flex-1 truncate text-[11px] leading-tight text-muted sm:text-xs dark:text-muted-dark">
              {item.genre}
            </p>
          )}
          {item.updatedAt && (
            <span className="shrink-0 text-[10px] tabular-nums leading-tight text-muted sm:text-[11px] dark:text-muted-dark">
              {item.updatedAt}
            </span>
          )}
        </div>
        {item.latestChapter && (
          <Link
            href={chapterPathToRoute(item.latestChapter.url)}
            className="mt-auto w-fit max-w-full truncate pt-1 text-xs font-semibold leading-tight text-accent hover:underline"
          >
            {item.latestChapter.label}
          </Link>
        )}
      </div>
    </article>
  );
}

/** Baris ranking: nomor + thumb + judul + views + chapter. */
export function RankRow({ item }: { item: MangaCard }) {
  const detailPath = `/api/manga/${encodeURIComponent(item.slug)}`;
  const warm = () => prefetchApi(detailPath);
  const top3 = typeof item.rank === "number" && item.rank <= 3;
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="flex min-w-0 items-center gap-2 border-b border-line py-2 last:border-0 sm:gap-3 sm:py-2.5 dark:border-line-dark"
    >
      {typeof item.rank === "number" && (
        <span
          className={`w-5 shrink-0 text-center font-display text-sm font-extrabold tabular-nums min-[420px]:w-6 min-[420px]:text-base sm:w-7 sm:text-lg ${
            top3 ? "text-gold" : "text-muted dark:text-muted-dark"
          }`}
        >
          {item.rank}
        </span>
      )}
      <Link
        href={`/komik/${item.slug}`}
        aria-label={item.title}
        {...coverMorphProps(item.slug)}
        className="relative h-14 w-11 shrink-0 overflow-hidden rounded-lg bg-paper-3 min-[420px]:h-16 min-[420px]:w-12 dark:bg-ink-3"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/komik/${item.slug}`}
          className="truncate text-[13px] font-semibold leading-snug text-fg hover:text-accent sm:text-sm dark:text-fg-dark"
        >
          {item.title}
        </Link>
        <div className="flex min-w-0 items-center justify-between gap-2">
          {item.genre && (
            <p className="min-w-0 flex-1 truncate text-[11px] leading-tight text-muted sm:text-xs dark:text-muted-dark">
              {item.genre}
            </p>
          )}
          {item.views && (
            <span className="shrink-0 text-[10px] tabular-nums leading-tight text-muted sm:text-[11px] dark:text-muted-dark">
              {item.views}
            </span>
          )}
        </div>
        {item.latestChapter && (
          <Link
            href={chapterPathToRoute(item.latestChapter.url)}
            className="w-fit max-w-full truncate pt-0.5 text-xs font-semibold leading-tight text-accent hover:underline"
          >
            {item.latestChapter.label}
          </Link>
        )}
      </div>
    </article>
  );
}
