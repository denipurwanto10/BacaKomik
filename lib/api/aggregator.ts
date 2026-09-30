import type { ChapterItem, ChapterRef, GenreRef, MangaCard, MangaDetail } from "./types";
// ID source terpusat di types (satu definisi, dipakai client + server).
import type { ComicSourceId } from "./types";
export type { ComicSourceId } from "./types";

/**
 * Aggregator multi-source: Komiku + Komikindo → satu bentuk data gabungan.
 *
 * Alur: fetch paralel per source (partial failure: satu gagal ≠ semua gagal)
 * → normalisasi judul → dedupe → merge (KOMIKINDO utama, Komiku fallback).
 *
 * Data asli tiap source TIDAK dihapus — disimpan di field `sources` /
 * `chapterSources` agar frontend bisa menampilkan badge & fallback.
 */

/** Tambah source baru = tambah satu nilai di types + scraper + entri priority. */

/**
 * URUTAN PRIORITAS FINAL — JANGAN DIBALIK:
 * KOMIKINDO SELALU UTAMA, Komiku hanya fallback/pelengkap.
 * Semua merge (kartu/detail/chapter) memakai urutan ini — data Komikindo
 * menang bila tersedia di kedua source; Komiku hanya mengisi yang kosong.
 */
export const SOURCE_PRIORITY: ComicSourceId[] = ["komikindo", "komiku"];

export const SOURCE_LABEL: Record<ComicSourceId, string> = {
  komiku: "Komiku",
  komikindo: "Komikindo",
};

/* ------------------------------------------------------------------ */
/* Normalisasi judul                                                    */
/* ------------------------------------------------------------------ */

/**
 * Normalisasi judul untuk matching lintas source:
 * - lowercase + trim + multiple-spaces → satu spasi
 * - tanda hubung/underscore/dash variants → spasi
 * - tanda baca non-alfanumerik dihapus ("One Piece!" → "one piece")
 * - unicode quotes/diacritics dinormalisasi ("I’m" → "im")
 *
 * Konservatif: TIDAK ada fuzzy/levenshtein — hanya exact match hasil
 * normalisasi yang dianggap sama. "One Piece" vs "One Piece: Ace Story"
 * tetap beda karena string ternormalisasinya beda.
 */
