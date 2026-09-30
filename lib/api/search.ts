/**
 * lib/api/search.ts — service pencarian (multi-source).
 * Berjalan server-side: Shinigami + Komiku paralel → dedupe.
 */
import { fetchMangaDetail, searchMangaRemote } from "./komiku";
import { searchShiniRemote } from "./shinigami";
import { fetchAllSettled, mergeCards } from "./aggregator";
import type { MangaCard } from "./types";

/**
 * Cari komik di kedua source, gabung + dedupe (satu judul = satu item).
 * Hasil yang sinopsisnya kosong (cuma terjadi di judul murni Komiku —
 * HTML search Komiku tidak memuat sinopsis) di-enrich dari halaman
 * detailnya: paralel, max 10, gagal = biarin kosong (tetap tampil).
 */
export async function searchManga(keyword: string): Promise<MangaCard[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  const { data } = await fetchAllSettled(
    {
      komiku: () => searchMangaRemote(kw),
      shinigami: () => searchShiniRemote(kw),
    },
    "search",
  );
  const merged = mergeCards({ komiku: data.komiku ?? [], shinigami: data.shinigami ?? [] });
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
  return merged;
}
