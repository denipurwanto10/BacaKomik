"use client";

import { Suspense, use, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import type { MangaCard } from "@/lib/api/types";
import { KomikListCard, KomikListSkeleton } from "@/components/komik-list";
import { SectionHead, ErrorState, EmptyState } from "@/components/states";

interface LatestPayload {
  items: MangaCard[];
  hasNextPage: boolean;
}

const ORDERBYS = [
  { v: "modified", label: "Update" },
  { v: "date", label: "Judul Baru" },
  { v: "popular", label: "Peringkat" },
  { v: "rand", label: "Acak" },
] as const;

type Orderby = (typeof ORDERBYS)[number]["v"];

const TIPES = [
  { v: "", label: "Tipe" },
  { v: "manga", label: "Manga" },
  { v: "manhua", label: "Manhua" },
  { v: "manhwa", label: "Manhwa" },
] as const;

function GenreDetailContent({ slug }: { slug: string }) {
  const router = useRouter();
  const sp = useSearchParams();
  const [orderby, setOrderby] = useState<Orderby>(() => {
    const fromUrl = sp.get("orderby") as Orderby | null;
    if (fromUrl && ORDERBYS.some((o) => o.v === fromUrl)) return fromUrl;
    try {
      const saved = sessionStorage.getItem(`bk-genre-${slug}-orderby`) as Orderby | null;
      if (saved && ORDERBYS.some((o) => o.v === saved)) return saved;
    } catch {
      // abaikan — default modified
    }
    return "modified";
  });
  const [tipe, setTipe] = useState(() => {
    const fromUrl = sp.get("tipe");
    if (fromUrl !== null) return fromUrl;
    try {
      return sessionStorage.getItem(`bk-genre-${slug}-tipe`) ?? "";
    } catch {
      return "";
    }
  });
  const [items, setItems] = useState<MangaCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, o: Orderby, t: string, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        // Pakai /api/latest (endpoint /manga/ + ?genre=) agar mendukung
        // orderby + tipe — endpoint /genre/<slug>/ tidak mendukung keduanya.
        const qs = new URLSearchParams({
          genre: slug,
          page: String(p),
          orderby: o,
        });
        if (t) qs.set("tipe", t);
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
    [slug],
  );

  useEffect(() => {
    load(1, orderby, tipe, false);
    // Pilihan filter ditulis ke URL (replace, tanpa reload) + sessionStorage
    // per-genre agar tidak reset saat buka komik lalu kembali.
    const qs = new URLSearchParams();
    if (orderby !== "modified") qs.set("orderby", orderby);
    if (tipe) qs.set("tipe", tipe);
    router.replace(qs.size > 0 ? `/genre/${slug}?${qs}` : `/genre/${slug}`, {
      scroll: false,
    });
    try {
      sessionStorage.setItem(`bk-genre-${slug}-orderby`, orderby);
      sessionStorage.setItem(`bk-genre-${slug}-tipe`, tipe);
    } catch {
      // storage diblokir — URL saja sudah cukup
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, orderby, tipe]);

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title={`Genre: ${title}`} />
      <div className="grid grid-cols-2 gap-2 sm:mx-0 sm:flex sm:items-center sm:gap-1.5 sm:overflow-x-auto sm:px-0 sm:pb-0.5">
        <select
          value={orderby}
          onChange={(e) => setOrderby(e.target.value as Orderby)}
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
      </div>

      {loading && <KomikListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={() => load(1, orderby, tipe, false)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message={`Tidak ada komik genre "${title}" dari sumber data.`} />
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
              onClick={() => load(page + 1, orderby, tipe, true)}
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

export default function GenreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  return (
    <Suspense fallback={<KomikListSkeleton count={8} />}>
      <GenreDetailContent slug={slug} />
    </Suspense>
  );
}
