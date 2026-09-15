"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, invalidateApi, prefetchApi } from "@/lib/client";
import type { GenreRef, MangaCard } from "@/lib/api/types";
import { chapterPathToRoute, TypeBadge } from "@/components/cards";
import { SectionHead, ListSkeleton, ErrorState, EmptyState } from "@/components/states";

interface LatestPayload {
  items: MangaCard[];
  hasNextPage: boolean;
}

const ORDERBYS = [
  { v: "modified", label: "Chapter terbaru" },
  { v: "date", label: "Komik terbaru" },
  { v: "rand", label: "Acak" },
] as const;

type Orderby = (typeof ORDERBYS)[number]["v"];

function parseOrderby(raw: string | null): Orderby {
  return raw === "date" || raw === "rand" ? raw : "modified";
}

const TIPES = [
  { v: "", label: "Semua tipe" },
  { v: "manga", label: "Manga" },
  { v: "manhwa", label: "Manhwa" },
  { v: "manhua", label: "Manhua" },
] as const;

const STATUSES = [
  { v: "", label: "Semua status" },
  { v: "ongoing", label: "Ongoing" },
  { v: "end", label: "Tamat" },
] as const;

/**
 * Kartu list ala Komiku: cover + badge tipe + judul + "Genre | waktu" +
 * sinopsis + link "Awal: …" / "Terbaru: …".
 */
