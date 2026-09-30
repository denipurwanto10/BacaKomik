"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import type { MangaCard } from "@/lib/api/types";
import { MangaGrid, SectionHead, GridSkeleton, ErrorState, EmptyState, ListSkeleton } from "@/components/states";
import { KomikListCard, KomikListSkeleton } from "@/components/komik-list";
import { SearchSuggest } from "@/components/search-suggest";

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

  // Pencarian langsung: ketik → 400 ms setelah berhenti, URL mengikuti
  // (replace, tanpa menumpuk history) dan hasil dimuat otomatis. Tombol
  // "Cari" / Enter tetap jalan seperti biasa (langsung, tanpa nunggu).
  const submit = useCallback(() => {
    if (draft.trim()) router.push(`/cari?q=${encodeURIComponent(draft.trim())}`);
  }, [draft, router]);
  useEffect(() => {
    const t = draft.trim();
    if (!t || t === q) return;
    const id = window.setTimeout(() => router.replace(`/cari?q=${encodeURIComponent(t)}`), 400);
    return () => window.clearTimeout(id);
  }, [draft, q, router]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title="Pencarian" />
      <form
        role="search"
        className="relative flex min-w-0 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="cari-q" className="sr-only">Cari judul komik</label>
        <SearchSuggest
          value={draft}
          onChange={setDraft}
          onSubmit={submit}
          id="cari-q"
          autoFocus
          inputClassName="h-12 w-full min-w-0 rounded-full border border-line bg-paper-2 px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent sm:h-11 sm:text-sm dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark dark:placeholder:text-muted-dark"
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
      {q && !items && !error && <KomikListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={load} />}
      {items && q && items.length === 0 && (
        <EmptyState message={`Tidak ada hasil dari sumber data untuk "${q}". Coba kata kunci lain.`} />
      )}
      {items && items.length > 0 && (
        <div className="min-w-0 divide-y divide-line dark:divide-line-dark">
          {items.map((item) => (
            <KomikListCard key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
          ))}
        </div>
      )}
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
