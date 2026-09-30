"use client";

import { memo, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { apiGet } from "@/lib/client";
import type { CommentPage, KomikuComment, KomikuReply, ReplyPage } from "@/lib/api/types";

export type CommentSortKey = "popular" | "latest" | "earliest";

const SORT_LABEL: Record<CommentSortKey, string> = {
  popular: "Terpopuler",
  latest: "Terbaru",
  earliest: "Terlama",
};

const EMOJI: Record<string, string> = {
  like: "👍",
  love: "❤️",
  wow: "😮",
  haha: "😂",
  sad: "😢",
  angry: "😠",
  care: "🤗",
};

function Avatar({ name, src, small }: { name: string; src: string; small?: boolean }) {
  const size = small ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt="" loading="lazy" className={`${size} shrink-0 rounded-full bg-paper-3 object-cover dark:bg-ink-3`} />;
  }
  return (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-bold text-accent-strong dark:bg-accent-soft-dark dark:text-accent`}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  );
}

/** Isi satu komentar (dipakai di section + modal). */
function CommentBody({ c, kind }: { c: KomikuComment; kind: "manga" | "chapter" }) {
  return (
    <div className="rounded-xl rounded-tl-sm bg-paper px-3 py-2 dark:bg-ink">
      <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span className="truncate text-[13px] font-bold text-fg dark:text-fg-dark">{c.author}</span>
        {c.time && <span className="shrink-0 text-[11px] text-muted dark:text-muted-dark">{c.time}</span>}
      </p>
      {c.chapterTitle && kind === "manga" && (
        <p className="mt-0.5 truncate text-[11px] font-medium text-accent">{c.chapterTitle}</p>
      )}
      {c.sticker ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={c.sticker} alt="Stiker" loading="lazy" className="mt-1 h-24 w-24 rounded-lg object-contain" />
      ) : (
        <p className="mt-0.5 break-words text-[13px] leading-relaxed text-fg/90 sm:text-sm dark:text-fg-dark/85">{c.body}</p>
      )}
      {c.reactions.length > 0 && (
        <p className="mt-1.5 flex flex-wrap gap-1">
          {c.reactions.map((r) => (
            <span key={r.emote} className="rounded-full bg-paper-3 px-2 py-0.5 text-[11px] dark:bg-ink-3">
              {EMOJI[r.emote] ?? "👍"} {r.total}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}

/** Satu balasan (indent, tanpa nested lagi). */
function ReplyItem({ r }: { r: KomikuReply }) {
  return (
    <div className="flex min-w-0 gap-2">
      <Avatar name={r.author} src={r.avatar} small />
      <div className="min-w-0 flex-1 rounded-xl rounded-tl-sm bg-paper px-2.5 py-2 dark:bg-ink">
        <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
          <span className="truncate text-xs font-bold text-fg dark:text-fg-dark">{r.author}</span>
          {r.time && <span className="shrink-0 text-[10px] text-muted dark:text-muted-dark">{r.time}</span>}
        </p>
        {r.sticker ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.sticker} alt="Stiker" loading="lazy" decoding="async" className="mt-1 h-20 w-20 rounded-lg object-contain" />
        ) : (
          <p className="mt-0.5 break-words text-[13px] leading-relaxed text-fg/90 dark:text-fg-dark/85">{r.body}</p>
        )}
      </div>
    </div>
  );
}

/** Balasan expandable satu komentar — lazy: TIDAK fetch sebelum dibuka. */
const Replies = memo(function Replies({ hashId, total }: { hashId: string; total?: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<KomikuReply[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(
    async (p: number) => {
      if (loading) return;
      setLoading(true);
      setError(false);
      try {
        const res = await apiGet<ReplyPage>(`/api/replies?hash=${encodeURIComponent(hashId)}&page=${p}`);
        setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setNextPage(res.nextPage);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    },
    [hashId, loading],
  );

  if (!open) {
    if (!total) return null;
    return (
      <button
        onClick={() => {
          setOpen(true);
          void load(1);
        }}
        className="mt-1.5 w-fit touch-manipulation text-xs font-semibold text-accent transition-transform active:scale-95 hover:underline"
      >
        Lihat {total} balasan
      </button>
    );
  }

  return (
    <div className="mt-2 flex min-w-0 flex-col gap-2 border-l-2 border-line pl-2.5 dark:border-line-dark">
      {items.map((r) => (
        <ReplyItem key={r.hashId} r={r} />
      ))}
      {loading && <p className="text-xs text-muted dark:text-muted-dark">Memuat balasan…</p>}
      {error && !loading && (
        <button
          onClick={() => load(1)}
          className="w-fit touch-manipulation text-xs font-semibold text-mark-manga transition-transform active:scale-95"
        >
          Gagal memuat. Coba lagi.
        </button>
      )}
      {nextPage && !loading && (
        <button
          onClick={() => load(nextPage)}
          className="w-fit touch-manipulation text-xs font-semibold text-accent transition-transform active:scale-95 hover:underline"
        >
          Muat balasan lainnya
        </button>
      )}
      <button
        onClick={() => setOpen(false)}
        className="w-fit touch-manipulation text-[11px] text-muted transition-transform active:scale-95 hover:underline dark:text-muted-dark"
      >
        Sembunyikan
      </button>
    </div>
  );
});

/** Satu komentar penuh (avatar + isi + balasan) — memo agar daftar panjang
 *  tidak me-render ulang semua item saat 1 item berubah / list append. */
const CommentItem = memo(function CommentItem({ c, kind }: { c: KomikuComment; kind: "manga" | "chapter" }) {
  return (
    <article className="flex min-w-0 gap-2.5">
      <Avatar name={c.author} src={c.avatar} />
      <div className="min-w-0 flex-1">
        <CommentBody c={c} kind={kind} />
        <Replies hashId={c.hashId} total={c.replyCount} />
      </div>
    </article>
  );
});

/** Modal seluruh komentar — dibuka dari tombol "Komentar Lainnya". */
/** Jumlah item komentar yang dirender per frame (windowing daftar modal). */
const WINDOW_SIZE = 30;

function AllCommentsModal({
  kind,
  ref,
  sort,
  onSort,
  onClose,
}: {
  kind: "manga" | "chapter";
  ref: string;
  sort: CommentSortKey;
  onSort: (s: CommentSortKey) => void;
  onClose: () => void;
}) {
  const [items, setItems] = useState<KomikuComment[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const load = useCallback(
    async (p: number, s: CommentSortKey, append: boolean) => {
      if (append) {
        if (loadingMore) return;
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
      }
      try {
        const qs = new URLSearchParams({ kind, ref, sort: s, page: String(p) });
        const res = await apiGet<CommentPage>(`/api/comments?${qs}`);
        if (!mountedRef.current) return;
        setItems((prev) =>
          append
            ? [...prev, ...res.items.filter((it) => !prev.some((x) => x.hashId === it.hashId))]
            : res.items,
        );
        setNextPage(res.nextPage);
        setTotal(res.total);
      } catch (e) {
        if (!mountedRef.current) return;
        if (!append) setError(e instanceof Error ? e.message : "Gagal memuat komentar.");
      } finally {
        if (!mountedRef.current) return;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [kind, ref, loadingMore],
  );

  // Windowing ringan: daftar modal bisa ratusan item (append per halaman).
  // Render bertahap 30 per frame via rAF agar buka modal + "muat lainnya"
  // tidak memblokir UI (tap terasa macet) di HP maupun laptop kentang.
  const [visibleCount, setVisibleCount] = useState(WINDOW_SIZE);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems([]);
    setNextPage(null);
    setVisibleCount(WINDOW_SIZE);
    void load(1, sort, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  useEffect(() => {
    if (visibleCount >= items.length) return;
    let raf = 0;
    const tick = () => {
      raf = requestAnimationFrame(() => {
        setVisibleCount((v) => Math.min(items.length, v + WINDOW_SIZE));
      });
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [visibleCount, items.length]);

  // Scroll modal ke atas tiap ganti urutan — daftarnya benar-benar baru.
  useEffect(() => {
    listRef.current?.scrollTo({ top: 0 });
  }, [sort]);

  // Portal ke body: modal selalu menempel viewport, tidak lagi terjepit
  // ancestor (transform/filter/backdrop) maupun tertutup header sticky —
  // akar macet + posisi kepotong kemarin.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  // Kunci scroll body + tutup via Escape selama modal terbuka.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  if (!mounted) return null;
  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Semua komentar"
    >
      <div
        className="flex max-h-[85dvh] w-full min-w-0 max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-paper-2 pb-[env(safe-area-inset-bottom,0px)] sm:rounded-2xl dark:bg-ink-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex min-w-0 shrink-0 items-center justify-between gap-2 border-b border-line px-3 py-2.5 sm:px-4 dark:border-line-dark">
          <h3 className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold text-fg dark:text-fg-dark">
            <span className="h-4 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="truncate">
              Semua
              {total > 0 && <span className="ml-1.5 text-xs font-semibold text-muted dark:text-muted-dark">({total})</span>}
            </span>
          </h3>
          <div className="flex shrink-0 items-center gap-1">
            {(Object.keys(SORT_LABEL) as CommentSortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => s !== sort && onSort(s)}
                aria-pressed={s === sort}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                  s === sort ? "bg-accent text-white" : "text-muted hover:text-accent dark:text-muted-dark"
                }`}
              >
                {SORT_LABEL[s]}
              </button>
            ))}
            <button
              onClick={onClose}
              aria-label="Tutup komentar"
              className="ml-1 flex h-9 w-9 touch-manipulation items-center justify-center rounded-full border border-line text-fg dark:border-line-dark dark:text-fg-dark"
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
                <path d="M18 6 6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
        <div ref={listRef} className="min-w-0 flex-1 overflow-y-auto overscroll-contain p-3 sm:p-4" style={{ WebkitOverflowScrolling: "touch" as const }}>
          {loading && (
            <div className="flex min-w-0 flex-col gap-2.5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex animate-pulse gap-2.5">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-paper-3 dark:bg-ink-3" />
                  <div className="min-w-0 flex-1 space-y-1.5 py-1">
                    <div className="h-3 w-1/3 rounded bg-paper-3 dark:bg-ink-3" />
                    <div className="h-3 w-full rounded bg-paper-3 dark:bg-ink-3" />
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-mark-manga/30 bg-mark-manga/5 px-4 py-6 text-center">
              <p className="text-sm text-mark-manga/90">{error}</p>
              <button onClick={() => load(1, sort, false)} className="mt-2 rounded-full border border-mark-manga/40 px-4 py-1.5 text-sm font-medium text-mark-manga">
                Coba lagi
              </button>
            </div>
          )}
          {!loading && !error && items.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted dark:border-line-dark dark:text-muted-dark">
              Belum ada komentar.
            </p>
          )}
          {!loading && !error && items.length > 0 && (
            <>
              <div className="flex min-w-0 flex-col gap-3">
                {items.slice(0, visibleCount).map((c) => (
                  <CommentItem key={c.hashId} c={c} kind={kind} />
                ))}
              </div>
              {visibleCount < items.length && (
                <p className="mt-3 text-center text-xs text-muted dark:text-muted-dark">
                  Menampilkan {Math.min(visibleCount, items.length)} dari {items.length} komentar…
                </p>
              )}
              {nextPage && (
                <button
                  onClick={() => load(nextPage, sort, true)}
                  disabled={loadingMore}
                  className="mx-auto mt-3 flex min-h-11 touch-manipulation items-center rounded-full border border-line px-6 py-2 text-sm font-semibold text-fg transition-transform active:scale-95 disabled:opacity-50 sm:min-h-0 dark:border-line-dark dark:text-fg-dark"
                >
                  {loadingMore ? "Memuat…" : "Muat komentar lainnya"}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Jumlah komentar preview di section (tanpa pagination). */
const PREVIEW_COUNT = 5;

/**
 * Section komentar read-only (tanpa login, tanpa form kirim).
 * kind=manga → komentar level komik; kind=chapter → komentar satu chapter.
 * Section menampilkan {PREVIEW_COUNT} komentar pertama + tombol
 * "Komentar Lainnya" yang membuka modal seluruh komentar.
 */
export function Comments({
  kind,
  ref,
  title = "Komentar",
}: {
  kind: "manga" | "chapter";
  ref: string;
  title?: string;
}) {
  const [sort, setSort] = useState<CommentSortKey>("latest");
  const [data, setData] = useState<CommentPage | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  // Tap tombol langsung terasa: tampilkan status bukaan modal sesaat
  // (fetch halaman pertama bisa 1-2 dtk saat upstream dingin).
  const [opening, setOpening] = useState(false);

  const load = useCallback(
    async (s: CommentSortKey) => {
      setLoading(true);
      setError(null);
      try {
        const qs = new URLSearchParams({ kind, ref, sort: s, page: "1" });
        const res = await apiGet<CommentPage>(`/api/comments?${qs}`);
        setData(res);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat komentar.");
      } finally {
        setLoading(false);
      }
    },
    [kind, ref],
  );

  useEffect(() => {
    setData(null);
    void load(sort);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, ref, sort]);

  const preview = data ? data.items.slice(0, PREVIEW_COUNT) : [];
  const hasMore = data ? data.items.length > PREVIEW_COUNT || !!data.nextPage : false;

  return (
    <>
      <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
        <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
          <h2 className="flex min-w-0 flex-1 items-center gap-2 font-display text-base font-bold text-fg dark:text-fg-dark">
            <span className="h-4 w-1.5 shrink-0 rounded-full bg-accent" />
            <span className="truncate">
              {title}
              {data && data.total > 0 && <span className="ml-1.5 text-xs font-semibold text-muted dark:text-muted-dark">({data.total})</span>}
            </span>
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {(Object.keys(SORT_LABEL) as CommentSortKey[]).map((s) => (
              <button
                key={s}
                onClick={() => s !== sort && setSort(s)}
                aria-pressed={s === sort}
                className={`rounded-full px-2.5 py-1.5 text-[11px] font-semibold transition-colors sm:text-xs ${
                  s === sort
                    ? "bg-accent text-white"
                    : "text-muted hover:text-accent dark:text-muted-dark"
                }`}
              >
                {SORT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex min-w-0 flex-col gap-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex animate-pulse gap-2.5">
                <div className="h-9 w-9 shrink-0 rounded-full bg-paper-3 dark:bg-ink-3" />
                <div className="min-w-0 flex-1 space-y-1.5 py-1">
                  <div className="h-3 w-1/3 rounded bg-paper-3 dark:bg-ink-3" />
                  <div className="h-3 w-full rounded bg-paper-3 dark:bg-ink-3" />
                </div>
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-mark-manga/30 bg-mark-manga/5 px-4 py-6 text-center">
            <p className="text-sm text-mark-manga/90">{error}</p>
            <button onClick={() => load(sort)} className="mt-2 rounded-full border border-mark-manga/40 px-4 py-1.5 text-sm font-medium text-mark-manga">
              Coba lagi
            </button>
          </div>
        )}

        {!loading && !error && data && data.items.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted dark:border-line-dark dark:text-muted-dark">
            Belum ada komentar. Jadilah yang pertama berkomentar di Komiku!
          </p>
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="flex min-w-0 flex-col gap-3">
              {preview.map((c) => (
                <CommentItem key={c.hashId} c={c} kind={kind} />
              ))}
            </div>
            {hasMore && (
              <button
                onClick={() => {
                  setOpening(true);
                  setModalOpen(true);
                  window.setTimeout(() => setOpening(false), 600);
                }}
                disabled={opening}
                className="mx-auto mt-3 flex min-h-11 touch-manipulation items-center rounded-full border border-line px-6 py-2 text-sm font-semibold text-fg transition-transform active:scale-95 disabled:opacity-60 sm:min-h-0 dark:border-line-dark dark:text-fg-dark"
              >
                {opening ? "Membuka…" : "Komentar Lainnya"}
              </button>
            )}
          </>
        )}
      </section>

      {modalOpen && (
        <AllCommentsModal kind={kind} ref={ref} sort={sort} onSort={setSort} onClose={() => setModalOpen(false)} />
      )}
    </>
  );
}
