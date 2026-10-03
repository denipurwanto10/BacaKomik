"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import { usePageTitle } from "@/lib/page-title";
import type { MangaCard } from "@/lib/api/types";
import { SectionHead, ListSkeleton, ErrorState, EmptyState } from "@/components/states";
import { RankRow } from "@/components/cards";

const PERIODS = [
  { v: "harian", label: "Harian" },
  { v: "mingguan", label: "Mingguan" },
  { v: "bulanan", label: "Bulanan" },
  { v: "total", label: "Semua waktu" },
] as const;

function PopulerContent() {
  const sp = useSearchParams();
  const raw = sp.get("period") || "harian";
  const period = PERIODS.some((p) => p.v === raw) ? raw : "harian";
  usePageTitle(
    `Peringkat ${PERIODS.find((p) => p.v === period)?.label ?? "Harian"}`,
  );
  const [items, setItems] = useState<MangaCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const res = await apiGet<{ period: string; items: MangaCard[] }>(
        `/api/popular?period=${period}`,
      );
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, [period]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title="Peringkat Komik" />
      <div className="rail-scroll -mx-3 flex gap-1.5 overflow-x-auto px-3 pb-0.5 sm:mx-0 sm:px-0">
        {PERIODS.map((p) => {
          const active = period === p.v;
          return (
            <Link
              key={p.v}
              href={p.v === "harian" ? "/populer" : `/populer?period=${p.v}`}
              className={`shrink-0 rounded-full border px-3.5 py-2 text-xs font-semibold transition-colors sm:py-1.5 ${
                active
                  ? "border-transparent bg-gradient-to-br from-accent to-accent-strong text-white"
                  : "border-line text-muted hover:text-fg dark:border-line-dark dark:text-muted-dark dark:hover:text-fg-dark"
              }`}
            >
              {p.label}
            </Link>
          );
        })}
      </div>
      {!items && !error && <ListSkeleton count={10} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {items && items.length === 0 && (
        <EmptyState message="Belum ada data peringkat dari sumber data." />
      )}
      {items && items.length > 0 && (
        <div className="grid min-w-0 gap-x-8 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 lg:grid-cols-2 dark:border-line-dark dark:bg-ink-2">
          {items.map((item) => (
            <RankRow key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PopulerPage() {
  return (
    <Suspense fallback={<ListSkeleton count={10} />}>
      <PopulerContent />
    </Suspense>
  );
}
