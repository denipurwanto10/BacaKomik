"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet, apiGetSWR, invalidateApi, prefetchApi } from "@/lib/client";
import { timeAgo, useHistory } from "@/lib/history";
import type { MangaCard } from "@/lib/api/types";
import { SectionHead, ListSkeleton, ErrorState, EmptyState } from "@/components/states";
import { RankRow, UpdateRow } from "@/components/cards";

/** Acak array (Fisher-Yates) — rekomendasi tampil beda tiap kunjungan. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

interface HomePayload {
  latest: MangaCard[];
  popular: MangaCard[];
  recommended: MangaCard[];
}

/**
 * Section beranda: tampil instan dari cache (basi < 5 mnt) lalu segarkan
 * diam-diam — layar tidak pernah kosong menunggu jaringan.
 */
function useHomeSection<K extends keyof HomePayload>(key: K) {
  const [data, setData] = useState<MangaCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(
    async (fresh = false) => {
      setError(null);
      if (data) setRefreshing(true);
      try {
        if (fresh) invalidateApi("/api/home");
        const res = await apiGetSWR<HomePayload>("/api/home", (home) => {
          setData(home[key]);
          setRefreshing(false);
        });
        setData(res.data ? res.data[key] : null);
        // Kalau data basi, onFresh di atas yang mematikan spinner.
        if (!res.stale) setRefreshing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data.");
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, load, refreshing };
}

/**
 * Section Rekomendasi: tampil acak (dikocok) tiap kunjungan — daftar dari
 * server (?orderby=rand) dikocok ulang di browser agar urutannya beda
 * setiap dibuka, walau data server sempat kena cache.
 */
function useRecommended() {
  const [data, setData] = useState<MangaCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(
    async (fresh = false) => {
      setError(null);
      if (data) setRefreshing(true);
      try {
        if (fresh) invalidateApi("/api/home");
        const res = await apiGetSWR<HomePayload>("/api/home", (home) => {
          setData(home.recommended ? shuffle(home.recommended) : null);
          setRefreshing(false);
        });
        setData(res.data?.recommended ? shuffle(res.data.recommended) : null);
        // Kalau data basi, onFresh di atas yang mematikan spinner.
        if (!res.stale) setRefreshing(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data.");
        setRefreshing(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  useEffect(() => {
    load();
  }, [load]);
  return { data, error, load, refreshing };
}

export default function HomePage() {
  const { entries: history } = useHistory();
  // 1 request gabungan untuk 3 section (hemat handshake, ramah rate limit).
  const popular = useHomeSection("popular");
  const latest = useHomeSection("latest");
  const recommended = useRecommended();

  // Prefetch agresif: selagi user di beranda, panaskan genre + halaman 2
  // terbaru di background agar navigasi berikutnya terasa instan.
  useEffect(() => {
    const t = window.setTimeout(() => {
      prefetchApi("/api/genres");
      prefetchApi("/api/latest?page=2&orderby=modified");
    }, 2500);
    return () => window.clearTimeout(t);
  }, []);

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
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <SectionHead title="Peringkat Harian" href="/populer" />
          </div>
          <button
            onClick={() => {
              popular.load(true);
              latest.load(true);
              recommended.load(true);
            }}
            aria-label="Muat ulang data terbaru"
            title="Muat ulang data terbaru"
            className="flex h-9 w-9 shrink-0 touch-manipulation items-center justify-center rounded-full border border-line text-muted transition-colors hover:border-accent hover:text-accent sm:h-8 sm:w-8 dark:border-line-dark dark:text-muted-dark"
          >
            <svg
              className={`h-4 w-4 ${popular.refreshing || latest.refreshing || recommended.refreshing ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v6h6M20 20v-6h-6M5.6 9a7 7 0 0 1 12.8 0M18.4 15a7 7 0 0 1-12.8 0"
              />
            </svg>
          </button>
        </div>
        {!popular.data && !popular.error && <ListSkeleton count={5} />}
        {popular.error && <ErrorState message={popular.error} onRetry={popular.load} />}
        {popular.data && popular.data.length === 0 && (
          <EmptyState message="Belum ada data peringkat dari sumber data." />
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
          <EmptyState message="Belum ada update dari sumber data." />
        )}
        {latest.data && latest.data.length > 0 && (
          <div className="grid gap-x-6 lg:grid-cols-2">
            {latest.data.slice(0, 12).map((item) => (
              <UpdateRow key={item.slug + (item.latestChapter?.url || "")} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* Rekomendasi — sama seperti Update Terbaru (baris horizontal),
          isinya acak tiap dibuka. */}
      <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
        <SectionHead title="Rekomendasi" href="/terbaru?orderby=rand" />
        {!recommended.data && !recommended.error && <ListSkeleton count={8} />}
        {recommended.data && recommended.data.length === 0 && !recommended.error && (
          <EmptyState message="Belum ada rekomendasi dari sumber data." />
        )}
        {recommended.data && recommended.data.length > 0 && (
          <div className="grid gap-x-6 lg:grid-cols-2">
            {recommended.data.slice(0, 12).map((item) => (
              <UpdateRow key={item.slug + (item.latestChapter?.url || "")} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
