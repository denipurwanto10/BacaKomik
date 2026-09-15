/**
 * API service terpusat — semua akses data Komiku.org lewat sini.
 *
 * Berjalan di server (dipakai oleh Route Handler /api/* dan Server
 * Components), sehingga browser tidak pernah menyentuh Komiku langsung
 * (menghindari CORS) dan markup di-parse sebelum sampai ke UI.
 */
export {
  fetchChapter,
  fetchCommentIds,
  fetchComments,
  fetchGenres,
  fetchHome,
  fetchMangaByGenre,
  fetchMangaDetail,
  fetchMangaList,
  fetchRanking,
  fetchReplies,
  KomikuError,
  mangaSlugFromPath,
  parseChapterPath,
  type CommentSort,
  type MangaListParams,
  type RankPeriod,
} from "./komiku";
export type {
  ApiError,
  ChapterData,
  ChapterItem,
  ChapterRef,
  CommentPage,
  GenreRef,
  KomikuComment,
  KomikuReply,
  KomikType,
  MangaCard,
  MangaDetail,
  PagedResult,
  ReplyPage,
} from "./types";
