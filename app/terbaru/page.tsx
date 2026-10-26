"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { apiGet, apiGetSWR, peekApiCache, titleKey } from "@/lib/client";
import { usePageTitle } from "@/lib/page-title";
import { useAutoRefresh } from "@/lib/use-auto-refresh";
import type { GenreRef, MangaCard } from "@/lib/api/types";
import { KomikListCard, KomikListSkeleton } from "@/components/komik-list";
import { Pagination } from "@/components/pagination";
import { Select } from "@/components/select";
import { SectionHead, ListSkeleton, ErrorState, EmptyState } from "@/components/states";

interface LatestPayload {
  items: MangaCard[];
  hasNextPage: boolean;
}

const ORDERBYS = [
  { v: "modified", label: "Chapter terbaru" },
  { v: "date", label: "Komik terbaru" },
  { v: "rand", label: "Acak" },
] as const;

type Orderby = (typeof ORDERBYS)[number]["v"];

function parseOrderby(raw: string | null): Orderby {
  return raw === "date" || raw === "rand" ? raw : "modified";
}

/** Halaman dari URL (?page=N). Default 1. */
function parsePage(raw: string | null): number {
  const n = parseInt(raw || "", 10);
  if (!Number.isFinite(n) || n < 1 || n > 50) return 1;
  return n;
}

const TIPES = [
  { v: "", label: "Semua tipe" },
  { v: "manga", label: "Manga" },
  { v: "manhwa", label: "Manhwa" },
  { v: "manhua", label: "Manhua" },
] as const;

const STATUSES = [
  { v: "", label: "Semua status" },
  { v: "ongoing", label: "Ongoing" },
  { v: "end", label: "Tamat" },
] as const;

/** Ambil nilai awal HANYA dari URL. Masuk /terbaru tanpa parameter
 *  (mis. dari tab Terbaru, "Lihat semua", dsb.) selalu mulai bersih
 *  (default) — bukan memakai filter kunjungan sebelumnya. Filter hanya
 *  bertahan via URL (?orderby=&tipe=&...), mis. saat kembali dari komik
 *  atau refresh yang URL-nya sudah memuat parameter. */
function initParam(sp: URLSearchParams, key: string): string {
  return sp.get(key) ?? "";
}

/**
 * Path API untuk halaman + filter yang sedang ada di URL. Dipakai untuk
 * cache awal/prefetch menu — harus sama persis dengan `buildQs` di bawah.
 */
function latestApiPath(sp: URLSearchParams, page: number): string {
  const qs = new URLSearchParams({
    page: String(page),
    orderby: parseOrderby(sp.get("orderby")),
  });
  const tipe = initParam(sp, "tipe");
  const status = initParam(sp, "status");
  const genre1 = initParam(sp, "genre");
  const genre2 = initParam(sp, "genre2");
  if (tipe) qs.set("tipe", tipe);
  if (status) qs.set("status", status);
  if (genre1) qs.set("genre", genre1);
  if (genre2) qs.set("genre2", genre2);
  return `/api/latest?${qs}`;
}

