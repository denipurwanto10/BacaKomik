/**
 * lib/api/manga.ts — service daftar & detail komik (multi-source).
 *
 * SHINIGAMI UTAMA, Komiku fallback kedua, Komikcast fallback ketiga.
 * Bentuk return & signature SAMA seperti sebelumnya (MangaCard[] /
 * MangaDetail) sehingga route /api/* dan frontend tidak perlu berubah.
 * Di dalam: fetch ketiga source paralel → mergeCards / mergeDetails
 * dengan prioritas SHINIGAMI > Komiku > Komikcast.
 */
import {
  fetchHome,
  fetchMangaDetail,
  fetchMangaList,
  fetchRanking,
  type MangaListParams,
  type RankPeriod,
} from "./komiku";
import {
  fetchKomikcastDetail,
  fetchKomikcastLatest,
  fetchKomikcastTrending,
  resolveKomikcastDetailForTitle,
} from "./komikcast";
import {
  fetchShiniLatest,
  fetchShiniRecommended,
  fetchShiniTop,
  isShiniId,
  resolveShiniDetailForSlug,
  type ShiniFormat,
  type ShiniTopFilter,
} from "./shinigami";
import {
  fetchAllSettled,
  mergeCards,
  mergeDetails,
  normalizeTitle,
  sortByFresh,
  type MergedMangaDetail,
} from "./aggregator";
import type { MangaCard, MangaDetail, PagedResult } from "./types";

