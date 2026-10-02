"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { apiGet } from "@/lib/client";
import { isBookmarked, setLatestSeen, toggleBookmark } from "@/lib/bookmarks";
import { getHistoryEntry, type HistoryEntry } from "@/lib/history";
import { consumeCoverMorph, flyCover, prefersReducedMotion } from "@/lib/morph";
import { usePageTitle } from "@/lib/page-title";
import type { MangaCard, MangaDetail } from "@/lib/api/types";
import { chapterPathToRoute, TypeBadge, UpdateRow } from "@/components/cards";
import { ErrorState, EmptyState } from "@/components/states";
import Link from "next/link";

function DetailSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="flex min-w-0 flex-col gap-3 min-[420px]:gap-4 sm:flex-row">
        <div data-cover-slot className="mx-auto h-56 w-32 shrink-0 rounded-xl bg-paper-3 min-[420px]:h-64 min-[420px]:w-44 sm:mx-0 dark:bg-ink-3" />
        <div className="min-w-0 flex-1 space-y-3">
          <div className="h-6 w-3/4 rounded bg-paper-3 dark:bg-ink-3" />
          <div className="h-4 w-1/2 rounded bg-paper-3 dark:bg-ink-3" />
          <div className="h-20 w-full rounded bg-paper-3 dark:bg-ink-3" />
        </div>
      </div>
    </div>
  );
}

interface GenrePayload {
  genre: string;
  page: number;
  items: MangaCard[];
  hasNextPage: boolean;
}

