/**
 * lib/api/genre.ts — service genre.
 * Berjalan server-side, data 100% dari Komiku.org (lihat ./komiku.ts).
 */
import { fetchGenres, fetchMangaByGenre } from "./komiku";
import type { GenreRef, PagedResult, MangaCard } from "./types";

/** Daftar semua genre dari /p/daftar-genre/ (98 genre + jumlah judul). */
export async function getGenres(): Promise<GenreRef[]> {
  return fetchGenres();
}

/** Komik berdasarkan genre, berhalaman. */
export async function getMangaByGenre(
  genre: string,
  page = 1,
): Promise<PagedResult<MangaCard>> {
  return fetchMangaByGenre(genre, page);
}
