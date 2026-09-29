/**
 * lib/api/manga.ts — service daftar & detail komik (multi-source).
 *
 * Bentuk return & signature SAMA seperti sebelumnya (MangaCard[] /
 * MangaDetail) sehingga route /api/* dan frontend tidak perlu berubah.
 * Di dalam: fetch Komiku + Komikindo paralel → mergeCards / mergeDetails
 * dengan KOMIKINDO selalu utama, Komiku hanya fallback/pelengkap.
 */
import {
  fetchHome,
  fetchMangaDetail,
  fetchMangaList,
  type MangaListParams,
} from "./komiku";
import { fetchKiDetail, fetchKiLatest, fetchKiMeta } from "./komikindo";
import {
  fetchAllSettled,
  mergeCards,
  mergeDetails,
  normalizeTitle,
  sortByFresh,
  type MergedMangaDetail,
} from "./aggregator";
import type { ChapterItem, MangaCard, MangaDetail } from "./types";

/**
 * Perkaya kartu terbaru yang miskin data (Komikindo tanpa synopsis):
 * - Sinopsis singkat (±120 char, 1 baris) + genre via WP REST API per slug
 *   (respons kecil, paralel 10, cache 5 menit — markup daftar HTML tidak
 *   memuat sinopsis).
 * - Awal chapter: diturunkan dari URL terbaru (nomor → 1) lalu diverifikasi
 *   via HEAD ke Komikindo — hanya dipasang bila upstream menjawab 200,
 *   jadi tidak ada tombol Awal yang mengarah ke 404. 1 HEAD/kartu, murah.
 * - Gagal-abaikan: kartu tetap tampil minim bila verifikasi gagal.
 * - Hasil ikut cache Next (revalidate 30s) sehingga muat ulang murah.
 */
const KI_WEB = "https://komikindo.ch";
const KI_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

async function enrichLatest(cards: MangaCard[]): Promise<MangaCard[]> {
  const kiSlugOf = (c: MangaCard): string | undefined =>
    c.sourceSlug?.komikindo ?? (((c.sources ?? []).join() === "komikindo") ? c.slug : undefined);
  const targets = cards
    .map((c, i) => ({ c, i }))
    // Semua kartu tanpa sinopsis yang berasal dari KI — termasuk kartu
    // gabungan yang sinopsis Komiku-nya pun kosong, dan kartu mentah KI
    // di halaman dalam (tanpa sourceSlug → pakai slug langsung).
    .filter(({ c }) => !c.synopsis && !!kiSlugOf(c));
  if (targets.length === 0) return cards;
  const out = [...cards];
  // 1) Sinopsis + genre per slug via WP REST (paralel, murah, cache 5 mnt).
  try {
    const meta = await fetchKiMeta(targets.map(({ c }) => kiSlugOf(c)!));
    for (const { c, i } of targets) {
      const m = meta.get(kiSlugOf(c)!);
      if (!m) continue;
      const patch: Partial<MangaCard> = {};
      if (m.synopsis) patch.synopsis = m.synopsis;
      if (m.genre && !c.genre) patch.genre = m.genre;
      if (Object.keys(patch).length > 0) out[i] = { ...c, ...patch };
    }
  } catch {
    // Gagal → lanjut ke Awal per detail, kartu tetap tampil.
  }
  // 2) Awal chapter untuk semua kartu yang masih tanpa Awal — turunkan dari
  // URL terbaru lalu verifikasi via HEAD (murah). Kandidat ganda karena pola
  // Komikindo beragam: prefix ID ("887850-jungle-juice" → "jungle-juice",
  // tapi "7-nin-..." BUKAN prefix ID — coba keduanya), chapter desimal
  // ("88-1" → coba "1-1" lalu "1"). URL final mengikuti redirect upstream
  // (mis. chapter-1 → chapter-01). Tombol Awal hanya dipasang bila upstream
  // menjawab 200 — tidak ada link Awal yang 404.
  const needFirst = targets.filter(({ i }) => !out[i].firstChapter);
  await Promise.all(
    needFirst.map(async ({ i }) => {
      const latest = out[i].latestChapter?.url ?? "";
      const m = latest.match(/^(.+)-chapter-(.+?)\/?$/);
      if (!m) return;
      const rawSeries = m[1].replace(/^\/+|\/+$/g, "");
      const tail = m[2];
      const derived = tail.replace(/^\d+(\.\d+)?/, "1");
      const seriesSet = [...new Set([rawSeries, rawSeries.replace(/^\d+-/, "")])];
      const tailSet = [...new Set([derived, "1"])];
      const candidates = seriesSet.flatMap((s) => tailSet.map((t) => `/${s}-chapter-${t}/`));
      const check = async (url: string): Promise<string | null> => {
        try {
          const ctrl = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 8_000);
          try {
            const res = await fetch(KI_WEB + url, {
              // HEAD: upstream tetap balas 301/200 tanpa body — jauh lebih
              // murah daripada GET halaman reader (±70KB per cek).
              method: "HEAD",
              headers: { "User-Agent": KI_UA, Referer: KI_WEB + "/" },
              signal: ctrl.signal,
              next: { revalidate: 300 },
            });
            if (res.ok) return new URL(res.url).pathname;
          } finally {
            clearTimeout(timer);
          }
        } catch {
          // abaikan — kandidat berikutnya
        }
        return null;
      };
      const results = await Promise.all(candidates.map(check));
      const found = results.find((u): u is string => !!u);
      if (found) {
        const num = found.match(/-chapter-(.+?)\/?$/)?.[1]?.replace(/-/g, ".").replace(/\.end$/i, "") ?? "1";
        out[i] = { ...out[i], firstChapter: { label: `Chapter ${num}`, url: found } };
      }
    }),
  );
  return out;
}