function TerbaruListCard({ item }: { item: MangaCard }) {
  const warm = () => prefetchApi(`/api/manga/${encodeURIComponent(item.slug)}`);
  const meta = [item.genre, item.updatedAt].filter(Boolean).join(" | ");
  return (
    <article
      onMouseEnter={warm}
      onTouchStart={warm}
      className="flex min-w-0 gap-2.5 border-b border-line py-3 last:border-0 sm:gap-3.5 sm:py-3.5 dark:border-line-dark"
    >
      <Link
        href={`/komik/${item.slug}`}
        aria-label={item.title}
        className="h-[132px] w-[96px] shrink-0 overflow-hidden rounded-lg bg-paper-3 sm:h-[112px] sm:w-[168px] dark:bg-ink-3"
      >
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.thumbnail} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center p-1 text-center text-[11px] text-muted dark:text-muted-dark">
            Tanpa cover
          </span>
        )}
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-w-0 items-start gap-1.5">
          <span className="mt-0.5 shrink-0">
            <TypeBadge type={item.type} />
          </span>
          <Link
            href={`/komik/${item.slug}`}
            className="min-w-0 flex-1 break-words font-display text-[13px] font-bold leading-snug text-fg hover:text-accent sm:text-[15px] dark:text-fg-dark"
            style={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {item.title}
          </Link>
        </div>
        {meta && (
          <p className="mt-1 truncate text-[11px] leading-tight text-muted sm:text-xs dark:text-muted-dark">
            {meta}
          </p>
        )}
        {item.synopsis && (
          <p className="mt-1.5 line-clamp-2 break-words text-xs leading-relaxed text-fg/75 sm:line-clamp-none sm:text-[13px] dark:text-fg-dark/70">
            {item.synopsis}
          </p>
        )}
        {(item.firstChapter || item.latestChapter) && (
          <div className="mt-1.5 flex min-w-0 items-center gap-1.5 sm:mt-2 sm:gap-2">
            {item.firstChapter && (
              <Link
                href={chapterPathToRoute(item.firstChapter.url)}
                className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center truncate rounded-full border border-line bg-paper px-3.5 py-1 text-xs font-semibold text-fg transition-colors hover:border-accent hover:text-accent sm:min-h-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs dark:border-line-dark dark:bg-ink dark:text-fg-dark"
              >
                <span className="truncate">
                  <span className="sm:hidden">{item.firstChapter.label}</span>
                  <span className="hidden sm:inline">
                    Awal: <span className="font-bold">{item.firstChapter.label}</span>
                  </span>
                </span>
              </Link>
            )}
            {item.latestChapter && (
              <Link
                href={chapterPathToRoute(item.latestChapter.url)}
                className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center truncate rounded-full bg-accent px-3.5 py-1 text-xs font-semibold text-white shadow-sm shadow-accent/30 transition-opacity hover:opacity-90 sm:min-h-0 sm:flex-none sm:rounded-lg sm:px-2.5 sm:py-1 sm:text-xs"
              >
                <span className="truncate">
                  <span className="sm:hidden">{item.latestChapter.label}</span>
                  <span className="hidden sm:inline">Terbaru: {item.latestChapter.label}</span>
                </span>
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

function TerbaruListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="animate-pulse divide-y divide-line dark:divide-line-dark">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-2.5 py-3 sm:gap-3.5 sm:py-3.5">
          <div className="h-[132px] w-[96px] shrink-0 rounded-lg bg-paper-3 sm:h-[152px] sm:w-[112px] dark:bg-ink-3" />
          <div className="min-w-0 flex-1 space-y-2 py-1">
            <div className="h-4 w-11/12 rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-3 w-1/2 rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-3 w-full rounded bg-paper-3 dark:bg-ink-3" />
            <div className="h-3 w-2/3 rounded bg-paper-3 dark:bg-ink-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function TerbaruContent() {
  const sp = useSearchParams();
  const initGenre1 = sp.get("genre") || "";
  const initGenre2 = sp.get("genre2") || "";
  const [orderby, setOrderby] = useState<Orderby>(() => parseOrderby(sp.get("orderby")));
  const [tipe, setTipe] = useState("");
  const [status, setStatus] = useState("");
  // Multi-pilih genre: 2 slot (genre + genre2) — batas dari sumber data.
  // Bisa diisi dari URL (?genre=&genre2=) hasil deep-link halaman Genre.
  const [genre1, setGenre1] = useState(initGenre1);
  const [genre2, setGenre2] = useState(initGenre2);
  const [genreOpts, setGenreOpts] = useState<GenreRef[]>([]);
  const [items, setItems] = useState<MangaCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (
      p: number,
      o: Orderby,
      t: string,
      s: string,
      g1: string,
      g2: string,
      append: boolean,
    ) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const qs = new URLSearchParams({ page: String(p), orderby: o });
        if (t) qs.set("tipe", t);
        if (s) qs.set("status", s);
        if (g1) qs.set("genre", g1);
        if (g2) qs.set("genre2", g2);
        const res = await apiGet<LatestPayload>(`/api/latest?${qs}`);
        setItems((prev) => {
          if (!append) return res.items;
          const seen = new Set(prev.map((p) => p.slug));
          return [...prev, ...res.items.filter((it) => !seen.has(it.slug))];
        });
        setHasNext(res.hasNextPage);
        setPage(p);
      } catch (e) {
        if (!append) setError(e instanceof Error ? e.message : "Gagal memuat data.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    // Saat membuka /terbaru, jangan gunakan hasil lama dari memory cache.
    invalidateApi();
    load(1, orderby, tipe, status, genre1, genre2, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderby, tipe, status, genre1, genre2]);

  // Opsi genre untuk dropdown (sekali muat, 1 jam cache server).
  useEffect(() => {
    apiGet<GenreRef[]>("/api/genres")
      .then(setGenreOpts)
      .catch(() => setGenreOpts([]));
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title="Komik Terbaru" />
      <div className="grid grid-cols-2 gap-2 sm:mx-0 sm:flex sm:items-center sm:gap-1.5 sm:overflow-x-auto sm:px-0 sm:pb-0.5">
        <select
          value={orderby}
          onChange={(e) => setOrderby(parseOrderby(e.target.value))}
          aria-label="Urutkan daftar"
          className="h-11 w-full min-w-0 rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:w-auto sm:shrink-0 sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
        >
          {ORDERBYS.map((o) => (
            <option key={o.v} value={o.v}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value)}
          aria-label="Filter tipe komik"
          className="h-11 w-full min-w-0 rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:w-auto sm:shrink-0 sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
        >
          {TIPES.map((t) => (
            <option key={t.v} value={t.v}>
              {t.label}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter status komik"
          className="h-11 w-full min-w-0 rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:w-auto sm:shrink-0 sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
        >
          {STATUSES.map((s) => (
            <option key={s.v} value={s.v}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={genre1}
          onChange={(e) => {
            setGenre1(e.target.value);
            if (e.target.value && e.target.value === genre2) setGenre2("");
          }}
          aria-label="Filter genre pertama"
          className="h-11 w-full min-w-0 truncate rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:w-auto sm:max-w-40 sm:shrink-0 sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
        >
          <option value="">Genre 1: Semua</option>
          {genreOpts.map((g) => (
            <option key={g.slug} value={g.slug} disabled={g.slug === genre2 && genre2 !== ""}>
              {g.name}
            </option>
          ))}
        </select>
        <select
          value={genre2}
          onChange={(e) => setGenre2(e.target.value)}
          aria-label="Filter genre kedua"
          className="h-11 w-full min-w-0 truncate rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:w-auto sm:max-w-40 sm:shrink-0 sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
        >
          <option value="">Genre 2: Semua</option>
          {genreOpts.map((g) => (
            <option key={g.slug} value={g.slug} disabled={g.slug === genre1 && genre1 !== ""}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <TerbaruListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={() => load(1, orderby, tipe, status, genre1, genre2, false)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="Tidak ada komik dari sumber data untuk filter ini." />
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="min-w-0 divide-y divide-line dark:divide-line-dark">
            {items.map((item) => (
              <TerbaruListCard key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
            ))}
          </div>
          {hasNext && (
            <button
              onClick={() => load(page + 1, orderby, tipe, status, genre1, genre2, true)}
              disabled={loadingMore}
              className="mx-auto min-h-11 rounded-full border border-line px-6 py-2 text-sm font-semibold text-fg disabled:opacity-50 sm:min-h-0 dark:border-line-dark dark:text-fg-dark"
            >
              {loadingMore ? "Memuat…" : "Muat lebih banyak"}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function TerbaruPage() {
  return (
    <Suspense fallback={<ListSkeleton count={8} />}>
      <TerbaruContent />
    </Suspense>
  );
}
