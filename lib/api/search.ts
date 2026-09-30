/**
 * lib/api/search.ts — service pencarian (multi-source, berhalaman).
 * Berjalan server-side: Shinigami + Komiku paralel → dedupe per halaman.
 */
import { fetchMangaDetail, searchMangaRemote } from "./komiku";
import { searchShiniRemote } from "./shinigami";
import { fetchAllSettled, mergeCards } from "./aggregator";
import type { MangaCard, PagedResult } from "./types";

/** Ukuran halaman Shinigami per halaman UI (Komiku tetap 10/halaman upstream). */
const SHINI_PAGE_SIZE = 20;

/**
 * Cari komik di kedua source, gabung + dedupe per halaman
 * (satu judul = satu item). Tiap source di-fetch sesuai halaman UI:
 * Komiku 10/halaman (pola /page/N/), Shinigami 20/halaman (?page=).
 * hasNextPage = salah satu source masih punya halaman berikut.
 * Hasil yang sinopsisnya kosong (judul murni Komiku — HTML search
 * Komiku tidak memuat sinopsis) di-enrich dari halaman detailnya:
 * paralel, max 10, gagal = biarin kosong (tetap tampil).
 */
export async function searchManga(
  keyword: string,
  page = 1,
): Promise<PagedResult<MangaCard>> {
  const kw = keyword.trim();
  if (!kw) return { items: [], hasNextPage: false };
  const p = Math.max(1, page);
  const { data } = await fetchAllSettled(
    {
      komiku: () => searchMangaRemote(kw, p),
      shinigami: () => searchShiniRemote(kw, p, SHINI_PAGE_SIZE),
    },
    "search",
  );
  const merged = mergeCards({ komiku: data.komiku?.items ?? [], shinigami: data.shinigami?.items ?? [] });
  const needy = merged.filter((c) => !c.synopsis && c.sourceSlug?.komiku).slice(0, 10);
  if (needy.length > 0) {
    await Promise.all(
      needy.map(async (c) => {
        try {
          const d = await fetchMangaDetail(c.sourceSlug!.komiku!);
          if (d.synopsis) c.synopsis = d.synopsis;
        } catch {
          // biarin kosong — kartu tetap tampil tanpa narasi
        }
      }),
    );
  }
  return {
    items: merged,
    hasNextPage: Boolean(data.komiku?.hasNextPage || data.shinigami?.hasNextPage),
  };
}
