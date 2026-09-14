"use client";

import { use, useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import type { MangaCard } from "@/lib/api/types";
import { MangaGrid, SectionHead, GridSkeleton, ErrorState, EmptyState } from "@/components/states";

interface GenrePayload {
  genre: string;
  page: number;
  items: MangaCard[];
  hasNextPage: boolean;
}

export default function GenreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [items, setItems] = useState<MangaCard[]>([]);
  const [page, setPage] = useState(1);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (p: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await apiGet<GenrePayload>(
          `/api/genre/${encodeURIComponent(slug)}?page=${p}`,
        );
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
    load(1, false);
  }, [load]);

  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title={`Genre: ${title}`} />
      {loading && <GridSkeleton count={12} />}
      {error && <ErrorState message={error} onRetry={() => load(1, false)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState message={`Tidak ada komik genre "${title}" dari Komiku.org.`} />
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <MangaGrid items={items} />
          {hasNext && (
            <button
              onClick={() => load(page + 1, true)}
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
