"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { apiGet, prefetchApi } from "@/lib/client";
import type { NovelChapterData } from "@/lib/api/novel";
import { novelChapterToRoute } from "@/components/novel-list";
import { ErrorState } from "@/components/states";

function TextSkeleton() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse space-y-3">
      <div className="h-6 w-2/3 rounded bg-paper-3 dark:bg-ink-3" />
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="h-4 w-full rounded bg-paper-3 dark:bg-ink-3" />
      ))}
    </div>
  );
}

function NovelNav({
  data,
  top,
}: {
  data: NovelChapterData;
  top?: boolean;
}) {
  return (
    <div
      className={`flex min-w-0 items-center justify-between gap-1.5 rounded-2xl border border-line bg-paper-2 px-1.5 py-1.5 text-sm sm:gap-2 sm:rounded-full sm:px-2 sm:py-2 dark:border-line-dark dark:bg-ink-2 ${top ? "" : "mt-6"}`}
    >
      {data.prevUrl ? (
        <Link
          href={novelChapterToRoute(data.prevUrl)}
          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-2 py-2 text-[13px] font-semibold text-white sm:flex-none sm:rounded-full sm:px-4"
        >
          <span className="truncate">‹ Prev</span>
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 cursor-not-allowed items-center justify-center px-2 py-2 text-[13px] text-muted sm:flex-none sm:px-4 dark:text-muted-dark">
          <span className="truncate">‹ Prev</span>
        </span>
      )}
      <Link
        href={data.listUrl}
        aria-label="Daftar chapter"
        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line px-2 py-2 text-[13px] font-medium text-fg sm:flex-none sm:rounded-full sm:px-3.5 dark:border-line-dark dark:text-fg-dark"
      >
        <span className="truncate">Daftar chapter</span>
      </Link>
      {data.nextUrl ? (
        <Link
          href={novelChapterToRoute(data.nextUrl)}
          onMouseEnter={() => prefetchApi(`/api/novel-chapter?path=${encodeURIComponent(data.nextUrl!)}`)}
          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-2 py-2 text-[13px] font-semibold text-white sm:flex-none sm:rounded-full sm:px-4"
        >
          <span className="truncate">Next ›</span>
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 cursor-not-allowed items-center justify-center px-2 py-2 text-[13px] text-muted sm:flex-none sm:px-4 dark:text-muted-dark">
          <span className="truncate">Next ›</span>
        </span>
      )}
    </div>
  );
}

const FONT_SIZES = [15, 17, 19, 21] as const;

export default function NovelReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = use(params);
  const rest = decodeURIComponent(chapter);
  const path = `/novel/${slug}/${rest}/`;
  const [data, setData] = useState<NovelChapterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fontIdx, setFontIdx] = useState(1);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bk-novel-font");
      const n = parseInt(saved || "", 10);
      if (n >= 0 && n < FONT_SIZES.length) setFontIdx(n);
    } catch {
      // abaikan
    }
  }, []);

  const setFont = (i: number) => {
    const v = Math.min(Math.max(0, i), FONT_SIZES.length - 1);
    setFontIdx(v);
    try {
      localStorage.setItem("bk-novel-font", String(v));
    } catch {
      // abaikan
    }
  };

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    try {
      const d = await apiGet<NovelChapterData>(
        `/api/novel-chapter?path=${encodeURIComponent(path)}`,
      );
      setData(d);
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  useEffect(() => {
    load();
  }, [load]);

  // Prefetch chapter berikutnya saat isi tiba.
  useEffect(() => {
    if (data?.nextUrl) prefetchApi(`/api/novel-chapter?path=${encodeURIComponent(data.nextUrl)}`);
  }, [data]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <TextSkeleton />;

  return (
    <article className="mx-auto min-w-0 max-w-2xl">
      <NovelNav data={data} top />
      <header className="mt-4 text-center">
        <Link
          href={data.listUrl}
          className="text-xs font-semibold text-accent hover:underline"
        >
          {data.novelTitle}
        </Link>
        <h1 className="mt-1 break-words font-display text-lg font-extrabold leading-tight text-fg sm:text-xl dark:text-fg-dark">
          {data.chapterLabel}
        </h1>
        <div className="mt-2 flex items-center justify-center gap-2">
          <button
            onClick={() => setFont(fontIdx - 1)}
            disabled={fontIdx <= 0}
            aria-label="Kecilkan huruf"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm font-bold text-fg disabled:opacity-40 dark:border-line-dark dark:text-fg-dark"
          >
            A−
          </button>
          <button
            onClick={() => setFont(fontIdx + 1)}
            disabled={fontIdx >= FONT_SIZES.length - 1}
            aria-label="Besarkan huruf"
            className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-sm font-bold text-fg disabled:opacity-40 dark:border-line-dark dark:text-fg-dark"
          >
            A+
          </button>
        </div>
      </header>
      <div
        className="mt-4 space-y-4 break-words leading-loose text-fg/90 dark:text-fg-dark/85"
        style={{ fontSize: FONT_SIZES[fontIdx] }}
      >
        {data.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
      <NovelNav data={data} />
    </article>
  );
}
