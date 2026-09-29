/**
 * lib/api/genre.ts — service genre (multi-source).
 * Daftar genre dari Komiku (98 genre, stabil); isi per genre digabung
 * Komiku + Komikindo (/genres/<slug>/) lalu dedupe.
 */
import { fetchGenres, fetchMangaByGenre } from "./komiku";
import { fetchKiByGenre, fetchKiGenres } from "./komikindo";
import { fetchAllSettled, mergeCards, normalizeTitle } from "./aggregator";
import type { GenreRef, PagedResult, MangaCard } from "./types";

/** Daftar semua genre (Komiku utama; Komikindo menambal yang belum ada). */
export async function getGenres(): Promise<GenreRef[]> {
  try {
    return await fetchGenres();
  } catch {
    return fetchKiGenres();
  }
}

/** Komik berdasarkan genre, berhalaman (gabungan unik dua source). */
export async function getMangaByGenre(
  genre: string,
  page = 1,
): Promise<PagedResult<MangaCard>> {
  const { data } = await fetchAllSettled(
    {
      komiku: () => fetchMangaByGenre(genre, page),
      komikindo: () => fetchKiByGenre(genre, page),
    },
    "genre",
  );
  const ku = data.komiku;
  const ki = data.komikindo;
  const items = mergeCards({ komiku: ku?.items ?? [], komikindo: ki?.items ?? [] });
  // Pagination mengikuti Komiku (route lama); hasNextPage true bila salah
  // satu source masih punya halaman berikut.
  return {
    items,
    hasNextPage: Boolean(ku?.hasNextPage || ki?.hasNextPage),
  };
}

/** Samakan slug genre Komikindo → Komiku (nama sama, case-insensitive). */
export async function resolveGenreSlug(slug: string): Promise<string> {
  const s = slug.toLowerCase();
  try {
    const genres = await getGenres();
    const hit = genres.find((g) => g.slug.toLowerCase() === s || normalizeTitle(g.name) === normalizeTitle(s));
    return hit ? hit.slug : slug;
  } catch {
    return slug;
  }
}