/** Chapter terbaru (Shinigami is_update utama + Komiku ?orderby=modified pelengkap). */
export async function getLatest(page = 1): Promise<MangaCard[]> {
  const params: MangaListParams = { orderby: "modified", page, fresh: true };
  const jobs = {
    komiku: async () => {
      // Coba 2x — kegagalan fragment API sering cuma sementara (beban
      // bersamaan saat /api/home menembak beberapa request sekaligus),
      // jadi jangan langsung jatuh ke fetchHome() yang datanya lebih basi.
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
    shinigami: async () => {
      const { items } = await fetchShiniLatest(page);
      return items;
    },
    // Komikcast: /api/v1/home → latest_comic (tanpa paging upstream;
    // hanya halaman 1 agar tidak duplikat antar halaman UI).
    komikcast: async () => (page > 1 ? [] : fetchKomikcastLatest()),
  };
  const { data } = await fetchAllSettled(jobs, "latest");
  const merged = mergeCards({
    komiku: data.komiku ?? [],
    shinigami: data.shinigami ?? [],
    komikcast: data.komikcast ?? [],
  });
  // Urut PALING BARU lintas source — bukan urutan source.
  return sortByFresh(merged);
}

/**
 * Daftar terbaru berhalaman + filter (untuk /api/latest & /terbaru).
 * Filter tipe/genre diteruskan ke Shinigami; genre2/status hanya Komiku.
 */
export async function getLatestPaged(
  page = 1,
  opts: {
    orderby?: "modified" | "date" | "popular" | "rand" | null;
    tipe?: ShiniFormat | null;
    genre?: string | null;
    genre2?: string | null;
    status?: "ongoing" | "end" | null;
  } = {},
): Promise<PagedResult<MangaCard>> {
  const p = Math.max(1, page);
  const orderby = opts.orderby ?? "modified";
  const { data } = await fetchAllSettled(
    {
      komiku: () =>
        fetchMangaList({
          page: p,
          orderby,
          ...(opts.tipe ? { tipe: opts.tipe } : {}),
          ...(opts.genre ? { genre: opts.genre } : {}),
          ...(opts.genre2 ? { genre2: opts.genre2 } : {}),
          ...(opts.status ? { status: opts.status } : {}),
          fresh: true,
        }),
      shinigami: () =>
        fetchShiniLatest(p, {
          ...(opts.tipe ? { format: opts.tipe } : {}),
          ...(opts.genre ? { genre: opts.genre } : {}),
        }),
      // Komikcast tanpa paging/filter upstream — hanya halaman 1 tanpa filter.
      komikcast: () =>
        p > 1 || opts.tipe || opts.genre || opts.genre2 || opts.status
          ? Promise.resolve({ items: [], hasNextPage: false })
          : fetchKomikcastLatest().then((items) => ({ items, hasNextPage: false })),
    },
    "latest-paged",
  );
  const items = sortByFresh(
    mergeCards({
      komiku: data.komiku?.items ?? [],
      shinigami: data.shinigami?.items ?? [],
      komikcast: data.komikcast?.items ?? [],
    }),
  );
  return {
    items,
    hasNextPage: Boolean(data.komiku?.hasNextPage || data.shinigami?.hasNextPage || data.komikcast?.hasNextPage),
  };
}

const SHINI_TOP_BY_PERIOD: Record<RankPeriod, ShiniTopFilter> = {
  harian: "daily",
  mingguan: "weekly",
  bulanan: "monthly",
  total: "all_time",
};

/**
 * Komik populer — ranking Komiku (views) + top Shinigami.
 * Kartu ber-views urut desc dulu, kartu murni Shinigami menempel di
 * belakang. Rank tampilan ditulis ulang 1..N agar rapih.
 */
export async function getPopular(period: RankPeriod = "harian"): Promise<MangaCard[]> {
  const { data } = await fetchAllSettled(
    {
      komiku: () => fetchRanking(period),
      shinigami: () => fetchShiniTop(SHINI_TOP_BY_PERIOD[period], 1, 10),
      // Komikcast: trending home (tanpa views → menempel belakang seperti
      // kartu murni Shinigami; tetap berguna untuk dedupe + coverage).
      komikcast: () => fetchKomikcastTrending(),
    },
    "popular",
  );
  const ku = data.komiku ?? [];
  const sh = data.shinigami ?? [];
  const kc = data.komikcast ?? [];
  const merged = mergeCards({ komiku: ku, shinigami: sh, komikcast: kc });
  // "37,061 views" → 37061; tanpa angka (kartu murni Shinigami) → -1 (belakang).
  const viewsNum = (m: { views?: string }): number => {
    const digits = (m.views ?? "").replace(/[^0-9]/g, "");
    const n = parseInt(digits, 10);
    return Number.isFinite(n) && digits ? n : -1;
  };
  const ranked = [...merged].sort((a, b) => viewsNum(b) - viewsNum(a));
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

/** Komik rekomendasi — acak gabungan ?orderby=rand (Komiku) + rekomendasi Shinigami. */
export async function getRecommended(): Promise<MangaCard[]> {
  const komikuJob = async () => {
    // Coba 2x seperti getLatest — kegagalan fragment API sering sementara.
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
      shinigami: () => fetchShiniRecommended(),
      komikcast: () => fetchKomikcastLatest(),
    },
    "recommended",
  );
  const merged = mergeCards({
    komiku: data.komiku ?? [],
    shinigami: data.shinigami ?? [],
    komikcast: data.komikcast ?? [],
  });
  return shuffle(merged);
}

/** Update chapter terbaru (alias getLatest halaman pertama, untuk homepage). */
export async function getLatestUpdate(): Promise<MangaCard[]> {
  return getLatest(1);
}

/**
 * Detail satu komik (multi-source, merge + sources info).
 * Slug UUID → murni Shinigami. Slug manusiawi → ketiga source paralel;
 * Komikcast selalu lewat resolve judul (exact match) karena skema slug-nya
 * beda (tanpa "-id"). Judul diambil dari hasil Komiku/Shinigami bila ada,
 * else dari slug.
 */
export async function getMangaDetail(slug: string): Promise<MangaDetail> {
  const { data } = await fetchAllSettled(
    {
      komiku: () => fetchMangaDetail(slug),
      shinigami: () => resolveShiniDetailForSlug(slug),
      // Komikcast selalu via resolve judul (skema slug beda: tanpa "-id").
      // Judul dari hasil Komiku/Shinigami bila ada, else dari slug mentah.
      komikcast: async () => {
        if (isShiniId(slug)) throw new Error("Slug UUID tidak ada di Komikcast.");
        try {
          // Coba langsung dulu (kasus Komikcast-only, slug sudah tepat).
          return await fetchKomikcastDetail(slug);
        } catch {
          // Bukan slug Komikcast → resolve via judul (tahap 2 di bawah).
          throw new Error("Resolve Komikcast via judul.");
        }
      },
    },
    "detail",
  );
  // Tahap 2: resolve Komikcast via judul (exact match, konservatif).
  // Gagal = Komikcast absen, sisi lain tetap serve. AltTitle (EN) ikut
  // diteruskan sebagai jembatan bila judul utama beda ejaan.
  if (!data.komikcast && !isShiniId(slug)) {
    const title = data.shinigami?.title ?? data.komiku?.title ?? slug;
    const alt = data.shinigami?.altTitle ?? data.komiku?.altTitle;
    try {
      data.komikcast = await resolveKomikcastDetailForTitle(title, normalizeTitle, alt);
    } catch {
      // absen di Komikcast — normal, bukan error
    }
  }
  // Tahap 2b: slug Komikcast-only → coba resolve Shinigami via judul+alt
  // Komikcast (exact). Berhasil = halaman detail ikut dapat chapter + cover
  // Shinigami; gagal = tetap serve Komiku+Komikcast.
  if (!data.shinigami && data.komikcast && !isShiniId(slug)) {
    try {
      data.shinigami = await resolveShiniDetailForSlug(
        data.komikcast.slug,
        data.komikcast.altTitle,
      );
    } catch {
      // absen di Shinigami — normal, bukan error
    }
  }
  const merged: MergedMangaDetail | null = mergeDetails({
    ...(data.komiku ? { komiku: data.komiku } : {}),
    ...(data.shinigami ? { shinigami: data.shinigami } : {}),
    ...(data.komikcast ? { komikcast: data.komikcast } : {}),
  });
  if (!merged) throw new Error("Gagal memuat detail komik.");
  // Kembalikan sebagai MangaDetail (chapters = MergedChapterItem[] adalah
  // subtype ChapterItem[] + field tambahan) + tempel info sources.
  return merged as MangaDetail & Pick<MergedMangaDetail, "sources" | "sourceSlug">;
}

/** Daftar chapter satu komik berdasarkan slug. */
export async function getChapterList(slug: string): Promise<MangaDetail["chapters"]> {
  const detail = await getMangaDetail(slug);
  return detail.chapters;
}
