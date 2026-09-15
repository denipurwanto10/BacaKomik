"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, peekApiCache, prefetchApi } from "@/lib/client";
import { getHistoryEntry, saveHistory } from "@/lib/history";
import type { ChapterData, MangaDetail } from "@/lib/api/types";
import { chapterPathToRoute } from "@/components/cards";
import { ErrorState } from "@/components/states";

function ReaderSkeleton() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse space-y-2">
      <div className="h-6 w-2/3 rounded bg-paper-3 dark:bg-ink-3" />
      {[70, 55, 80].map((h, i) => (
        <div key={i} className="w-full rounded bg-paper-3 dark:bg-ink-3" style={{ height: h * 6 }} />
      ))}
    </div>
  );
}

function IconChevron({ dir, className }: { dir: "left" | "right"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d={dir === "left" ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"}
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconList({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 19V5m0 0l-6 6m6-6l6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Hitung href Prev/Next chapter — dipakai nav atas/bawah + overlay tap. */
function navHrefs(
  data: ChapterData | null,
  slug: string,
  chapter: string,
): { prevHref: string | null; nextHref: string | null } {
  const toNum = (c: string) => parseFloat(c.replace(/-(\d+)$/, ".$1"));
  const cur = toNum(chapter);
  const prevHref = data?.prevUrl ? chapterPathToRoute(data.prevUrl) : null;
  const nextHref = data?.nextUrl
    ? chapterPathToRoute(data.nextUrl)
    : !data?.prevUrl && Number.isFinite(cur)
      ? `/baca/${slug}/${String(cur + 1).replace(".", "-")}`
      : null;
  return { prevHref, nextHref };
}

function ChapterNav({
  data,
  slug,
  chapter,
}: {
  data: ChapterData | null;
  slug: string;
  chapter: string;
}) {
  // nextUrl akurat dari server (daftar chapter). Bila absen (gagal scrape
  // daftar / chapter terbaru), tebak +1 seperti sebelumnya.
  const { prevHref, nextHref } = navHrefs(data, slug, chapter);

  return (
    <div className="flex min-w-0 items-center justify-between gap-1.5 rounded-2xl border border-line-dark bg-ink-2 px-1.5 py-1.5 text-sm sm:gap-2 sm:rounded-full sm:px-2 sm:py-2">
      {prevHref ? (
        <Link
          href={prevHref}
          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-2 py-2 text-[13px] font-semibold text-white sm:flex-none sm:rounded-full sm:px-4"
        >
          <IconChevron dir="left" className="h-4 w-4 shrink-0" />
          <span className="truncate">Prev</span>
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-1 px-2 py-2 text-[13px] text-muted-dark sm:flex-none sm:px-4">
          <IconChevron dir="left" className="h-4 w-4 shrink-0" />
          <span className="truncate">Prev</span>
        </span>
      )}

      <Link
        href={`/komik/${slug}`}
        aria-label="Daftar isi"
        className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-dark px-2 py-2 text-[13px] font-medium text-fg-dark sm:flex-none sm:rounded-full sm:px-3.5"
      >
        <IconList className="h-4 w-4 shrink-0" />
        <span className="hidden truncate sm:inline">Daftar isi</span>
        <span className="truncate sm:hidden">Isi</span>
      </Link>

      {nextHref ? (
        <Link
          href={nextHref}
          className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border border-line-dark px-2 py-2 text-[13px] font-medium text-fg-dark sm:flex-none sm:rounded-full sm:px-4"
        >
          <span className="truncate">Next</span>
          <IconChevron dir="right" className="h-4 w-4 shrink-0" />
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-1 px-2 py-2 text-[13px] text-muted-dark sm:flex-none sm:px-4">
          <span className="truncate">Next</span>
          <IconChevron dir="right" className="h-4 w-4 shrink-0" />
        </span>
      )}
    </div>
  );
}

export default function ReaderPage({
  params,
}: {
  params: Promise<{ slug: string; chapter: string }>;
}) {
  const { slug, chapter } = use(params);
  const router = useRouter();
  const [data, setData] = useState<ChapterData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failed, setFailed] = useState<Set<number>>(new Set());
  const [progress, setProgress] = useState(0);
  const pagesRef = useRef<HTMLDivElement>(null);
  // Progres terakhir yang sudah tersimpan — ditulis ulang hanya saat
  // melewati kelipatan 10% agar tidak menulis localStorage tiap scroll.
  const savedProgressRef = useRef(0);
  // Indeks gambar 0-based terakhir terlihat (untuk persist posisi halaman).
  const pageNumRef = useRef(0);
  // Mode baca: "scroll" (semua halaman memanjang) atau "page" (satu per satu).
  const [mode, setMode] = useState<"scroll" | "page">("scroll");
  const [pageIdx, setPageIdx] = useState(0);
  // Dropdown pindah chapter: daftar dari cache detail (hasil prefetch kartu).
  const [chapters, setChapters] = useState<MangaDetail["chapters"] | null>(null);
  // Restore posisi sekali per chapter (mode scroll: rasio scroll, mode page:
  // indeks halaman). Diambil dari riwayat sebelum overwrite persist awal.
  const restoredRef = useRef("");
  const [restorePct, setRestorePct] = useState<number | null>(null);
  // Penanda persist-awal sudah jalan untuk chapter ini (efek jalan ulang
  // saat restore selesai / mode diganti — persist 0 hanya sekali).
  const initPersistRef = useRef("");
  // Overlay navigasi chapter (Prev / Daftar isi / Next) — muncul saat gambar
  // di-tap (mobile) atau tombol daftar ditekan. Auto-sembunyi 6 detik.
  const [showTapNav, setShowTapNav] = useState(false);
  // Tombol kembali-ke-atas — muncul setelah user scroll cukup jauh.
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bk-reader-mode");
      if (saved === "page" || saved === "scroll") setMode(saved);
    } catch {
      // abaikan — default scroll
    }
  }, []);

  const switchMode = (m: "scroll" | "page") => {
    setMode(m);
    try {
      localStorage.setItem("bk-reader-mode", m);
    } catch {
      // abaikan
    }
  };

  const load = useCallback(async () => {
    setError(null);
    setData(null);
    setFailed(new Set());
    setPageIdx(0);
    setProgress(0);
    setShowTapNav(false);
    setShowTop(false);
    setRestorePct(null);
    setChapters(null);
    pageNumRef.current = 0;
    savedProgressRef.current = 0;
    // Posisi tersimpan chapter ini (bila dibuka ulang) — dibaca SEBELUM
    // persist awal menimpanya; restore dilakukan sekali setelah gambar siap.
    const prev = getHistoryEntry(slug);
    const sameChapter = prev && prev.chapter === chapter;
    const savedPage =
      sameChapter && typeof prev.page === "number" && prev.page >= 0 ? prev.page : 0;
    const savedPct =
      sameChapter && prev.progress > 0 && prev.progress < 1 ? prev.progress : null;
    try {
      setData(
        await apiGet<ChapterData>(
          `/api/chapter/${encodeURIComponent(slug)}/${encodeURIComponent(chapter)}`,
        ),
      );
      // Daftar chapter untuk dropdown: dari cache detail bila ada
      // (hasil hover-prefetch kartu / kunjungan halaman detail),
      // kalau tidak ada fetch ringan di background (lihat effect di bawah).
      const cached = peekApiCache<MangaDetail>(`/api/manga/${encodeURIComponent(slug)}`);
      if (cached) {
        setChapters(cached.chapters);
        // Panaskan prev/next chapter dari daftar agar dropdown terasa instan.
        const idx = cached.chapters.findIndex((c) =>
          c.url.includes(`-chapter-${chapter}/`),
        );
        for (const j of [idx - 1, idx + 1]) {
          const tok = cached.chapters[j]?.url.match(/-chapter-(.+?)\/?$/)?.[1];
          if (tok) {
            prefetchApi(
              `/api/chapter/${encodeURIComponent(slug)}/${encodeURIComponent(tok)}`,
            );
          }
        }
      }
      const key = `${slug}/${chapter}`;
      if (restoredRef.current !== key && (savedPage > 0 || savedPct !== null)) {
        restoredRef.current = key;
        setPageIdx(savedPage);
        pageNumRef.current = savedPage;
        setRestorePct(savedPct);
      } else {
        window.scrollTo({ top: 0 });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat chapter.");
    }
  }, [slug, chapter]);

  useEffect(() => {
    load();
  }, [load]);

  // Panaskan chapter berikutnya selagi user membaca — tombol Next terasa instan.
  useEffect(() => {
    if (!data) return;
    if (data.nextUrl) {
      prefetchApi(
        `/api/chapter/${encodeURIComponent(data.mangaSlug)}/${encodeURIComponent(
          chapterPathToRoute(data.nextUrl).split("/").pop() ?? "",
        )}`,
      );
      return;
    }
    const toNum = (c: string) => parseFloat(c.replace(/-(\d+)$/, ".$1"));
    const cur = toNum(chapter);
    if (!data.prevUrl && Number.isFinite(cur)) {
      const next = String(cur + 1).replace(".", "-");
      prefetchApi(`/api/chapter/${encodeURIComponent(data.mangaSlug)}/${encodeURIComponent(next)}`);
    }
  }, [data, chapter]);

  // Dropdown chapter: bila dibuka langsung (tanpa lewat detail/kartu),
  // cache kosong — ambil daftar dari server di background, 1 request.
  // Gagal = dropdown tidak tampil, navigasi Prev/Next tetap jalan.
  useEffect(() => {
    if (!data || chapters !== null) return;
    let cancelled = false;
    apiGet<MangaDetail>(`/api/manga/${encodeURIComponent(data.mangaSlug)}`)
      .then((d) => {
        if (!cancelled) setChapters(d.chapters);
      })
      .catch(() => {
        if (!cancelled) setChapters([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data, chapters]);

  // Progress bar bacaan — mengikuti posisi scroll relatif terhadap tinggi halaman gambar.
  // Progres riwayat ditulis ulang tiap melewati kelipatan 10%.
  // Di mode "page", progres = posisi halaman (hal 1/N … N/N).
  useEffect(() => {
    if (!data) return;
    const baseTitle = data.title.replace(/\s*chapter\s*.+$/i, "").trim() || data.title;
    // Cover diambil dari cache detail bila tersedia (hasil hover-prefetch
    // kartu) — tanpa request tambahan agar tidak memperlambat reader.
    const cachedDetail = peekApiCache<MangaDetail>(
      `/api/manga/${encodeURIComponent(data.mangaSlug)}`,
    );
    const cover = cachedDetail?.cover ?? "";
    const persist = (pct: number, page: number) => {
      saveHistory({
        slug: data.mangaSlug,
        title: baseTitle,
        cover,
        chapter,
        chapterLabel: data.chapterLabel,
        route: `/baca/${data.mangaSlug}/${chapter}`,
        progress: pct,
        page,
      });
    };
    if (mode === "page") {
      const pct = data.images.length <= 1 ? 1 : pageIdx / (data.images.length - 1);
      savedProgressRef.current = pct;
      pageNumRef.current = pageIdx;
      setProgress(pct);
      persist(pct, pageIdx);
      return;
    }
    // Catat riwayat begitu chapter berhasil dimuat — hormati posisi
    // tersimpan (buka ulang): jangan timpa dengan 0 bila ada restore.
    // Guard per chapter karena efek jalan ulang saat restore selesai.
    const initKey = `${data.mangaSlug}/${chapter}`;
    if (initPersistRef.current !== initKey) {
      initPersistRef.current = initKey;
      const startPage = pageNumRef.current;
      if (startPage === 0 && restorePct === null) {
        savedProgressRef.current = 0;
        persist(0, 0);
      } else {
        const pct = restorePct ?? 0;
        savedProgressRef.current = Math.floor(pct * 10) / 10;
        setProgress(pct);
      }
    }
    // Restore scroll sekali setelah gambar ter-render (2 frame agar
    // tinggi kontainer sudah final, baru lompat tanpa animasi).
    // Listener scroll tetap dipasang di bawah agar persist berjalan.
    let restoreTimer = 0;
    let hasRestoreTimer = false;
    if (restorePct !== null) {
      const target = restorePct;
      hasRestoreTimer = true;
      restoreTimer = window.setTimeout(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const el = pagesRef.current;
            if (el) {
              const total = el.offsetHeight - window.innerHeight;
              if (total > 0) window.scrollTo({ top: Math.round(total * target) });
            }
            setRestorePct(null);
          });
        });
      }, 350);
    }
    const onScroll = () => {
      const el = pagesRef.current;
      if (!el) return;
      // Tombol kembali-ke-atas: tampil setelah 600px agar tidak mengganggu awal baca.
      setShowTop(window.scrollY > 600);
      // Mentok atas/bawah → paksa sembunyikan overlay tap-nav karena nav
      // permanen (ChapterNav) sudah terlihat di posisi itu.
      const doc = document.documentElement;
      const atTop = window.scrollY <= 8;
      const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 8;
      if (atTop || atBottom) setShowTapNav(false);
      const rect = el.getBoundingClientRect();
      const total = rect.height - window.innerHeight;
      const scrolled = -rect.top;
      const pct = total <= 0 ? 1 : Math.min(1, Math.max(0, scrolled / total));
      setProgress(pct);
      // Indeks gambar paling atas yang terlihat — untuk "lanjutkan di posisi sama".
      const imgs = el.querySelectorAll("img[data-pg]");
      let cur = 0;
      for (let i = 0; i < imgs.length; i++) {
        if ((imgs[i] as HTMLElement).getBoundingClientRect().top <= 80) cur = i;
        else break;
      }
      pageNumRef.current = cur;
      // Simpan hanya saat melewati batas 10% berikutnya.
      if (pct - savedProgressRef.current >= 0.1 || pct >= 1) {
        savedProgressRef.current = pct >= 1 ? 1 : Math.floor(pct * 10) / 10;
        persist(savedProgressRef.current, pageNumRef.current);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (hasRestoreTimer) window.clearTimeout(restoreTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mode, pageIdx]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <ReaderSkeleton />;

  // Tap gambar (mode scroll): toggle overlay navigasi; sembunyikan otomatis
  // setelah 6 detik agar tidak menutupi bacaan. Tidak dimunculkan saat
  // mentok paling atas / bawah karena ChapterNav permanen sudah terlihat.
  const tapNav = () => {
    const doc = document.documentElement;
    const atTop = window.scrollY <= 8;
    const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 8;
    if (atTop || atBottom) return;
    setShowTapNav((v) => {
      if (!v) {
        window.setTimeout(() => setShowTapNav(false), 6000);
      }
      return !v;
    });
  };

  const { prevHref, nextHref } = navHrefs(data, data.mangaSlug, chapter);
  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <div className="mx-auto flex w-full max-w-3xl min-w-0 flex-col gap-2.5 sm:gap-3">
      <div className="sticky top-14 z-30 -mx-3 h-1 bg-line sm:top-[57px] sm:-mx-4 dark:bg-line-dark">
        <div
          className="h-full bg-accent transition-[width] duration-150"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div className="min-w-0">
        <Link
          href={`/komik/${data.mangaSlug}`}
          className="block max-w-full truncate text-xs text-muted hover:text-accent dark:text-muted-dark"
        >
          ← {data.mangaSlug.replace(/-/g, " ")}
        </Link>
        <div className="mt-1 flex min-w-0 items-start justify-between gap-2">
          <h1 className="min-w-0 flex-1 break-words font-display text-base font-bold leading-tight text-fg min-[420px]:text-lg sm:text-xl dark:text-fg-dark">
            {data.title}
          </h1>
          {/* Mode baca — pilihan tersimpan per perangkat */}
          <div
            role="group"
            aria-label="Mode baca"
            className="flex shrink-0 rounded-full border border-line p-0.5 text-[11px] font-semibold dark:border-line-dark"
          >
            {(["scroll", "page"] as const).map((m) => (
              <button
                key={m}
                onClick={() => switchMode(m)}
                aria-pressed={mode === m}
                className={`rounded-full px-2.5 py-1.5 transition-colors ${
                  mode === m
                    ? "bg-accent text-white"
                    : "text-muted hover:text-fg dark:text-muted-dark dark:hover:text-fg-dark"
                }`}
              >
                {m === "scroll" ? "Scroll" : "Halaman"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <ChapterNav data={data} slug={data.mangaSlug} chapter={chapter} />

      {/* Pindah chapter tanpa balik ke detail — daftar dari cache detail,
          dimuat di background bila cache kosong (lihat effect di bawah). */}
      {chapters !== null && chapters.length > 1 && (
        <label className="flex min-w-0 items-center gap-2 rounded-2xl border border-line bg-paper-2 px-3 py-2 text-sm dark:border-line-dark dark:bg-ink-2">
          <span className="shrink-0 text-xs font-semibold text-muted dark:text-muted-dark">
            Chapter
          </span>
          <select
            value={chapter}
            onChange={(e) => {
              const tok = e.target.value;
              if (tok && tok !== chapter) router.push(`/baca/${data.mangaSlug}/${tok}`);
            }}
            aria-label="Pindah chapter"
            className="h-9 min-w-0 flex-1 truncate rounded-lg bg-transparent text-sm font-semibold text-fg outline-none dark:text-fg-dark"
          >
            {chapters.map((c) => {
              const tok = c.url.match(/-chapter-(.+?)\/?$/)?.[1] ?? "";
              if (!tok) return null;
              return (
                <option key={c.url} value={tok}>
                  {c.title}
                  {c.date ? ` · ${c.date}` : ""}
                </option>
              );
            })}
          </select>
        </label>
      )}

      {mode === "scroll" ? (
        <div ref={pagesRef} className="flex min-w-0 flex-col overflow-hidden rounded-lg bg-paper-3 min-[420px]:rounded-xl dark:bg-black">
        {data.images.map((src, i) =>
          failed.has(i) ? (
            <div
              key={i}
              className="flex min-h-40 items-center justify-center border-b border-line px-4 py-8 text-center text-xs text-muted dark:border-ink-3 dark:text-muted-dark"
            >
              Halaman {i + 1} gagal dimuat dari sumber data. Periksa koneksi lalu muat ulang.
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={i}
              src={src}
              alt={`${data.title} halaman ${i + 1}`}
              loading={i < 2 ? "eager" : "lazy"}
              fetchPriority={i === 0 ? "high" : i < 3 ? "auto" : "low"}
              decoding={i < 3 ? "sync" : "async"}
              draggable={false}
              onError={() => {
                // Fallback sesuai perilaku Komiku: imageN.komiku.to → img.komiku.org
                const alt = src.replace(/image\d+\.komiku\.to/i, "img.komiku.org");
                if (alt !== src) {
                  const el = document.querySelector<HTMLImageElement>(
                    `img[data-pg="${i}"]`,
                  );
                  if (el && !el.dataset.fb) {
                    el.dataset.fb = "1";
                    el.src = alt;
                    return;
                  }
                }
                setFailed((s) => new Set(s).add(i));
              }}
              data-pg={i}
              onClick={tapNav}
              className="w-full cursor-pointer select-none"
            />
          ),
        )}
        </div>
      ) : (
        <PageMode
          data={data}
          pageIdx={pageIdx}
          setPageIdx={setPageIdx}
          failed={failed}
          setFailed={setFailed}
        />
      )}

      <ChapterNav data={data} slug={data.mangaSlug} chapter={chapter} />

      {/* Overlay tap: Prev / Daftar isi / Next — muncul saat gambar di-tap.
          Tab bar disembunyikan saat membaca, jadi cukup 1rem + safe-area dari bawah. */}
      {mode === "scroll" && showTapNav && (
        <div className="fixed inset-x-3 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] z-40 sm:bottom-6">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-1.5 rounded-2xl border border-line-dark bg-ink-2/95 p-1.5 text-sm shadow-2xl backdrop-blur">
            {prevHref ? (
              <Link
                href={prevHref}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl bg-accent px-2 py-2.5 text-[13px] font-semibold text-white"
              >
                <IconChevron dir="left" className="h-4 w-4 shrink-0" />
                <span className="truncate">Prev</span>
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-1 px-2 py-2.5 text-[13px] text-muted-dark">
                <IconChevron dir="left" className="h-4 w-4 shrink-0" />
                <span className="truncate">Prev</span>
              </span>
            )}
            <Link
              href={`/komik/${data.mangaSlug}`}
              aria-label="Semua chapter"
              className="flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line-dark px-2 py-2.5 text-[13px] font-medium text-fg-dark"
            >
              <IconList className="h-4 w-4 shrink-0" />
              <span className="truncate">All</span>
            </Link>
            {nextHref ? (
              <Link
                href={nextHref}
                className="flex min-w-0 flex-1 items-center justify-center gap-1 rounded-xl border border-line-dark px-2 py-2.5 text-[13px] font-medium text-fg-dark"
              >
                <span className="truncate">Next</span>
                <IconChevron dir="right" className="h-4 w-4 shrink-0" />
              </Link>
            ) : (
              <span className="flex min-w-0 flex-1 cursor-not-allowed items-center justify-center gap-1 px-2 py-2.5 text-[13px] text-muted-dark">
                <span className="truncate">Next</span>
                <IconChevron dir="right" className="h-4 w-4 shrink-0" />
              </span>
            )}
          </div>
        </div>
      )}

      {/* Tombol kembali-ke-atas — digantung cukup tinggi agar tidak
          menabrak menu Prev/Isi/Next permanen di dasar konten maupun
          overlay tap-nav (mobile + desktop). */}
      {((mode === "scroll" && showTop) || mode === "page") && (
        <button
          onClick={scrollTop}
          aria-label="Kembali ke atas"
          className={`fixed right-3 z-40 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-line-dark bg-ink-2/95 text-fg-dark shadow-xl backdrop-blur transition-all active:scale-95 sm:right-6 dark:border-line-dark ${
            mode === "scroll" && showTapNav
              ? "bottom-[calc(8.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-36"
              : "bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-24"
          }`}
        >
          <IconUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

/** Mode halaman tunggal: satu gambar per layar + tap kiri/kanan + keyboard. */
function PageMode({
  data,
  pageIdx,
  setPageIdx,
  failed,
  setFailed,
}: {
  data: ChapterData;
  pageIdx: number;
  setPageIdx: (i: number | ((p: number) => number)) => void;
  failed: Set<number>;
  setFailed: (f: Set<number> | ((s: Set<number>) => Set<number>)) => void;
}) {
  const total = data.images.length;
  const cur = Math.min(Math.max(0, pageIdx), total - 1);

  const go = useCallback(
    (d: number) => {
      setPageIdx((p) => {
        const n = Math.min(Math.max(0, p + d), total - 1);
        if (n !== p) window.scrollTo({ top: 0 });
        return n;
      });
    },
    [setPageIdx, total],
  );

  // Keyboard: panah kanan/spasi = maju, panah kiri = mundur.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  const src = data.images[cur];
  const isFailed = failed.has(cur) || !src;

  return (
    <div className="flex min-w-0 flex-col gap-2">
      <div className="relative min-w-0 overflow-hidden rounded-lg bg-paper-3 min-[420px]:rounded-xl dark:bg-black">
        {isFailed ? (
          <div className="flex min-h-60 items-center justify-center px-4 py-12 text-center text-xs text-muted dark:text-muted-dark">
            Halaman {cur + 1} gagal dimuat dari sumber data. Periksa koneksi lalu muat ulang.
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={cur}
            src={src}
            alt={`${data.title} halaman ${cur + 1}`}
            draggable={false}
            onError={() => {
              const alt = src.replace(/image\d+\.komiku\.to/i, "img.komiku.org");
              if (alt !== src) {
                const el = document.querySelector<HTMLImageElement>(`img[data-pg="${cur}"]`);
                if (el && !el.dataset.fb) {
                  el.dataset.fb = "1";
                  el.src = alt;
                  return;
                }
              }
              setFailed((s) => new Set(s).add(cur));
            }}
            data-pg={cur}
            className="max-h-[75vh] w-full select-none object-contain"
          />
        )}
        {/* Zona tap: kiri 1/3 mundur, kanan 2/3 maju */}
        {!isFailed && (
          <>
            <button
              aria-label="Halaman sebelumnya"
              onClick={() => go(-1)}
              className="absolute inset-y-0 left-0 w-1/3 touch-manipulation"
            />
            <button
              aria-label="Halaman berikutnya"
              onClick={() => go(1)}
              className="absolute inset-y-0 right-0 w-2/3 touch-manipulation"
            />
          </>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={() => go(-1)}
          disabled={cur === 0}
          className="min-h-11 flex-1 rounded-full border border-line px-4 py-2 text-sm font-semibold text-fg disabled:opacity-40 sm:min-h-0 dark:border-line-dark dark:text-fg-dark"
        >
          ← Sebelumnya
        </button>
        <span className="shrink-0 text-xs tabular-nums text-muted dark:text-muted-dark">
          {cur + 1} / {total}
        </span>
        <button
          onClick={() => go(1)}
          disabled={cur === total - 1}
          className="min-h-11 flex-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
        >
          Berikutnya →
        </button>
      </div>
    </div>
  );
}
