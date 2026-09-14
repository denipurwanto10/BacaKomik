"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import { timeAgo, useHistory } from "@/lib/history";
import type { MangaCard } from "@/lib/api/types";
import { MangaGrid, SectionHead, GridSkeleton, ListSkeleton, ErrorState, EmptyState } from "@/components/states";
import { RankRow, UpdateRow } from "@/components/cards";

interface LatestPayload {
  items: MangaCard[];
  hasNextPage: boolean;
}

interface PopularPayload {
  period: string;
  items: MangaCard[];
}

/**
 * Tiap section memuat sendiri-sendiri lewat endpoint ringan —
 * section yang datanya tiba duluan langsung tampil tanpa menunggu
 * section lain (sebelumnya satu /api/home menunggu 3 scrape Komiku).
 */
function useSection<T>(key: string, fetcher: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      setData(await fetcher());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, load };
}

export default function HomePage() {
  const { entries: history } = useHistory();
  const popular = useSection("popular", () =>
    apiGet<PopularPayload>("/api/popular?period=harian").then((r) => r.items),
  );
  const latest = useSection("latest", () =>
    apiGet<LatestPayload>("/api/latest?page=1&orderby=modified").then((r) => r.items),
  );
  const recommended = useSection("recommended", () =>
    apiGet<LatestPayload>("/api/latest?page=1&orderby=date").then((r) => r.items),
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-5">
      {/* Terakhir dibaca — hanya tampil bila ada riwayat di perangkat ini */}
      {history.length > 0 && (
        <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
          <SectionHead title="Terakhir Dibaca" href="/riwayat" />
          <div className="rail-scroll -mx-3 flex gap-2.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
            {history.slice(0, 10).map((h) => (
              <Link
                key={h.slug}
                href={h.route}
                className="group w-[104px] shrink-0 snap-start overflow-hidden rounded-xl border border-line bg-paper transition-shadow hover:shadow-md sm:w-[120px] dark:border-line-dark dark:bg-ink"
              >
                <div className="relative aspect-[3/4] w-full overflow-hidden bg-paper-3 dark:bg-ink-3">
                  {h.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={h.cover}
                      alt={h.title}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center p-2 text-center text-[11px] text-muted dark:text-muted-dark">
                      {h.title}
                    </div>
                  )}
                  <span className="absolute bottom-1 left-1 right-1 truncate rounded-md bg-black/70 px-1.5 py-0.5 text-center text-[10px] font-semibold text-white">
                    {h.chapterLabel}
                  </span>
                </div>
                <div className="min-w-0 p-1.5">
                  <p className="truncate text-[11px] font-semibold leading-tight text-fg group-hover:text-accent sm:text-xs dark:text-fg-dark">
                    {h.title}
                  </p>
                  <p className="mt-0.5 truncate text-[10px] text-muted dark:text-muted-dark">
                    {timeAgo(h.updatedAt)}
                    {h.progress > 0 ? ` · ${Math.round(h.progress * 100)}%` : ""}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Peringkat — ringkas di atas untuk mobile */}
      <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
        <SectionHead title="Peringkat Harian" href="/populer" />
        {!popular.data && !popular.error && <ListSkeleton count={5} />}
        {popular.error && <ErrorState message={popular.error} onRetry={popular.load} />}
        {popular.data && popular.data.length === 0 && (
          <EmptyState message="Belum ada data peringkat dari Komiku.org." />
        )}
        {popular.data && popular.data.length > 0 && (
          <div className="grid gap-x-6 lg:grid-cols-2">
            {popular.data.slice(0, 10).map((item) => (
              <RankRow key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Update terbaru */}
      <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
        <SectionHead title="Update Terbaru" href="/terbaru" />
        {!latest.data && !latest.error && <ListSkeleton count={8} />}
        {latest.data && latest.data.length === 0 && !latest.error && (
          <EmptyState message="Belum ada update dari Komiku.org." />
        )}
        {latest.data && latest.data.length > 0 && (
          <div className="grid gap-x-6 lg:grid-cols-2">
            {latest.data.slice(0, 12).map((item) => (
              <UpdateRow key={item.slug + (item.latestChapter?.url || "")} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Rekomendasi */}
      <section className="min-w-0">
        <SectionHead title="Rekomendasi" href="/terbaru?orderby=date" />
        {!recommended.data && !recommended.error && <GridSkeleton count={6} />}
        {recommended.data && recommended.data.length === 0 && !recommended.error && (
          <EmptyState message="Belum ada rekomendasi dari Komiku.org." />
        )}
        {recommended.data && recommended.data.length > 0 && (
          <MangaGrid items={recommended.data.slice(0, 12)} />
        )}
      </section>
    </div>
  );
}