/** Chapter terbaru (Komikindo /komik-terbaru/ utama + Komiku ?orderby=modified pelengkap). */
export async function getLatest(page = 1): Promise<MangaCard[]> {
  const params: MangaListParams = { orderby: "modified", page, fresh: true };
  // Coba 2x — kegagalan fragment API sering cuma sementara (beban
  // bersamaan saat /api/home menembak beberapa request sekaligus),
  // jadi jangan langsung jatuh ke fetchHome() yang datanya lebih basi.
  const jobs = {
    komiku: async () => {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const { items } = await fetchMangaList(params);
          if (items.length > 0) return items;
        } catch {
          // coba lagi (attempt berikutnya) sebelum fallback
        }
      }
      const home = await fetchHome();
      return page > 1 ? [] : home.latest;
    },
    komikindo: async () => {
      try {
        const { items } = await fetchKiLatest(page);
        return items;
      } catch {
        return [] as MangaCard[];
      }
    },
  };
  const { data } = await fetchAllSettled(jobs, "latest");
  if (page > 1) {
    // Pagination dalam (/terbaru?page=N): gabung halaman N kedua source
    // (dedupe judul, data utama Komikindo), lalu URUT TERBARU lintas
    // source — bukan urutan source. Kartu diperkaya seperti hal. 1.
    // latestSource diisi di sini juga: kartu dari KI → komikindo, kartu
    // unik Komiku → komiku (badge sumber tetap muncul di halaman 2+).
    // `sources` satu entri juga diisi agar enrichLatest mengenali kartu
    // mentah KI (tanpa sourceSlug) dan konsistensi badge terjaga
    // (SourceBadge hanya tampil bila >1 source).
    const ki = data.komikindo ?? [];
    const ku = data.komiku ?? [];
    const seen = new Set(ki.map((c) => c.slug));
    const kiKeys = new Set(ki.map((c) => normalizeTitle(c.title)));
    const list = sortByFresh([
      ...ki.map((c) => ({ ...c, sources: ["komikindo" as const], latestSource: "komikindo" as const })),
      ...ku
        .filter((c) => !seen.has(c.slug) && !kiKeys.has(normalizeTitle(c.title)))
        .map((c) => ({ ...c, sources: ["komiku" as const], latestSource: "komiku" as const })),
    ]);
    return enrichLatest(list);
  }
  const merged = mergeCards({ komiku: data.komiku ?? [], komikindo: data.komikindo ?? [] });
  // Halaman 1 (/terbaru awal + home): urut PALING BARU lintas source —
  // Komiku yang lebih segar tampil di atas Komikindo yang basi (dan
  // sebaliknya); saat Komikindo update ia otomatis naik ke atas.
  // Lalu perkaya kartu KI agar setara kartu Komiku (Awal + sinopsis + genre).
  return enrichLatest(sortByFresh(merged));
}

/** Komik populer — perbandingan ranking Komiku (views) + terbaru Komikindo.
 * Komikindo tidak punya halaman ranking, jadi "perbandingan" dilakukan
 * via angka views: kartu ber-views (punya data ranking) urut desc dulu,
 * kartu tanpa views (murni KI) menempel di belakang. Dedupe via mergeCards
 * (judul/chapter sama = satu item, data utama Komikindo). Rank tampilan
 * ditulis ulang 1..N agar rapih. */
