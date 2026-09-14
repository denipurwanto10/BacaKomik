/**
 * API service terpusat — semua akses data Komiku.org lewat sini.
 *
 * Berjalan di server (dipakai oleh Route Handler /api/* dan Server
 * Components), sehingga browser tidak pernah menyentuh Komiku langsung
 * (menghindari CORS) dan markup di-parse sebelum sampai ke UI.
 */
export {
  fetchChapter,
  fetchGenres,
  fetchHome,
  fetchMangaByGenre,
  fetchMangaDetail,
  fetchMangaList,
  fetchRanking,
  KomikuError,
  mangaSlugFromPath,
  parseChapterPath,
  type MangaListParams,
  type RankPeriod,
} from "./komiku";
export type {
  ApiError,
  ChapterData,
  ChapterItem,
  ChapterRef,
  GenreRef,
  KomikType,
  MangaCard,
  MangaDetail,
  PagedResult,
} from "./types";