/** Komik Serupa (se-genre): 1 request ringan, gagal diam-diam tanpa merusak detail. */
function useSimilar(detail: MangaDetail | null) {
  const [items, setItems] = useState<MangaCard[] | null>(null);
  useEffect(() => {
    setItems(null);
    const first = detail?.genres[0]?.slug;
    if (!first || !detail) return;
    let cancelled = false;
    apiGet<GenrePayload>(`/api/genre/${encodeURIComponent(first)}`)
      .then((res) => {
        if (!cancelled) {
          setItems(res.items.filter((it) => it.slug !== detail.slug).slice(0, 12));
        }
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detail]);
  return items;
}

export default function MangaDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [detail, setDetail] = useState<MangaDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const similar = useSimilar(detail);
  const [filter, setFilter] = useState("");
  // Urutan daftar chapter: terbaru dulu (bawaan Komiku) atau terlama dulu.
  const [asc, setAsc] = useState(false);
  // Posisi baca tersimpan untuk komik ini (bila pernah dibaca di perangkat ini).
  const [history, setHistory] = useState<HistoryEntry | null>(null);
  const [saved, setSaved] = useState(false);

  // Judul tab mengikuti judul komik (+ genre bila ada). Data sudah ada,
  // jadi nol request tambahan.
  usePageTitle(detail ? [detail.title, detail.genres[0]?.name].filter(Boolean).join(" · ") : null);

  useEffect(() => {
    setHistory(getHistoryEntry(slug));
    setSaved(isBookmarked(slug));
    const onChange = () => {
      setHistory(getHistoryEntry(slug));
      setSaved(isBookmarked(slug));
    };
    window.addEventListener("bk-history-changed", onChange);
    window.addEventListener("bk-bookmarks-changed", onChange);
    return () => {
      window.removeEventListener("bk-history-changed", onChange);
      window.removeEventListener("bk-bookmarks-changed", onChange);
    };
  }, [slug]);

  const load = useCallback(async () => {
    setError(null);
    setDetail(null);
    try {
      const d = await apiGet<MangaDetail>(`/api/manga/${encodeURIComponent(slug)}`);
      setDetail(d);
      // Tandai chapter terbaru sudah terlihat — badge "BARU" di Favorit
      // hilang untuk komik ini sampai ada chapter yang lebih baru.
      if (d.latestChapter?.url && isBookmarked(d.slug)) {
        setLatestSeen(d.slug, d.latestChapter.url);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat data.");
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  // Simpan morph sedini mungkin (sebelum render skeleton pertama) agar
  // tidak hilang karena StrictMode double-render / efek lain.
  const morphRef = useRef(consumeCoverMorph(slug));
  const playedRef = useRef(false);

  // Saat skeleton tampil: terbangkan ghost ke slot cover-nya, lalu
  // teruskan ke hero asli saat data tiba. Tanpa morph = skeleton biasa.
  useEffect(() => {
    const morph = morphRef.current;
    if (!morph || playedRef.current || prefersReducedMotion()) return;
    const slot = document.querySelector<HTMLElement>("[data-cover-slot]");
    if (!slot) return;
    playedRef.current = true;
    void flyCover(morph, slot);
  }, []);

  // Konten tiba: hero asli menggantikan slot skeleton — settle lembut
  // agar "mendarat" dari ghost, lalu bodi masuk berjenjang via CSS.
  useEffect(() => {
    if (!detail || !playedRef.current || prefersReducedMotion()) return;
    const hero = document.querySelector<HTMLElement>("article [data-cover-slot]");
    hero?.closest("article")?.classList.add("morph-play");
    hero?.animate(
      [
        { opacity: 0.35, transform: "scale(0.985)" },
        { opacity: 1, transform: "scale(1)" },
      ],
      { duration: 240, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
  }, [detail]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!detail) return <DetailSkeleton />;

  const chapters = detail.chapters.filter((c) =>
    c.title.toLowerCase().includes(filter.toLowerCase()),
  );
  const ordered = asc ? [...chapters].reverse() : chapters;

  const meta: [string, string][] = [
    ...(detail.type ? [["Tipe", detail.type] as [string, string]] : []),
    ...(detail.theme ? [["Tema", detail.theme]] as [string, string][] : []),
    ...(detail.author ? [["Author", detail.author]] as [string, string][] : []),
    ...(detail.status ? [["Status", detail.status]] as [string, string][] : []),
    ...(detail.rating ? [["Rating", detail.rating]] as [string, string][] : []),
    ...(detail.readingDirection ? [["Cara baca", detail.readingDirection]] as [string, string][] : []),
  ];

  return (
    <article className="morph-in flex min-w-0 flex-col gap-4 sm:gap-6">
      {/* Header: cover + info */}
      <div className="flex min-w-0 flex-col gap-3 rounded-2xl border border-line bg-paper-2 p-3 min-[420px]:p-4 sm:flex-row sm:gap-5 dark:border-line-dark dark:bg-ink-2">
        <div data-cover-slot className="mx-auto w-32 shrink-0 overflow-hidden rounded-xl bg-paper-3 min-[420px]:w-40 sm:mx-0 sm:w-44 dark:bg-ink-3">
          {detail.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={detail.cover} alt={detail.title} loading="eager" fetchPriority="high" decoding="sync" className="aspect-[3/4] w-full object-cover" />
          ) : (
            <div className="flex aspect-[3/4] items-center justify-center p-2 text-center text-xs text-muted dark:text-muted-dark">
              Cover tidak tersedia
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start gap-2">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <TypeBadge type={detail.type} />
              <h1 className="min-w-0 flex-1 break-words font-display text-lg font-extrabold leading-tight text-fg min-[420px]:text-xl sm:text-2xl dark:text-fg-dark">
                {detail.title}
              </h1>
            </div>
            <button
              onClick={(e) => {
                const now = toggleBookmark({
                  slug: detail.slug,
                  title: detail.title,
                  cover: detail.cover,
                  ...(detail.type ? { type: detail.type } : {}),
                  // Bookmark baru langsung menandai chapter terbaru saat ini
                  // sebagai "sudah terlihat" — badge BARU hanya untuk update
                  // yang datang SETELAH ditambahkan ke favorit.
                  ...(detail.latestChapter?.url
                    ? { latestSeen: detail.latestChapter.url }
                    : {}),
                });
                setSaved(now);
                // Pop kecil — konfirmasi tersimpan/hapus terasa fisik.
                const svg = e.currentTarget.querySelector("svg");
                svg?.animate(
                  [
                    { transform: "scale(1)" },
                    { transform: "scale(1.28)" },
                    { transform: "scale(1)" },
                  ],
                  { duration: 260, easing: "cubic-bezier(0.16, 1, 0.3, 1)" },
                );
              }}
              aria-label={saved ? "Hapus dari favorit" : "Simpan ke favorit"}
              aria-pressed={saved}
              title={saved ? "Hapus dari favorit" : "Simpan ke favorit"}
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border transition-colors active:scale-95 ${
                saved
                  ? "border-accent bg-accent-soft text-accent dark:bg-accent-soft-dark"
                  : "border-line text-muted hover:border-accent hover:text-accent dark:border-line-dark dark:text-muted-dark"
              }`}
            >
              <svg viewBox="0 0 24 24" fill={saved ? "currentColor" : "none"} className="h-5 w-5">
                <path
                  d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </div>
          {detail.altTitle && (
            <p className="mt-1 break-words text-[13px] leading-snug text-muted sm:text-sm dark:text-muted-dark">
              {detail.altTitle}
            </p>
          )}
          {detail.genres.length > 0 && (
            <div className="morph-stagger mt-2.5 flex flex-wrap gap-1.5">
              {detail.genres.map((g) => (
                <Link
                  key={g.slug}
                  href={`/genre/${g.slug}`}
                  className="morph-stagger-item rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted hover:border-accent hover:text-accent dark:border-line-dark dark:text-muted-dark"
                >
                  {g.name}
                </Link>
              ))}
            </div>
          )}
          {meta.length > 0 && (
            <dl className="morph-stagger mt-3 grid min-w-0 grid-cols-1 gap-x-4 gap-y-1.5 text-[13px] min-[420px]:grid-cols-2 sm:max-w-md sm:text-sm">
              {meta.map(([k, v]) => (
                <div key={k} className="morph-stagger-item flex min-w-0 gap-1.5">
                  <dt className="shrink-0 text-muted dark:text-muted-dark">{k}:</dt>
                  <dd className="min-w-0 flex-1 break-words font-medium text-fg dark:text-fg-dark">{v}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="morph-stagger mt-4 flex min-w-0 flex-col gap-2 min-[420px]:flex-row min-[420px]:flex-wrap">
            {history && (
              <Link
                href={history.route}
                className="morph-stagger-item min-w-0 flex-1 truncate rounded-full bg-gradient-to-br from-accent to-accent-strong px-5 py-2.5 text-center text-sm font-semibold text-white transition-transform active:scale-[0.98] min-[420px]:flex-none sm:order-2"
              >
                Lanjutkan · {history.chapterLabel}
                {history.progress > 0 ? ` (${Math.round(history.progress * 100)}%)` : ""}
              </Link>
            )}
            {detail.latestChapter && !history && (
              <Link
                href={chapterPathToRoute(detail.latestChapter.url)}
                className="morph-stagger-item min-w-0 flex-1 truncate rounded-full bg-gradient-to-br from-accent to-accent-strong px-5 py-2.5 text-center text-sm font-semibold text-white transition-transform active:scale-[0.98] min-[420px]:flex-none sm:order-2"
              >
                Lanjut · {detail.latestChapter.label}
              </Link>
            )}
            {detail.latestChapter && history && (
              <Link
                href={chapterPathToRoute(detail.latestChapter.url)}
                className="morph-stagger-item min-w-0 flex-1 truncate rounded-full border border-line px-5 py-2.5 text-center text-sm font-semibold text-fg min-[420px]:flex-none dark:border-line-dark dark:text-fg-dark sm:order-3"
              >
                Terbaru · {detail.latestChapter.label}
              </Link>
            )}
            {detail.firstChapter && (
              <Link
                href={chapterPathToRoute(detail.firstChapter.url)}
                className="morph-stagger-item min-w-0 flex-1 truncate rounded-full border border-line px-5 py-2.5 text-center text-sm font-semibold text-fg min-[420px]:flex-none dark:border-line-dark dark:text-fg-dark sm:order-1"
              >
                Baca dari awal
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Sinopsis — dibungkus kartu seperti section beranda */}
      {detail.synopsis && (
        <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
          <h2 className="mb-2 flex items-center gap-2 font-display text-base font-bold text-fg dark:text-fg-dark">
            <span className="h-4 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-accent to-accent-strong" />
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
            <span className="h-4 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-accent to-accent-strong" />
            <span className="truncate">Daftar Chapter ({detail.chapters.length})</span>
          </h2>
          {detail.chapters.length > 1 && (
            <button
              onClick={() => setAsc((a) => !a)}
              aria-label={asc ? "Urutkan terbaru dulu" : "Urutkan terlama dulu"}
              title={asc ? "Terbaru dulu" : "Terlama dulu"}
              className="flex shrink-0 items-center gap-1 rounded-full border border-line bg-paper px-3 py-1.5 text-[11px] font-semibold text-muted hover:border-accent hover:text-accent sm:text-xs dark:border-line-dark dark:bg-ink dark:text-muted-dark"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5">
                <path
                  d="M7 4v13m0 0-3.5-3.5M7 17l3.5-3.5M17 20V7m0 0 3.5 3.5M17 7l-3.5 3.5"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
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
          <EmptyState message="Belum ada chapter untuk komik ini di sumber data." />
        )}
        {chapters.length === 0 && detail.chapters.length > 0 && (
          <EmptyState message={`Tidak ada chapter yang cocok dengan "${filter}".`} />
        )}
        <div className="chapter-scroll max-h-[480px] min-w-0 divide-y divide-line overflow-y-auto rounded-xl border border-line bg-paper dark:divide-line-dark dark:border-line-dark dark:bg-ink">
          {ordered.map((c) => {
            const isRead = !!history && c.url.includes(`-chapter-${history.chapter}/`);
            return (
              <Link
                key={c.url}
                href={chapterPathToRoute(c.url)}
                className="flex min-w-0 items-center justify-between gap-2 bg-paper px-3 py-3 text-sm min-[420px]:px-4 hover:bg-paper-3 dark:bg-ink dark:hover:bg-ink-3"
              >
                <span
                  className={`min-w-0 flex-1 truncate font-semibold ${isRead ? "text-muted dark:text-muted-dark" : "text-accent"}`}
                >
                  {isRead ? "✓ " : ""}
                  {c.title}
                </span>
                {c.date && <span className="shrink-0 text-[11px] tabular-nums text-muted sm:text-xs dark:text-muted-dark">{c.date}</span>}
              </Link>
            );
          })}
        </div>
      </section>

      {/* Komik Serupa — 12 judul se-genre utama (tanpa judul saat ini),
          dibungkus kartu + baris horizontal seperti section beranda.
          Gagal fetch = section hilang diam-diam, detail tetap utuh. */}
      {similar !== null && similar.length > 0 && detail.genres[0] && (
        <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
          <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
            <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold text-fg dark:text-fg-dark">
              <span className="h-4 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-accent to-accent-strong" />
              <span className="truncate">Serupa: {detail.genres[0].name}</span>
            </h2>
            <Link
              href={`/genre/${detail.genres[0].slug}`}
              className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-accent hover:underline"
            >
              Lihat semua
            </Link>
          </div>
          <div className="grid gap-x-6 lg:grid-cols-2">
            {similar.map((item) => (
              <UpdateRow key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
