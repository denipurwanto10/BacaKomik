"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, invalidateApi } from "@/lib/client";
import type { GenreRef, MangaCard } from "@/lib/api/types";
import { KomikListCard, KomikListSkeleton } from "@/components/komik-list";
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

/** Ambil nilai awal: URL dulu, cadangan sessionStorage (pilihan terakhir). */
function initFromUrlOrSession(sp: URLSearchParams, key: string): string {
  const fromUrl = sp.get(key);
  if (fromUrl !== null) return fromUrl;
  try {
    return sessionStorage.getItem(`bk-terbaru-${key}`) ?? "";
  } catch {
    return "";
  }
}

function TerbaruContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const [orderby, setOrderby] = useState<Orderby>(() => {
    const fromUrl = sp.get("orderby");
    if (fromUrl) return parseOrderby(fromUrl);
    try {
      return parseOrderby(sessionStorage.getItem("bk-terbaru-orderby"));
    } catch {
      return "modified";
    }
  });
  const [tipe, setTipe] = useState(() => initFromUrlOrSession(sp, "tipe"));
  const [status, setStatus] = useState(() => initFromUrlOrSession(sp, "status"));
  // Multi-pilih genre: 2 slot (genre + genre2) — batas dari sumber data.
  // Bisa diisi dari URL (?genre=&genre2=) hasil deep-link halaman Genre.
  const [genre1, setGenre1] = useState(() => initFromUrlOrSession(sp, "genre"));
  const [genre2, setGenre2] = useState(() => initFromUrlOrSession(sp, "genre2"));
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
    // Pilihan filter ditulis ke URL (replace, tanpa reload) + sessionStorage
    // agar tidak reset saat buka komik lalu kembali — back button, tab
    // "Terbaru", maupun refresh semua mempertahankan pilihan terakhir.
    const qs = new URLSearchParams();
    if (orderby !== "modified") qs.set("orderby", orderby);
    if (tipe) qs.set("tipe", tipe);
    if (status) qs.set("status", status);
    if (genre1) qs.set("genre", genre1);
    if (genre2) qs.set("genre2", genre2);
    const target = qs.size > 0 ? `/terbaru?${qs}` : "/terbaru";
    router.replace(target, { scroll: false });
    try {
      sessionStorage.setItem("bk-terbaru-orderby", orderby);
      sessionStorage.setItem("bk-terbaru-tipe", tipe);
      sessionStorage.setItem("bk-terbaru-status", status);
      sessionStorage.setItem("bk-terbaru-genre", genre1);
      sessionStorage.setItem("bk-terbaru-genre2", genre2);
    } catch {
      // storage diblokir — URL saja sudah cukup
    }
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

      {loading && <KomikListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={() => load(1, orderby, tipe, status, genre1, genre2, false)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message="Tidak ada komik dari sumber data untuk filter ini." />
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="min-w-0 divide-y divide-line dark:divide-line-dark">
            {items.map((item) => (
              <KomikListCard key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
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