function TerbaruContent() {
  const router = useRouter();
  const sp = useSearchParams();
  usePageTitle("Komik Terbaru");

  const [orderby, setOrderby] = useState<Orderby>(() => parseOrderby(sp.get("orderby")));
  const [tipe, setTipe] = useState(() => initParam(sp, "tipe"));
  const [status, setStatus] = useState(() => initParam(sp, "status"));
  // Multi-pilih genre: 2 slot (genre + genre2) — HANYA dari URL (deep-link
  // halaman Genre). Masuk /terbaru tanpa ?genre= harus mulai bersih.
  const [genre1, setGenre1] = useState(() => initParam(sp, "genre"));
  const [genre2, setGenre2] = useState(() => initParam(sp, "genre2"));

  const filtersKey = `${orderby}|${tipe}|${status}|${genre1}|${genre2}`;

  // Satu halaman tampil dalam satu waktu — posisi dibaca dari URL (?page=N)
  // sehingga refresh maupun kembali dari komik langsung membuka halaman
  // yang sama. Keluar lalu masuk lagi lewat link /terbaru (tanpa ?page=)
  // otomatis mulai dari halaman 1.
  const [page, setPage] = useState<number>(() => parsePage(sp.get("page")));
  // Cache prefetch menu (hover/idle) dipakai sebagai isi awal — halaman
  // tujuan langsung tampil, bukan skeleton yang terasa seperti reload.
  const [boot] = useState(() =>
    peekApiCache<LatestPayload>(latestApiPath(sp, parsePage(sp.get("page")))),
  );
  const [items, setItems] = useState<MangaCard[]>(() => boot?.items ?? []);
  const [hasNext, setHasNext] = useState(() => boot?.hasNextPage ?? false);

  const [genreOpts, setGenreOpts] = useState<GenreRef[]>([]);
  const [loading, setLoading] = useState(() => (boot?.items.length ?? 0) === 0);
  const [error, setError] = useState<string | null>(null);

  const bootedRef = useRef(false);
  // Filter yang sudah diterapkan — perubahan dibanding nilai ini yang
  // memicu reset ke halaman 1. Perbandingan nilai, aman dari
  // double-effect StrictMode.
  const appliedFiltersRef = useRef(filtersKey);
  const listTopRef = useRef<HTMLDivElement>(null);
  // Judul yang sudah tampil per kombinasi filter — untuk membuang duplikat
  // lintas-halaman (merge server hanya per-page; judul yang sama bisa muncul
  // di p1 dari satu source dan p2 dari source lain karena beda timing).
  // Reset tiap filter berubah. Murni client-side, tanpa request tambahan.
  const seenRef = useRef(new Map<string, Set<string>>());
  // Cermin state untuk pengecekan background (hindari stale closure).
  const itemsRef = useRef<MangaCard[]>([]);
  const pageRef = useRef(page);
  const loadingRef = useRef(loading);
  const filtersKeyRef = useRef(filtersKey);
  useEffect(() => {
    itemsRef.current = items;
    pageRef.current = page;
    loadingRef.current = loading;
    filtersKeyRef.current = filtersKey;
  });

  // Saring item yang judulnya sudah tampil di halaman sebelumnya
  // (filter aktif), lalu catat sisanya. Urutan + prioritas server utuh.
  const dedupePage = useCallback(
    (list: MangaCard[]): MangaCard[] => {
      let seen = seenRef.current.get(filtersKey);
      if (!seen) {
        seen = new Set<string>();
        seenRef.current.set(filtersKey, seen);
      }
      const out: MangaCard[] = [];
      for (const item of list) {
        const k = titleKey(item.title);
        if (k && seen.has(k)) continue;
        if (k) seen.add(k);
        out.push(item);
      }
      return out;
    },
    [filtersKey],
  );

  // Terapkan hasil halaman: dedupe lintas-halaman + set state sekaligus.
  const applyItems = useCallback(
    (list: MangaCard[], next: boolean, p: number) => {
      setItems(dedupePage(list));
      setHasNext(next);
      setPage(p);
    },
    [dedupePage],
  );

  const buildQs = useCallback(
    (p: number) => {
      const qs = new URLSearchParams({ page: String(p), orderby });
      if (tipe) qs.set("tipe", tipe);
      if (status) qs.set("status", status);
      if (genre1) qs.set("genre", genre1);
      if (genre2) qs.set("genre2", genre2);
      return qs;
    },
    [orderby, tipe, status, genre1, genre2],
  );

  // Auto-refresh PWA: cek diam-diam tiap interval, ganti daftar HANYA
  // bila ada komik baru (3 teratas berubah). Tanpa skeleton, tanpa
  // menyentuh error/loading — gagal = abaikan. Hanya halaman 1 &
  // urutan non-acak (komik baru muncul di halaman 1; mode acak jangan
  // diusik urutannya saat dibaca).
  const silentCheck = useCallback(async () => {
    if (orderby === "rand") return;
    if (pageRef.current !== 1 || loadingRef.current) return;
    const cur = itemsRef.current;
    if (cur.length === 0) return;
    try {
      const res = await apiGet<LatestPayload>(`/api/latest?${buildQs(1)}`, { noStore: true });
      if (!res.items || res.items.length === 0) return;
      const sig = (l: MangaCard[]) =>
        l
          .slice(0, 3)
          .map((i) => `${i.slug}#${i.latestChapter?.url ?? ""}`)
          .join("|");
      if (sig(res.items) === sig(cur)) return;
      seenRef.current.delete(filtersKeyRef.current);
      applyItems(res.items, res.hasNextPage, 1);
    } catch {
      // Abaikan — daftar lama tetap tampil.
    }
  }, [orderby, buildQs, applyItems]);
  useAutoRefresh(silentCheck);

  const scrollToList = useCallback(() => {
    requestAnimationFrame(() => {
      listTopRef.current?.scrollIntoView({ block: "start" });
    });
  }, []);

  // Muat satu halaman penuh (mengganti daftar, bukan menumpuk).
  // Mount/back (filter sama): cache basi (<5 mnt) tampil instan +
  // disegarkan diam-diam — kembali dari detail tidak menunggu jaringan.
  // Filter berubah / pagination (fresh): selalu fetch baru.
  const loadPage = useCallback(
    async (p: number, fresh = false) => {
      const path = `/api/latest?${buildQs(p)}`;
      // Cache prefetch masih segar → tampilkan isi yang sudah ada tanpa
      // mengganti layar dengan skeleton.
      const cached = !fresh ? peekApiCache<LatestPayload>(path) : null;
      setLoading(!cached);
      setError(null);
      try {
        if (fresh) {
          const res = await apiGet<LatestPayload>(path);
          applyItems(res.items, res.hasNextPage, p);
          setLoading(false);
          return;
        }
        const { data, stale } = await apiGetSWR<LatestPayload>(path, (d) => {
          applyItems(d.items, d.hasNextPage, p);
          setLoading(false);
        });
        if (data) {
          applyItems(data.items, data.hasNextPage, p);
        }
        // stale: data basi tampil, onFresh mematikan loading saat segar tiba.
        // !stale tapi data null = mustahil (apiGet throw bila gagal).
        if (!stale) setLoading(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Gagal memuat data.");
        setLoading(false);
      }
    },
    [buildQs, applyItems],
  );

  // Mount pertama: buka halaman sesuai URL (cache basi tampil instan).
  useEffect(() => {
    if (bootedRef.current) return;
    bootedRef.current = true;
    appliedFiltersRef.current = filtersKey;
    void loadPage(parsePage(sp.get("page")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Perubahan filter (bukan mount): kembali ke halaman 1 (selalu fresh).
  useEffect(() => {
    if (appliedFiltersRef.current === filtersKey) return;
    appliedFiltersRef.current = filtersKey;
    // Batasi memori dedupe lintas-halaman: buang riwayat filter lama.
    if (seenRef.current.size > 20) seenRef.current.clear();
    scrollToList();
    void loadPage(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey]);

  // Pindah halaman via pagination.
  const goTo = useCallback(
    (p: number) => {
      const target = Math.min(Math.max(1, p), 50);
      if (target === page || loading) return;
      scrollToList();
      void loadPage(target);
    },
    [page, loading, loadPage, scrollToList],
  );

  // Filter + halaman ditulis ke URL (replace, tanpa reload) agar bertahan
  // saat kembali dari komik maupun refresh. TIDAK disimpan ke sessionStorage:
  // masuk /terbaru tanpa parameter harus selalu mulai bersih.
  useEffect(() => {
    if (!bootedRef.current) return;
    const qs = new URLSearchParams();
    if (orderby !== "modified") qs.set("orderby", orderby);
    if (tipe) qs.set("tipe", tipe);
    if (status) qs.set("status", status);
    if (genre1) qs.set("genre", genre1);
    if (genre2) qs.set("genre2", genre2);
    if (page > 1) qs.set("page", String(page));
    const target = qs.size > 0 ? `/terbaru?${qs}` : "/terbaru";
    router.replace(target, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtersKey, page]);

  // Opsi genre untuk dropdown (sekali muat, 1 jam cache server).
  useEffect(() => {
    apiGet<GenreRef[]>("/api/genres")
      .then(setGenreOpts)
      .catch(() => setGenreOpts([]));
  }, []);

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <section className="min-w-0 rounded-2xl border border-line bg-paper-2 p-3 sm:p-4 dark:border-line-dark dark:bg-ink-2">
        <div ref={listTopRef} className="scroll-mt-[calc(var(--header-h)+0.5rem)]">
          <SectionHead title="Komik Terbaru" />
        </div>
        <div className="filter-row">
          <Select
            value={orderby}
            onChange={(v) => setOrderby(parseOrderby(v))}
            label="Urutkan daftar"
            options={ORDERBYS.map((o) => ({ value: o.v, label: o.label }))}
          />
          <Select
            value={tipe}
            onChange={setTipe}
            label="Filter tipe komik"
            options={TIPES.map((t) => ({ value: t.v, label: t.label }))}
          />
          <Select
            value={status}
            onChange={setStatus}
            label="Filter status komik"
            options={STATUSES.map((s) => ({ value: s.v, label: s.label }))}
          />
          <Select
            value={genre1}
            onChange={(v) => {
              setGenre1(v);
              if (v && v === genre2) setGenre2("");
            }}
            label="Filter genre pertama"
            options={[
              { value: "", label: "Genre" },
              ...genreOpts.map((g) => ({ value: g.slug, label: g.name, disabled: g.slug === genre2 && genre2 !== "" })),
            ]}
          />
          <Select
            value={genre2}
            onChange={setGenre2}
            label="Filter genre kedua"
            options={[
              { value: "", label: "+ Genre" },
              ...genreOpts.map((g) => ({ value: g.slug, label: g.name, disabled: g.slug === genre1 && genre1 !== "" })),
            ]}
          />
        </div>

      {loading && <KomikListSkeleton count={8} />}
      {error && <ErrorState message={error} onRetry={() => loadPage(page)} />}
      {!loading && !error && items.length === 0 && (
        <EmptyState className="mt-3 sm:mt-4" message="Tidak ada komik dari sumber data untuk filter ini." />
      )}
      {!loading && !error && items.length > 0 && (
        <>
          <div className="mt-3 min-w-0 divide-y divide-line sm:mt-4 dark:divide-line-dark">
            {items.map((item) => (
              <KomikListCard key={`${item.slug}#${item.latestChapter?.url ?? ""}`} item={item} />
            ))}
          </div>
          <div className="mt-3 sm:mt-4">
            <Pagination page={page} hasNext={hasNext} pending={loading} onChange={goTo} />
          </div>
        </>
      )}
      </section>
    </div>
  );
}

export default function TerbaruPage() {
  return (
    <Suspense fallback={<ListSkeleton count={8} />}>
      <TerbaruContent />
    </Suspense>
  );
}
