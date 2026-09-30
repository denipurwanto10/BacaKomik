"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet } from "@/lib/client";
import type { NovelCard } from "@/lib/api/novel";
import { SectionHead, GridSkeleton, ErrorState, EmptyState } from "@/components/states";
import { NovelListCard, NovelListSkeleton } from "@/components/novel-list";
import { Pagination } from "@/components/pagination";

interface NovelListPayload {
  items: NovelCard[];
  hasNextPage: boolean;
}

/** Halaman dari URL (?page=N). Default 1. */
function parsePage(raw: string | null): number {
  const n = parseInt(raw || "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 100) return 1;
  return n;
}

function NovelContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const q = (sp.get("q") || "").trim();
  const [draft, setDraft] = useState(q);
  const [page, setPage] = useState<number>(() => parsePage(sp.get("page")));
  const [items, setItems] = useState<NovelCard[] | null>(null);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(true);
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

  const loadPage = useCallback(async (kw: string, p: number) => {
    setLoading(true);
    setError(null);
    setItems(null);
    try {
      const qs = new URLSearchParams({ page: String(p) });
      if (kw) qs.set("q", kw);
      const res = await apiGet<NovelListPayload>(`/api/novels?${qs}`);
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

  // Kata kunci berubah: kembali ke halaman 1.
  useEffect(() => {
    if (appliedQRef.current === q) return;
    appliedQRef.current = q;
    scrollToList();
    void loadPage(q, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  const goTo = useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), 100);
      if (target === page || loading) return;
      scrollToList();
      const qs = new URLSearchParams();
      if (q) qs.set("q", q);
      if (target > 1) qs.set("page", String(target));
      router.replace(`/novel?${qs}`, { scroll: false });
      void loadPage(q, target);
    },
    [page, loading, loadPage, scrollToList, q, router],
  );

  // Pencarian langsung: ketik → 400 ms diam, URL mengikuti, hasil dimuat.
  const submit = useCallback(() => {
    if (draft.trim()) router.push(`/novel?q=${encodeURIComponent(draft.trim())}`);
  }, [draft, router]);
  useEffect(() => {
    const t = draft.trim();
    if (!t || t === q) return;
    const id = window.setTimeout(() => router.replace(`/novel?q=${encodeURIComponent(t)}`), 400);
    return () => window.clearTimeout(id);
  }, [draft, q, router]);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <SectionHead title="Novel" />
      <form
        role="search"
        className="relative flex min-w-0 items-center"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <label htmlFor="novel-q" className="sr-only">Cari novel</label>
        <input
          id="novel-q"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Cari judul novel…"
          autoFocus
          className="h-12 w-full min-w-0 rounded-full border border-line bg-paper-2 px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent sm:h-11 sm:text-sm dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark dark:placeholder:text-muted-dark"
        />
        <button
          type="submit"
          className="absolute right-1.5 h-9 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-white sm:h-8 sm:text-xs"
        >
          Cari
        </button>
      </form>

      <div ref={listTopRef} className="scroll-mt-16">
        {q ? (
          <p className="truncate text-sm text-muted dark:text-muted-dark">
            Hasil untuk &quot;{q}&quot;
            {page > 1 && ` — halaman ${page}`}
          </p>
        ) : (
          <p className="text-sm text-muted dark:text-muted-dark">
            Novel &amp; light novel dari sumber data Meionovels.
          </p>
        )}
      </div>

      {loading && <NovelListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={() => loadPage(q, page)} />}
      {!loading && !error && items && items.length === 0 && (
        <EmptyState
          message={
            q
              ? `Tidak ada novel dari sumber data untuk "${q}". Coba kata kunci lain.`
              : "Belum ada novel dari sumber data."
          }
        />
      )}
      {!loading && !error && items && items.length > 0 && (
        <>
          <div className="min-w-0 divide-y divide-line dark:divide-line-dark">
            {items.map((item) => (
              <NovelListCard key={item.slug} item={item} />
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

export default function NovelPage() {
  return (
    <Suspense fallback={<GridSkeleton count={9} />}>
      <NovelContent />
    </Suspense>
  );
}
