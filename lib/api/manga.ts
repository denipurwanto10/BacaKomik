/**
 * lib/api/manga.ts — service daftar & detail komik.
 * Berjalan server-side, data 100% dari Komiku.org (lihat ./komiku.ts).
 */
import {
  fetchHome,
  fetchMangaDetail,
  fetchMangaList,
  type MangaListParams,
} from "./komiku";
import type { ChapterItem, MangaCard, MangaDetail } from "./types";

/** Chapter terbaru yang baru update (sumber: komiku.org + api.komiku.org). */
export async function getLatest(page = 1): Promise<MangaCard[]> {
  const params: MangaListParams = { orderby: "modified", page, fresh: true };
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
}

/** Komik populer — peringkat harian dari /p/ranking/. */
export async function getPopular(): Promise<MangaCard[]> {
  const { fetchRanking } = await import("./komiku");
  return fetchRanking("harian");
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

/** Komik rekomendasi — acak dari ?orderby=rand, dikocok ulang tiap request. */
export async function getRecommended(): Promise<MangaCard[]> {
  // Coba 2x seperti getLatest — kegagalan fragment API sering sementara.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { items } = await fetchMangaList({ orderby: "rand", fresh: true });
      if (items.length > 0) return shuffle(items);
    } catch {
      // coba lagi sebelum fallback
    }
  }
  try {
    const { items } = await fetchMangaList({ orderby: "date" });
    return shuffle(items);
  } catch {
    return [];
  }
}

/** Update chapter terbaru (alias getLatest halaman pertama, untuk homepage). */
export async function getLatestUpdate(): Promise<MangaCard[]> {
  return getLatest(1);
}

/** Detail satu komik berdasarkan slug (/manga/<slug>/). */
export async function getMangaDetail(slug: string): Promise<MangaDetail> {
  return fetchMangaDetail(slug);
}

/** Daftar chapter satu komik berdasarkan slug. */
export async function getChapterList(slug: string): Promise<ChapterItem[]> {
  const detail = await fetchMangaDetail(slug);
  return detail.chapters;
}