export async function getPopular(): Promise<MangaCard[]> {
  const { fetchRanking } = await import("./komiku");
  const { data } = await fetchAllSettled(
    {
      komiku: () => fetchRanking("harian"),
      komikindo: async () => {
        // Komikindo tidak punya endpoint ranking — pakai terbaru sebagai
        // kandidat populer (rating/views ikut di kartu bila ada).
        try {
          const { items } = await fetchKiLatest(1);
          return items.slice(0, 10);
        } catch {
          return [] as MangaCard[];
        }
      },
    },
    "popular",
  );
  const ku = data.komiku ?? [];
  const ki = data.komikindo ?? [];
  const merged = mergeCards({ komiku: ku, komikindo: ki });
  // "37,061 views" → 37061; tanpa angka (kartu murni KI) → -1 (belakang).
  const viewsNum = (m: { views?: string }): number => {
    const digits = (m.views ?? "").replace(/[^0-9]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) ? n : -1;
  };
  const ranked = [...merged].sort((a, b) => viewsNum(b) - viewsNum(a));
  // Rank tampilan ditulis ulang 1..N agar berurutan rapih — gabungan dua
  // source tidak lagi membawa nomor rank asli yang acak (87, 29, ...).
  return ranked.slice(0, 20).map((m, i) => ({ ...m, rank: i + 1 }));
}

/** Acak array (Fisher-Yates) — agar rekomendasi tampil beda tiap muat. */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Komik rekomendasi — acak gabungan ?orderby=rand (Komiku) + terbaru Komikindo. */
export async function getRecommended(): Promise<MangaCard[]> {
  // Coba 2x seperti getLatest — kegagalan fragment API sering sementara.
  const komikuJob = async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { items } = await fetchMangaList({ orderby: "rand", fresh: true });
        if (items.length > 0) return items;
      } catch {
        // coba lagi sebelum fallback
      }
    }
    try {
      const { items } = await fetchMangaList({ orderby: "date" });
      return items;
    } catch {
      return [] as MangaCard[];
    }
  };
  const { data } = await fetchAllSettled(
    {
      komiku: komikuJob,
      komikindo: async () => {
        try {
          const { items } = await fetchKiLatest(1);
          return items;
        } catch {
          return [] as MangaCard[];
        }
      },
    },
    "recommended",
  );
  const merged = mergeCards({ komiku: data.komiku ?? [], komikindo: data.komikindo ?? [] });
  return enrichRecommended(shuffle(merged));
}

/**
 * Isi genre kosong di Rekomendasi agar semua kartu punya tag genre:
 * - Kartu asal KI → via WP REST (murah, paralel, cache 5 menit).
 * - Kartu murni Komiku (list acak tidak membawa genre) → via detail
 *   Komiku per slug, paralel, gagal-abaikan. Hasil ikut cache Next
 *   (revalidate 30s) sehingga muat ulang murah.
 */
async function enrichRecommended(cards: MangaCard[]): Promise<MangaCard[]> {
  const targets = cards.map((c, i) => ({ c, i })).filter(({ c }) => !c.genre);
  if (targets.length === 0) return cards;
  const out = [...cards];
  const jobs = targets.map(async ({ c, i }) => {
    const kiSlug = c.sourceSlug?.komikindo ?? (((c.sources ?? []).join() === "komikindo") ? c.slug : undefined);
    if (kiSlug) {
      try {
        const meta = await fetchKiMeta([kiSlug]);
        const genre = meta.get(kiSlug)?.genre;
        if (genre) out[i] = { ...c, genre };
        return;
      } catch {
        // jatuh ke bawah? tidak — kartu KI cukup sekali coba
      }
      return;
    }
    // Murni Komiku → genre hanya ada di halaman detail. Kartu daftar
    // cukup SATU genre (aturan tampilan).
    try {
      const d = await fetchMangaDetail(c.slug);
      const genre = d.genres?.map((g) => g.name).filter(Boolean).slice(0, 1).join(", ");
      if (genre) out[i] = { ...c, genre };
    } catch {
      // gagal → kartu tetap tampil tanpa genre
    }
  });
  await Promise.all(jobs);
  return out;
}

/** Update chapter terbaru (alias getLatest halaman pertama, untuk homepage). */
export async function getLatestUpdate(): Promise<MangaCard[]> {
  return getLatest(1);
}

/** Detail satu komik berdasarkan slug (multi-source, merge + sources info). */
export async function getMangaDetail(slug: string): Promise<MangaDetail> {
  const { data } = await fetchAllSettled(
    {
      komiku: () => fetchMangaDetail(slug),
      komikindo: () => fetchKiDetail(slug),
    },
    "detail",
  );
  const merged: MergedMangaDetail | null = mergeDetails({
    ...(data.komiku ? { komiku: data.komiku } : {}),
    ...(data.komikindo ? { komikindo: data.komikindo } : {}),
  });
  if (!merged) throw new Error("Gagal memuat detail komik.");
  // Kembalikan sebagai MangaDetail (chapters = MergedChapterItem[] adalah
  // subtype ChapterItem[] + field tambahan) + tempel info sources.
  return merged as MangaDetail & Pick<MergedMangaDetail, "sources" | "sourceSlug">;
}

/** Daftar chapter satu komik berdasarkan slug. */
export async function getChapterList(slug: string): Promise<ChapterItem[]> {
  const detail = await getMangaDetail(slug);
  return detail.chapters;
}
