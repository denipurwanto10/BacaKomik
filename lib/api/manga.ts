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
  const params: MangaListParams = { orderby: "modified", page };
  try {
    const { items } = await fetchMangaList(params);
    if (items.length > 0) return items;
  } catch {
    // fallback ke homepage bila fragment API gagal
  }
  const home = await fetchHome();
  return page > 1 ? [] : home.latest;
}

/** Komik populer — peringkat harian dari /p/ranking/. */
export async function getPopular(): Promise<MangaCard[]> {
  const { fetchRanking } = await import("./komiku");
  return fetchRanking("harian");
}

/** Komik rekomendasi — judul-judul terbaru dari ?orderby=date. */
export async function getRecommended(): Promise<MangaCard[]> {
  const { items } = await fetchMangaList({ orderby: "date" });
  return items;
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
