"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiGet } from "@/lib/client";
import type { NovelDetail } from "@/lib/api/novel";
import { ErrorState, EmptyState } from "@/components/states";
import { novelChapterToRoute } from "@/components/novel-list";

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex min-w-0 flex-col gap-3 min-[420px]:gap-4 sm:flex-row">
        <div className="mx-auto h-56 w-32 shrink-0 rounded-xl bg-paper-3 min-[420px]:h-64 min-[420px]:w-44 sm:mx-0 dark:bg-ink-3" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-6 w-3/4 rounded bg-paper-3 dark:bg-ink-3" />
          <div className="h-4 w-1/2 rounded bg-paper-3 dark:bg-ink-3" />
          <div className="h-20 w-full rounded bg-paper-3 dark:bg-ink-3" />
        </div>
      </div>
    </div>
  );
}

export default function NovelDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [detail, setDetail] = useState<NovelDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [asc, setAsc] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    setDetail(null);
    try {
      const d = await apiGet<NovelDetail>(`/api/novel/${encodeURIComponent(slug)}`);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <DetailSkeleton />;

  const chapters = detail.chapters.filter((c) =>
    c.label.toLowerCase().includes(filter.toLowerCase()),
  );
  const ordered = asc ? [...chapters].reverse() : chapters;

  const meta: [string, string][] = [
    ...(detail.author ? [["Penulis", detail.author] as [string, string]] : []),
    ...(detail.status ? [["Status", detail.status]] as [string, string][] : []),
    ...(detail.rating ? [["Rating", detail.rating]] as [string, string][] : []),
  ];

  return (
    <article className="flex min-w-0 flex-col gap-4 sm:gap-6">
      {/* Header: cover + info */}
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-paper-2 p-3 min-[420px]:p-4 sm:flex-row sm:gap-5 dark:border-line-dark dark:bg-ink-2">
        <div className="mx-auto w-32 shrink-0 overflow-hidden rounded-xl bg-paper-3 min-[420px]:w-40 sm:mx-0 sm:w-44 dark:bg-ink-3">
          {detail.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.cover} alt={detail.title} className="aspect-[3/4] w-full object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center p-2 text-center text-xs text-muted dark:text-muted-dark">
              Cover tidak tersedia
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <span className="mt-1 shrink-0 rounded-full bg-ink/70 px-2 py-0.5 text-[10px] font-bold text-white">
              Novel
            </span>
            <h1 className="min-w-0 flex-1 break-words font-display text-lg font-extrabold leading-tight text-fg min-[420px]:text-xl sm:text-2xl dark:text-fg-dark">
              {detail.title}
            </h1>
          </div>
          {detail.genres.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {detail.genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted dark:border-line-dark dark:text-muted-dark"
                >
                  {g}
                </span>
              ))}
            </div>
          )}
          {meta.length > 0 && (
            <dl className="mt-3 grid min-w-0 grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] min-[420px]:grid-cols-2 sm:max-w-md sm:text-sm">
              {meta.map(([k, v]) => (
                <div key={k} className="flex min-w-0 gap-1.5">
                  <dt className="shrink-0 text-muted dark:text-muted-dark">{k}:</dt>
                  <dd className="min-w-0 flex-1 break-words font-medium text-fg dark:text-fg-dark">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="mt-4 flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap">
            {detail.latestChapter && (
              <Link
                href={novelChapterToRoute(detail.latestChapter.url)}
                className="min-w-0 flex-1 truncate rounded-full bg-accent px-5 py-2.5 text-center text-sm font-semibold text-white shadow-sm shadow-accent/30 transition-transform active:scale-[0.98] min-[420px]:flex-none"
              >
                Lanjut · {detail.latestChapter.label}
              </Link>
            )}
            {detail.firstChapter && (
              <Link
                href={novelChapterToRoute(detail.firstChapter.url)}
                className="min-w-0 flex-1 truncate rounded-full border border-line px-5 py-2.5 text-center text-sm font-semibold text-fg min-[420px]:flex-none dark:border-line-dark dark:text-fg-dark"
              >
                Baca dari awal
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Sinopsis */}
      {detail.synopsis && (
        <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-fg dark:text-fg-dark">
            <span className="h-4 w-1.5 shrink-0 rounded-full bg-accent" />
            Sinopsis
          </h2>
          <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-fg/85 sm:text-sm dark:text-fg-dark/80">
            {detail.synopsis}
          </p>
        </section>
      )}

      {/* Daftar chapter */}
      <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold text-fg dark:text-fg-dark">
            <span className="h-4 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="truncate">Daftar Chapter ({detail.chapters.length})</span>
          </h2>
          {detail.chapters.length > 1 && (
            <button
              onClick={() => setAsc((a) => !a)}
              aria-label={asc ? "Urutkan terbaru dulu" : "Urutkan terlama dulu"}
              className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-semibold text-muted hover:border-accent hover:text-accent sm:text-xs dark:border-line-dark dark:bg-ink dark:text-muted-dark"
            >
              {asc ? "Terlama" : "Terbaru"}
            </button>
          )}
        </div>
        {detail.chapters.length > 10 && (
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Cari chapter..."
            aria-label="Cari chapter"
            enterKeyHint="search"
            className="mb-2 h-12 w-full min-w-0 rounded-full border border-line bg-paper px-4 text-base text-fg outline-none focus-visible:border-accent sm:h-10 sm:max-w-xs sm:text-sm dark:border-line-dark dark:bg-ink dark:text-fg-dark"
          />
        )}
        {detail.chapters.length === 0 && (
          <EmptyState message="Belum ada chapter untuk novel ini di sumber data." />
        )}
        {chapters.length === 0 && detail.chapters.length > 0 && (
          <EmptyState message={`Tidak ada chapter yang cocok dengan "${filter}".`} />
        )}
        <div className="chapter-scroll max-h-[480px] min-w-0 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-paper dark:divide-line-dark dark:border-line-dark dark:bg-ink">
          {ordered.map((c) => (
            <Link
              key={c.url}
              href={novelChapterToRoute(c.url)}
              className="flex min-w-0 items-center justify-between gap-2 bg-paper px-3 py-3 text-sm min-[420px]:px-4 hover:bg-paper-3 dark:bg-ink dark:hover:bg-ink-3"
            >
              <span className="min-w-0 flex-1 truncate font-semibold text-accent">
                {c.label}
              </span>
              {c.time && <span className="shrink-0 text-[11px] tabular-nums text-muted sm:text-xs dark:text-muted-dark">{c.time}</span>}
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
