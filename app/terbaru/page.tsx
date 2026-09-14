"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet, invalidateApi } from "@/lib/client";
import type { GenreRef, MangaCard } from "@/lib/api/types";
import { MangaGrid, SectionHead, GridSkeleton, ErrorState, EmptyState } from "@/components/states";

interface LatestPayload {
  items: MangaCard[];
  hasNextPage: boolean;
}

const ORDERBYS = [
  { v: "modified", label: "Chapter terbaru" },
  { v: "date", label: "Judul baru" },
  { v: "rand", label: "Acak" },
] as const;

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

function TerbaruContent() {
  const sp = useSearchParams();
  const orderby = (sp.get("orderby") as "modified" | "date" | "rand" | null) || "modified";
  const initGenre1 = sp.get("genre") || "";
  const initGenre2 = sp.get("genre2") || "";
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
    async (p: number, t: string, s: string, g1: string, g2: string, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const qs = new URLSearchParams({ page: String(p), orderby });
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
    [orderby],
  );

  useEffect(() => {
    // Saat membuka /terbaru, jangan gunakan hasil lama dari memory cache.
    invalidateApi();
    load(1, tipe, status, genre1, genre2, false);
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
      <div className="rail-scroll -mx-3 flex items-center gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
        {ORDERBYS.map((o) => {
          const href = o.v === "modified" ? "/terbaru" : `/terbaru?orderby=${o.v}`;
          const active = orderby === o.v;
          return (
            <Link
              key={o.v}
              href={href}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors sm:py-1.5 ${
                active
                  ? "border-accent bg-accent text-white"
                  : "border-line text-muted hover:text-fg dark:border-line-dark dark:text-muted-dark dark:hover:text-fg-dark"
              }`}
            >
              {o.label}
            </Link>
          );
        })}
        <select
          value={tipe}
          onChange={(e) => setTipe(e.target.value)}
          aria-label="Filter tipe komik"
          className="h-9 shrink-0 rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
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
          className="h-9 shrink-0 rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
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
          className="h-9 max-w-40 shrink-0 truncate rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
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
          className="h-9 max-w-40 shrink-0 truncate rounded-full border border-line bg-paper-2 px-3 text-sm font-medium text-fg sm:h-[30px] sm:text-xs dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark"
        >
          <option value="">Genre 2: Semua</option>
          {genreOpts.map((g) => (
            <option key={g.slug} value={g.slug} disabled={g.slug === genre1 && genre1 !== ""}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      {loading && <GridSkeleton count={12} />}
      {error && <ErrorState message={error} onRetry={() => load(1, tipe, status, genre1, genre2, false)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="Tidak ada komik dari sumber data untuk filter ini." />
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <MangaGrid items={items} />
          {hasNext && (
            <button
              onClick={() => load(page + 1, tipe, status, genre1, genre2, true)}
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
    <Suspense fallback={<GridSkeleton count={12} />}>
      <TerbaruContent />
    </Suspense>
  );
}