export function normalizeTitle(raw: string): string {
  return raw
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // diakritik
    .replace(/[’‘`´]/g, "'")
    .replace(/[-‐‑‒–—―_]+/g, " ") // semua varian dash/underscore → spasi
    .replace(/[^a-z0-9\s]/g, " ") // tanda baca → spasi
    .replace(/\s+/g, " ")
    .trim();
}

/** "Chapter 224" / "Ch. 224" → "224" (kunci dedupe chapter). */
export function normalizeChapterKey(raw: string): string {
  const t = raw
    .toLowerCase()
    .replace(/[<>]/g, "") // sisa tag <chapter> literal — isi angka dipertahankan
    .replace(/^(chapter|ch\.?|episode|eps\.?)\s*/i, "")
    .replace(/[^a-z0-9.\-]/g, "")
    .trim();
  return t;
}

/* ------------------------------------------------------------------ */
/* Tipe gabungan (extends tipe lama, non-breaking)                      */
/* ------------------------------------------------------------------ */

/** Referensi chapter dari satu source tertentu. */
export interface ChapterSourceRef {
  source: ComicSourceId;
  /** path chapter di source asalnya (format route internal source tsb) */
  url: string;
}

/**
 * Chapter gabungan: satu label + daftar source penyedia.
 * `url` = url source prioritas (Komiku bila ada) — dipakai link default
 * agar komponen lama (chapterPathToRoute) tetap jalan tanpa perubahan.
 */
export interface MergedChapterItem extends ChapterItem {
  sources: ChapterSourceRef[];
}

/**
 * Kartu gabungan: field lama (slug/title/thumbnail/...) = data source
 * prioritas; `sources` mencatat semua source penyedia.
 * `sourceSlug` = slug di tiap source (untuk fetch detail per source).
 */
export interface MergedMangaCard extends MangaCard {
  sources: ComicSourceId[];
  sourceSlug: Partial<Record<ComicSourceId, string>>;
}

/** Detail gabungan: chapters = MergedChapterItem[] (compatible: subtype). */
export interface MergedMangaDetail extends Omit<MangaDetail, "chapters"> {
  sources: ComicSourceId[];
  sourceSlug: Partial<Record<ComicSourceId, string>>;
  chapters: MergedChapterItem[];
}

/* ------------------------------------------------------------------ */
/* Merge kartu                                                          */
/* ------------------------------------------------------------------ */

/**
 * Gabungkan daftar kartu dari beberapa source → kartu unik.
 * Matching: normalizeTitle exact (TIDAK menggabungkan dua judul
 * ternormalisasi berbeda walau mirip) + fallback cocok via chapter URL:
 * dua kartu beda judul tapi chapter path-nya sama dianggap komik sama.
 */
export function mergeCards(lists: Partial<Record<ComicSourceId, MangaCard[]>>): MergedMangaCard[] {
  // Kunci chapter → grup: tangkap duplikat yang lolos normalisasi judul
  // (mis. "Solo Leveling" vs "Solo Leveling! Special") bila chapter sama.
  const chKeyOf = (c: MangaCard): string => {
    const u = (c.latestChapter?.url ?? c.firstChapter?.url ?? "").toLowerCase();
    const m = u.match(/-chapter-(.+?)\/?$/);
    // Kunci = slug-chapter TANPA nomor (identitas seri), mis. "solo-leveling".
    const series = u.replace(/-chapter-.+$/, "").replace(/^\//, "");
    return m && series ? `ch:${series}#${normalizeChapterKey(m[1])}` : "";
  };
  const groups = new Map<string, { cards: Partial<Record<ComicSourceId, MangaCard>> }>();
  const byChapter = new Map<string, string>(); // chKey -> group key
  for (const s of SOURCE_PRIORITY) {
    for (const c of lists[s] ?? []) {
      const key = normalizeTitle(c.title);
      if (!key) continue;
      // Grup yang sama bila judul sama ATAU chapter-nya sama.
      const ck = chKeyOf(c);
      const existing = ck ? byChapter.get(ck) : undefined;
      const gkey = existing ?? `t:${key}`;
      let g = groups.get(gkey);
      if (!g) {
        g = { cards: {} };
        groups.set(gkey, g);
      }
      if (ck && !byChapter.has(ck)) byChapter.set(ck, gkey);
      // Satu source satu slot — duplikat dalam source yang sama dibuang.
      if (!g.cards[s]) g.cards[s] = c;
    }
  }

  const out: MergedMangaCard[] = [];
  for (const [, g] of groups) {
    const present = SOURCE_PRIORITY.filter((s) => g.cards[s]);
    const slugs: Partial<Record<ComicSourceId, string>> = {};
    for (const s of present) slugs[s] = g.cards[s]!.slug;

    // Slug tampilan = slug source prioritas (route /komik/<slug> tetap valid).
    const primary = present[0];
    const p = g.cards[primary]!;
    const getCard = <K extends keyof MangaCard>(k: K): MangaCard[K] | undefined => {
      for (const s of SOURCE_PRIORITY) {
        const v = g.cards[s]?.[k];
        if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) return v;
      }
      return undefined;
    };
    const firstCh = getCard("firstChapter");
    // updatedAt kartu gabungan = waktu TERBARU antar source (konsisten
    // dengan latestChapter nomor-tertinggi): KI "5 jam lalu" + KU "3 menit
    // lalu" → tampil "3 menit lalu" + terurut paling baru. Saat KI update,
    // otomatis ganti ke waktu KI yang lebih segar.
    let mergedUpdatedAt = getCard("updatedAt");
    {
      let best = updatedAtMinutes(mergedUpdatedAt);
      for (const s of SOURCE_PRIORITY) {
        const cand = g.cards[s]?.updatedAt;
        const n = updatedAtMinutes(cand);
        if (cand && n < best) {
          best = n;
          mergedUpdatedAt = cand;
        }
      }
    }
    // latestChapter lintas source: nomor TERTINGGI menang (Komiku ch20 vs
    // Komikindo ch19 → tampil ch20 Komiku; saat Komikindo update ke 20,
    // nomor sama → Komikindo menang via urutan SOURCE_PRIORITY).
    // Bila nomor tak terparse, fallback ke source prioritas.
    let latestCh = getCard("latestChapter");
    // Source penyedia latest (untuk badge di tombol Terbaru).
    let latestSrc: ComicSourceId | undefined;
    for (const s of SOURCE_PRIORITY) {
      if (latestCh && g.cards[s]?.latestChapter?.url === latestCh.url) {
        latestSrc = s;
        break;
      }
    }
    {
      let best = chapterNum(latestCh?.label);
      if (Number.isFinite(best)) {
        for (const s of SOURCE_PRIORITY) {
          const cand = g.cards[s]?.latestChapter;
          const n = chapterNum(cand?.label);
          // strictly lebih besar → ganti; sama → pertahankan (KI lebih dulu).
          if (cand && Number.isFinite(n) && n > best) {
            best = n;
            latestCh = cand;
            latestSrc = s;
          }
        }
      }
    }
    out.push({
      slug: p.slug,
      title: (getCard("title") as string) ?? p.title,
      thumbnail: (getCard("thumbnail") as string) ?? p.thumbnail,
      ...(getCard("type") ? { type: getCard("type") as NonNullable<MangaCard["type"]> } : {}),
      ...(getCard("genre") ? { genre: getCard("genre") as string } : {}),
      ...(mergedUpdatedAt ? { updatedAt: mergedUpdatedAt } : {}),
      ...(getCard("synopsis") ? { synopsis: getCard("synopsis") as string } : {}),
      ...(firstCh ? { firstChapter: firstCh } : {}),
      ...(latestCh ? { latestChapter: latestCh } : {}),
      ...(latestSrc ? { latestSource: latestSrc } : {}),
      ...(getCard("views") ? { views: getCard("views") as string } : {}),
      ...(getCard("rank") !== undefined ? { rank: getCard("rank") as number } : {}),
      sources: present,
      sourceSlug: slugs,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Urut terbaru lintas source                                             */
/* ------------------------------------------------------------------ */

/**
 * "3 menit lalu" / "2 jam lalu" / "1 hari lalu" (ID & EN) → menit.
 * Tanpa waktu terparse → Infinity (paling belakang, tapi tetap tampil).
 */
export function updatedAtMinutes(raw?: string): number {
  if (!raw) return Infinity;
  const t = raw.toLowerCase().trim();
  const m = t.match(/(\d+(?:[.,]\d+)?)\s*(detik|second|menit|minute|jam|hour|hari|day|minggu|week|bulan|month|tahun|year)/);
  if (!m) return Infinity;
  const n = parseFloat(m[1].replace(",", "."));
  if (!Number.isFinite(n)) return Infinity;
  const unit = m[2];
  const per =
    unit.startsWith("detik") || unit.startsWith("second") ? 1 / 60
    : unit.startsWith("menit") || unit.startsWith("minute") ? 1
    : unit.startsWith("jam") || unit.startsWith("hour") ? 60
    : unit.startsWith("hari") || unit.startsWith("day") ? 1440
    : unit.startsWith("minggu") || unit.startsWith("week") ? 10080
    : unit.startsWith("bulan") || unit.startsWith("month") ? 43200
    : 525600; // tahun
  return n * per;
}

/**
 * Urutkan kartu gabungan PALING BARU dulu lintas source — BUKAN urutan
 * source. Bila Komikindo belum update tapi Komiku sudah (mis. KU "3 menit
 * lalu" vs KI "5 jam lalu"), kartu Komiku tampil di atas; saat Komikindo
 * update, kartu KI otomatis naik ke atas. Tanpa waktu → belakang.
 * Stabil: waktu sama → urutan asal dipertahankan.
 */
export function sortByFresh<T extends Pick<MangaCard, "updatedAt">>(cards: T[]): T[] {
  return cards
    .map((c, i) => ({ c, i }))
    .sort((a, b) => updatedAtMinutes(a.c.updatedAt) - updatedAtMinutes(b.c.updatedAt) || a.i - b.i)
    .map(({ c }) => c);
}

/**
 * Nomor chapter dari label ("Chapter 23" → 23, "88-1" → 88.1).
 * NaN bila tak terparse — dipakai merge kartu & detail (satu definisi).
 */
export function chapterNum(label?: string): number {
  if (!label) return NaN;
  const k = normalizeChapterKey(label);
  const n = parseFloat(k.replace(/-(\d+)$/, ".$1"));
  return Number.isFinite(n) ? n : NaN;
}

/* ------------------------------------------------------------------ */
/* Merge detail + chapter                                               */
/* ------------------------------------------------------------------ */

/**
 * Gabungkan detail dari beberapa source. Field teks = Komikindo bila ada,
 * fallback Komiku bila kosong. Genres = gabungan unik per slug/nama.
 * Chapters digabung per nomor chapter ternormalisasi (lihat mergeChapters).
 */
export function mergeDetails(details: Partial<Record<ComicSourceId, MangaDetail>>): MergedMangaDetail | null {
  const present = SOURCE_PRIORITY.filter((s) => details[s]);
  if (present.length === 0) return null;
  const primary = details[present[0]]!;

  const slugs: Partial<Record<ComicSourceId, string>> = {};
  for (const s of present) slugs[s] = details[s]!.slug;

  const get = <K extends keyof MangaDetail>(k: K): MangaDetail[K] | undefined => {
    for (const s of SOURCE_PRIORITY) {
      const v = details[s]?.[k];
      if (v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0)) return v;
    }
    return undefined;
  };

  // Genres: gabung unik (kunci = slug lowercased, fallback nama).
  const seen = new Set<string>();
  const genres: GenreRef[] = [];
  for (const s of SOURCE_PRIORITY) {
    for (const g of details[s]?.genres ?? []) {
      const key = (g.slug || g.name).toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        genres.push(g);
      }
    }
  }

  const chapters = mergeChapters(
    Object.fromEntries(present.map((s) => [s, details[s]!.chapters])) as Partial<Record<ComicSourceId, ChapterItem[]>>,
  );

  const firstCh: ChapterRef | undefined = get("firstChapter");
  // latestChapter lintas source: nomor TERTINGGI menang — SAMA seperti
  // mergeCards. get() saja tidak cukup: ia mengembalikan milik Komikindo
  // walau Komiku lebih baru (mis. KI ch22 vs KU ch23 → harus ch23 KU).
  // Nomor sama → Komikindo menang (urutan SOURCE_PRIORITY).
  let latestCh: ChapterRef | undefined = get("latestChapter");
  {
    let best = chapterNum(latestCh?.label);
    if (Number.isFinite(best)) {
      for (const s of SOURCE_PRIORITY) {
        const cand = details[s]?.latestChapter;
        const n = chapterNum(cand?.label);
        if (cand && Number.isFinite(n) && n > best) {
          best = n;
          latestCh = cand;
        }
      }
    }
  }

  return {
    slug: primary.slug,
    title: (get("title") as string) ?? primary.title,
    ...(get("altTitle") ? { altTitle: get("altTitle") as string } : {}),
    cover: (get("cover") as string) ?? primary.cover,
    synopsis: (get("synopsis") as string) ?? "",
    ...(get("type") ? { type: get("type") as string } : {}),
    ...(get("theme") ? { theme: get("theme") as string } : {}),
    genres,
    ...(get("author") ? { author: get("author") as string } : {}),
    ...(get("status") ? { status: get("status") as string } : {}),
    ...(get("rating") ? { rating: get("rating") as string } : {}),
    ...(get("readingDirection") ? { readingDirection: get("readingDirection") as string } : {}),
    ...(firstCh ? { firstChapter: firstCh } : {}),
    ...(latestCh ? { latestChapter: latestCh } : {}),
    chapters,
    sources: present,
    sourceSlug: slugs,
  };
}

/**
 * Gabungkan daftar chapter lintas source. Kunci = nomor ternormalisasi
 * ("Chapter 224" Komiku & "Chapter <224>" Komikindo → "224").
 * Aturan per chapter (Komikindo selalu menang bila nomor sama):
 * chapter ada di Komikindo → pakai URL Komikindo; hanya nomor yang
 * tidak ada di Komikindo yang memakai URL Komiku (fallback pelengkap).
 * Label tampilan = dari source prioritas. Urutan = nomor chapter tertinggi
 * dulu lintas source (Komiku ch23 di atas Komikindo ch22; saat Komikindo
 * update ke 23, tie → Komikindo dulu). Nomor tak terparse → fallback
 * urutan daftar Komikindo.
 */
export function mergeChapters(lists: Partial<Record<ComicSourceId, ChapterItem[]>>): MergedChapterItem[] {
  const byKey = new Map<string, MergedChapterItem>();
  for (const s of SOURCE_PRIORITY) {
    for (const c of lists[s] ?? []) {
      const key = normalizeChapterKey(c.title);
      if (!key) continue;
      const ex = byKey.get(key);
      if (ex) {
        if (!ex.sources.some((r) => r.source === s)) {
          ex.sources.push({ source: s, url: c.url });
        }
      } else {
        byKey.set(key, {
          title: c.title,
          url: c.url,
          ...(c.date ? { date: c.date } : {}),
          sources: [{ source: s, url: c.url }],
        });
      }
    }
  }
  // Urutan lintas source: nomor chapter TERTINGGI dulu (Komiku ch23 di
  // atas Komikindo ch22; saat Komikindo update ke 23, tie → Komikindo
  // menang). Urutan daftar source hanya fallback bila nomor tak terparse.
  const primaryList = lists[SOURCE_PRIORITY[0]] ?? [];
  const primaryKeys = primaryList.map((c) => normalizeChapterKey(c.title)).filter(Boolean);
  const order = new Map<string, number>();
  primaryKeys.forEach((k, i) => {
    if (!order.has(k)) order.set(k, i);
  });
  const numOf = (k: string) => {
    const n = parseFloat(k.replace(/-(\d+)$/, ".$1"));
    return Number.isFinite(n) ? n : NaN;
  };
  return [...byKey.values()].sort((a, b) => {
    const ka = normalizeChapterKey(a.title);
    const kb = normalizeChapterKey(b.title);
    const na = numOf(ka);
    const nb = numOf(kb);
    // Keduanya terparse → nomor tertinggi dulu; tie → Komikindo dulu
    // (urutan sources[0]).
    if (Number.isFinite(na) && Number.isFinite(nb)) {
      if ((nb as number) !== (na as number)) return (nb as number) - (na as number);
      const sa = a.sources[0]?.source ?? "";
      const sb = b.sources[0]?.source ?? "";
      if (sa !== sb) return SOURCE_PRIORITY.indexOf(sa as never) - SOURCE_PRIORITY.indexOf(sb as never);
      return ka.localeCompare(kb);
    }
    const oa = order.get(ka);
    const ob = order.get(kb);
    if (oa !== undefined && ob !== undefined) return oa - ob;
    if (oa !== undefined) return -1;
    if (ob !== undefined) return 1;
    return ka.localeCompare(kb);
  });
}

/* ------------------------------------------------------------------ */
/* Parallel fetch dengan partial failure                                */
/* ------------------------------------------------------------------ */

/**
 * Jalankan fetch tiap source paralel; source yang gagal → [] / null +
 * log server, source sukses tetap dipakai. TIDAK pernah throw bila
 * minimal satu source berhasil.
 */
export async function fetchAllSettled<T>(
  jobs: Partial<Record<ComicSourceId, () => Promise<T>>>,
  label: string,
): Promise<{ data: Partial<Record<ComicSourceId, T>>; errors: Partial<Record<ComicSourceId, string>> }> {
  const entries = Object.entries(jobs) as [ComicSourceId, () => Promise<T>][];
  const settled = await Promise.all(
    entries.map(async ([source, fn]) => {
      try {
        return { source, value: await fn(), err: null as unknown, msg: null as string | null };
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`[aggregator:${label}] source=${source} gagal: ${msg}`);
        return { source, value: null as T | null, err: e, msg };
      }
    }),
  );
  const data: Partial<Record<ComicSourceId, T>> = {};
  const errors: Partial<Record<ComicSourceId, string>> = {};
  for (const { source, value, msg } of settled) {
    if (value !== null) data[source] = value;
    else errors[source] = msg ?? "unknown";
  }
  if (Object.keys(data).length === 0) {
    // Semua gagal — lempar error asli source pertama (mis. KomikuError
    // + status HTTP) agar route mengembalikan status yang sama seperti
    // sebelum agregator ada. Fallback bila tidak ada error asli.
    const firstErr = settled.map((s) => s.err).find((e) => e instanceof Error);
    throw (
      firstErr ??
      new Error(
        entries.length > 1
          ? "Semua sumber data gagal dimuat. Coba lagi."
          : (errors[entries[0]?.[0] ?? "komiku"] ?? "Gagal memuat data."),
      )
    );
  }
  return { data, errors };
}
