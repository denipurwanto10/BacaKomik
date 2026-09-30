"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import type { MangaCard } from "@/lib/api/types";
import { SectionHead, GridSkeleton, ErrorState, EmptyState } from "@/components/states";
import { KomikListCard, KomikListSkeleton } from "@/components/komik-list";
import { Pagination } from "@/components/pagination";
import { SearchSuggest } from "@/components/search-suggest";

interface SearchPayload {
  keyword: string;
  items: MangaCard[];
  hasNextPage: boolean;
}

/** Halaman dari URL (?page=N). Default 1. */
function parsePage(raw: string | null): number {
  const n = parseInt(raw || "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 50) return 1;
  return n;
}

function CariContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get("q") || "").trim();
  const [draft, setDraft] = useState(q);
  const [page, setPage] = useState<number>(() => parsePage(sp.get("page")));
  const [items, setItems] = useState<MangaCard[] | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bootedRef = useRef(false);
  const appliedQRef = useRef(q);
  const listTopRef = useRef<HTMLDivElement>(null);

  useEffect(() => setDraft(q), [q]);

  const scrollToList = useCallback(() => {
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ block: "start" });
    });
  }, []);

  // Muat satu halaman penuh (mengganti daftar, bukan menumpuk).
  const loadPage = useCallback(async (kw: string, p: number) => {
    if (!kw) {
      setItems([]);
      setHasNext(false);
      return;
    }
    setLoading(true);
    setError(null);
    setItems(null);
    try {
      const res = await apiGet<SearchPayload>(
        `/api/search?q=${encodeURIComponent(kw)}&page=${p}`,
      );
      setItems(res.items);
      setHasNext(res.hasNextPage);
      setPage(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Mount pertama: buka halaman sesuai URL.
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    appliedQRef.current = q;
    void loadPage(q, parsePage(sp.get("page")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kata kunci berubah (bukan mount): kembali ke halaman 1.
  useEffect(() => {
    if (appliedQRef.current === q) return;
    appliedQRef.current = q;
    scrollToList();
    void loadPage(q, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  // Pindah halaman via pagination (URL ditulis agar bertahan saat refresh).
  const goTo = useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), 50);
      if (target === page || loading) return;
      scrollToList();
      const qs = new URLSearchParams({ q });
      if (target > 1) qs.set("page", String(target));
      router.replace(`/cari?${qs}`, { scroll: false });
      void loadPage(q, target);
    },
    [page, loading, loadPage, scrollToList, q, router],
  );

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
          enabled={false}
          inputClassName="h-12 w-full min-w-0 rounded-full border border-line bg-paper-2 px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent sm:h-11 sm:text-sm dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark dark:placeholder:text-muted-dark"
        />
        <button
          type="submit"
          className="absolute right-1.5 h-9 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-white sm:h-8 sm:text-xs"
        >
          Cari
        </button>
      </form>

      <div ref={listTopRef} className="scroll-mt-16">
        {q && (
          <p className="truncate text-sm text-muted dark:text-muted-dark">
            Hasil untuk &quot;{q}&quot;
            {page > 1 && ` — halaman ${page}`}
          </p>
        )}
      </div>
      {!q && <EmptyState message="Ketik judul komik pada kolom pencarian di atas." />}
      {q && loading && <KomikListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={() => loadPage(q, page)} />}
      {!loading && !error && items && q && items.length === 0 && (
        <EmptyState message={`Tidak ada hasil dari sumber data untuk "${q}". Coba kata kunci lain.`} />
      )}
      {!loading && !error && items && items.length > 0 && (
        <>
          <div className="min-w-0 divide-y divide-line dark:divide-line-dark">
            {items.map((item) => (
              <KomikListCard key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
            ))}
          </div>
          <div className="mt-3 sm:mt-4">
            <Pagination page={page} hasNext={hasNext} pending={loading} onChange={goTo} />
          </div>
        </>
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
