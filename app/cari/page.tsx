"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import type { MangaCard } from "@/lib/api/types";
import { MangaGrid, SectionHead, GridSkeleton, ErrorState, EmptyState } from "@/components/states";

function CariContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get("q") || "").trim();
  const [draft, setDraft] = useState(q);
  const [items, setItems] = useState<MangaCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setDraft(q), [q]);

  const load = useCallback(async () => {
    if (!q) {
      setItems([]);
      return;
    }
    setError(null);
    setItems(null);
    try {
      const res = await apiGet<{ keyword: string; items: MangaCard[] }>(
        `/api/search?q=${encodeURIComponent(q)}`,
      );
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, [q]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title="Pencarian" />
      <form
        className="relative flex min-w-0 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          if (draft.trim()) router.push(`/cari?q=${encodeURIComponent(draft.trim())}`);
        }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Cari judul komik…"
          autoFocus
          enterKeyHint="search"
          className="h-12 w-full min-w-0 rounded-full border border-line bg-paper-2 px-4 pr-24 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent sm:h-11 sm:text-sm dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark dark:placeholder:text-muted-dark"
        />
        <button
          type="submit"
          className="absolute right-1.5 h-9 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-white sm:h-8 sm:text-xs"
        >
          Cari
        </button>
      </form>

      {q && (
        <p className="truncate text-sm text-muted dark:text-muted-dark">
          Hasil untuk &quot;{q}&quot;
        </p>
      )}
      {!q && <EmptyState message="Ketik judul komik pada kolom pencarian di atas." />}
      {q && !items && !error && <GridSkeleton count={9} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {items && q && items.length === 0 && (
        <EmptyState message={`Tidak ada hasil dari Komiku.org untuk "${q}". Coba kata kunci lain.`} />
      )}
      {items && items.length > 0 && <MangaGrid items={items} />}
    </div>
  );
}

export default function CariPage() {
  return (
    <Suspense fallback={<GridSkeleton count={9} />}>
      <CariContent />
    </Suspense>
  );
}
