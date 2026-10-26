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
      className={`inline-block max-w-full shrink-0 truncate rounded-sm px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white ${color} ${className}`}
    >
      {type}
    </span>
  );
}

/** Tanda sumber data — kecil seperti TypeBadge, satu warna per source. */
const SOURCE_STYLE: Record<string, string> = {
  shinigami: "bg-accent",
  komiku: "bg-mark-manhwa",
  komikcast: "bg-mark-manga",
};

const SOURCE_SHORT: Record<string, string> = {
  shinigami: "Shinigami",
  komiku: "Komiku",
  komikcast: "Komikcast",
};

/** Label asal data kartu (Shinigami / Komiku / keduanya). Diam bila tak ada info. */
export function SourceBadge({
  sources,
  className = "",
}: {
  sources?: string[];
  className?: string;
}) {
  if (!sources || sources.length === 0) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 ${className}`}>
      {sources.map((s) => {
        const key = s.toLowerCase();
        const color = SOURCE_STYLE[key] ?? "bg-muted";
        return (
          <span
            key={s}
            className={`inline-block shrink-0 truncate rounded-sm px-1.5 py-0.5 text-[10px] font-extrabold uppercase leading-tight tracking-wide text-white ${color}`}
          >
            {SOURCE_SHORT[key] ?? s}
          </span>
        );
      })}
    </span>
  );
}

/** Kartu grid vertikal: cover bersudut miring + judul + chapter terbaru. Tanpa bingkai. */
export function MangaGridCard({ item }: { item: MangaCard }) {
  const detailPath = `/api/manga/${encodeURIComponent(item.slug)}`;
  // Hover/sentuh = niat membuka — panaskan data detail agar halaman
  // tujuan terbuka dari cache (terasa instan).
  const warm = () => prefetchApi(detailPath);
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="cv-auto group flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-paper-2 transition-colors duration-200 hover:border-accent/60 dark:border-line-dark dark:bg-ink-2"
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
            decoding="async"
            fetchPriority="low"
            onLoad={(e) => e.currentTarget.classList.add("blur-done")}
            className="blur-up h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted dark:text-muted-dark">
            Tanpa cover
          </div>
        )}
        {item.type && (
          <div className="absolute left-0 top-0">
            <TypeBadge type={item.type} className="rounded-none px-2 py-1" />
          </div>
        )}
        <SourceBadge
          className="absolute right-0 top-0 max-w-[55%] [&>span]:rounded-none [&>span]:px-1.5 [&>span]:py-1 [&>span]:text-[9px]"
          sources={item.latestSource ? [item.latestSource] : item.sources?.slice(0, 1)}
        />
        {item.latestChapter && (
          <span className="absolute bottom-0 left-0 max-w-full truncate bg-accent px-2 py-1 text-[11px] font-bold leading-none text-white">
            {item.latestChapter.label}
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col px-2.5 pb-2 pt-2.5">
        <Link
          href={`/komik/${item.slug}`}
          title={item.title}
          className="mb-2 line-clamp-2 break-words text-[13px] font-bold leading-snug text-fg hover:text-accent dark:text-fg-dark"
        >
          {item.title}
        </Link>
        {(item.genre || item.updatedAt) && (
          <p className="mt-auto truncate border-t border-line pt-2 text-[11px] leading-tight tabular-nums text-muted dark:border-line-dark dark:text-muted-dark">
            <span className="sm:hidden">{item.updatedAt || item.genre}</span>
            <span className="max-sm:hidden">{[item.genre, item.updatedAt].filter(Boolean).join(" · ")}</span>
          </p>
        )}
      </div>
    </article>
  );
}

/**
 * Ubin besar untuk beranda. `featured` mengisi 2×2 sel grid: cover penuh,
 * judul di blok solid (bukan gradien) menempel di dasar.
 */
export function UpdateTile({ item, featured = false }: { item: MangaCard; featured?: boolean }) {
  const warm = () => prefetchApi(`/api/manga/${encodeURIComponent(item.slug)}`);
  if (!featured) return <MangaGridCard item={item} />;
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="group relative aspect-[16/11] min-w-0 md:absolute md:inset-0 md:aspect-auto"
    >
      <Link
        href={`/komik/${item.slug}`}
        aria-label={item.title}
        {...coverMorphProps(item.slug)}
        className="chamfer absolute inset-0 block overflow-hidden bg-paper-3 dark:bg-ink-3"
      >
        {item.thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.title}
            loading="lazy"
            decoding="async"
            onLoad={(e) => e.currentTarget.classList.add("blur-done")}
            className="blur-up h-full w-full object-cover object-top transition-transform duration-300 group-hover:scale-[1.03]"
          />
        )}
        <div className="absolute inset-x-0 bottom-0 bg-ink p-3 text-fg-dark sm:p-4">
          <div className="flex items-center gap-2">
            <TypeBadge type={item.type} />
            {item.updatedAt && <span className="text-[11px] tabular-nums text-muted-dark">{item.updatedAt}</span>}
          </div>
          <p className="display-cond mt-1.5 line-clamp-2 text-2xl sm:text-3xl">{item.title}</p>
          {item.latestChapter && (
            <p className="mt-1.5 text-xs font-bold text-accent">{item.latestChapter.label}</p>
          )}
        </div>
      </Link>
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
      className="cv-row flex min-w-0 gap-2.5 border-b border-line py-2.5 last:border-0 sm:gap-3 sm:py-3 dark:border-line-dark"
    >
      <Link
        href={`/komik/${item.slug}`}
        aria-label={item.title}
        {...coverMorphProps(item.slug)}
        className="relative h-[58px] w-[88px] shrink-0 overflow-hidden rounded-sm bg-paper-3 min-[420px]:h-[68px] min-[420px]:w-[110px] dark:bg-ink-3"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" loading="lazy" decoding="async" fetchPriority="low" onLoad={(e) => e.currentTarget.classList.add("blur-done")} className="blur-up h-full w-full object-cover" />
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
            className="min-w-0 flex-1 truncate text-[13px] font-bold leading-snug text-fg hover:text-accent sm:text-sm dark:text-fg-dark"
          >
            {item.title}
          </Link>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center justify-between gap-2">
          <SourceBadge sources={item.latestSource ? [item.latestSource] : item.sources?.slice(0, 1)} />
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

/** Baris ranking: nomor, cover kecil, judul, genre, chapter, views. Polos, dipisah garis tipis. */
export function RankRow({ item }: { item: MangaCard }) {
  const detailPath = `/api/manga/${encodeURIComponent(item.slug)}`;
  const warm = () => prefetchApi(detailPath);
  const top3 = typeof item.rank === "number" && item.rank <= 3;
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="cv-row relative flex min-w-0 items-center gap-3 rounded-xl border border-line bg-paper-2 p-2.5 transition-colors hover:border-accent hover:bg-paper-3/60 sm:gap-4 sm:p-3 dark:border-line-dark dark:bg-ink-2 dark:hover:bg-ink-3/70"
    >
      {typeof item.rank === "number" && (
        <span
          className={`w-6 shrink-0 text-center font-display text-lg font-extrabold tabular-nums sm:w-7 sm:text-xl ${
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
        className="relative z-10 h-[68px] w-[50px] shrink-0 overflow-hidden rounded-md bg-paper-3 sm:h-[84px] sm:w-[62px] dark:bg-ink-3"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" loading="lazy" decoding="async" fetchPriority="low" onLoad={(e) => e.currentTarget.classList.add("blur-done")} className="blur-up h-full w-full object-cover" />
        ) : null}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <Link
          href={`/komik/${item.slug}`}
          title={item.title}
          className="truncate text-sm font-bold leading-snug text-fg after:absolute after:inset-0 after:content-[''] sm:text-[15px] lg:text-base dark:text-fg-dark"
        >
          {item.title}
        </Link>
        <p className="truncate text-xs leading-tight text-muted sm:text-[13px] dark:text-muted-dark">
          {[item.genre, item.views].filter(Boolean).join(" · ")}
        </p>
        {item.latestChapter && (
          <Link
            href={chapterPathToRoute(item.latestChapter.url)}
            className="relative z-10 mt-0.5 w-fit max-w-full truncate text-xs font-semibold leading-tight text-accent sm:text-[13px]"
          >
            {item.latestChapter.label}
          </Link>
        )}
      </div>
    </article>
  );
}
