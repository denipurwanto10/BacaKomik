"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiGet } from "@/lib/client";
import type { GenreRef } from "@/lib/api/types";
import { SectionHead, ErrorState, EmptyState } from "@/components/states";

function GenreSkeleton() {
  return (
    <div className="grid animate-pulse grid-cols-2 gap-1.5 min-[420px]:gap-2 sm:grid-cols-3 md:grid-cols-4">
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} className="h-12 rounded-xl bg-paper-3 dark:bg-ink-3" />
      ))}
    </div>
  );
}

export default function GenreListPage() {
  const [genres, setGenres] = useState<GenreRef[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  const load = useCallback(async () => {
    setError(null);
    setGenres(null);
    try {
      setGenres(await apiGet<GenreRef[]>("/api/genres"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (genres || []).filter((g) =>
    g.name.toLowerCase().includes(q.trim().toLowerCase()),
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title="Daftar Genre" />
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Ketik nama genre…"
        enterKeyHint="search"
        className="h-12 w-full min-w-0 rounded-full border border-line bg-paper-2 px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent sm:h-10 sm:max-w-xs sm:text-sm dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark dark:placeholder:text-muted-dark"
      />
      {!genres && !error && <GenreSkeleton />}
      {error && <ErrorState message={error} onRetry={load} />}
      {genres && filtered.length === 0 && (
        <EmptyState
          message={
            q ? `Genre "${q}" tidak ditemukan.` : "Belum ada genre dari sumber data."
          }
        />
      )}
      {filtered.length > 0 && (
        <div className="grid min-w-0 grid-cols-2 gap-1.5 min-[420px]:gap-2 sm:grid-cols-3 md:grid-cols-4">
          {filtered.map((g) => (
            <Link
              key={g.slug}
              href={`/genre/${g.slug}`}
              className="flex min-h-12 min-w-0 items-center justify-between gap-2 rounded-xl border border-line bg-paper-2 px-3 py-2.5 transition-colors hover:border-accent min-[420px]:px-3.5 min-[420px]:py-3 dark:border-line-dark dark:bg-ink-2"
            >
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-fg sm:text-sm dark:text-fg-dark">{g.name}</span>
              {typeof g.count === "number" && (
                <span className="shrink-0 rounded-full bg-paper-3 px-1.5 py-0.5 text-[10px] tabular-nums text-muted min-[420px]:px-2 min-[420px]:text-[11px] dark:bg-ink-3 dark:text-muted-dark">
                  {g.count.toLocaleString("id-ID")}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
