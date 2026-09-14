/**
 * Tipe data berdasarkan struktur markup aktual dari Komiku.org.
 * Lihat docs/API-KOMIKU.md untuk dokumentasi endpoint & field.
 * Field yang tidak disediakan Komiku TIDAK dibuat-buat (opsional / hilang).
 */

/** Tipe komik: Manga (JP) | Manhwa (KR) | Manhua (CN) */
export type KomikType = "Manga" | "Manhwa" | "Manhua";

/** Satu kartu komik dari daftar (`.bge` / `article.ls2` / search). */
export interface MangaCard {
  /** slug dari URL /manga/<slug>/ */
  slug: string;
  title: string;
  /** URL absolut thumbnail (thumbnail.komiku.to / thumbnail.komiku.org) */
  thumbnail: string;
  /** Tipe komik; absen bila sumber tidak menyebutkannya */
  type?: KomikType;
  /** Genre utama / tema (teks bebas dari Komiku, mis. "Fantasi") */
  genre?: string;
  /** Info waktu update, mis. "2 jam lalu" */
  updatedAt?: string;
  /** Sinopsis singkat (hanya di fragment api.komiku.org/manga/) */
  synopsis?: string;
  /** Chapter pertama: { label, url } — url = path Komiku mis. /one-piece-chapter-1/ */
  firstChapter?: ChapterRef;
  /** Chapter terbaru: { label, url } */
  latestChapter?: ChapterRef;
  /** Jumlah views (hanya ranking) */
  views?: string;
  /** Peringkat (hanya ranking) */
  rank?: number;
}

/** Referensi singkat chapter (label + path URL Komiku). */
export interface ChapterRef {
  label: string;
  /** path absolut Komiku, mis. "/blue-lock-chapter-360/" */
  url: string;
}

/** Detail satu komik dari halaman /manga/<slug>/. */
export interface MangaDetail {
  slug: string;
  title: string;
  altTitle?: string;
  /** URL absolut cover */
  cover: string;
  synopsis: string;
  type?: string;
  theme?: string;
  genres: GenreRef[];
  author?: string;
  status?: string;
  rating?: string;
  readingDirection?: string;
  firstChapter?: ChapterRef;
  latestChapter?: ChapterRef;
  /** Daftar chapter lengkap (terbaru dulu), dari tabel #Daftar_Chapter */
  chapters: ChapterItem[];
}

/** Satu baris chapter di daftar chapter. */
export interface ChapterItem {
  /** label mis. "Chapter 360" */
  title: string;
  /** path Komiku mis. "/blue-lock-chapter-360/" */
  url: string;
  /** tanggal rilis "14/09/2026" — absen bila tidak ada */
  date?: string;
}

/** Satu genre dari /p/daftar-genre/. */
export interface GenreRef {
  /** nama tampilan, mis. "Action" */
  name: string;
  /** slug untuk /genre/<slug>/, mis. "action" */
  slug: string;
  /** jumlah judul — hanya ada di halaman daftar genre */
  count?: number;
}

/** Isi satu chapter dari halaman reader. */
export interface ChapterData {
  /** judul halaman, mis. "Blue Lock Chapter 360" */
  title: string;
  /** slug komik induk */
  mangaSlug: string;
  /** label chapter saat ini, mis. "Chapter 360" */
  chapterLabel: string;
  /** URL absolut gambar halaman (berurutan), tanpa gambar promosi */
  images: string[];
  /** path chapter sebelumnya (relatif Komiku) — absen bila tidak ada */
  prevUrl?: string;
  /** path chapter berikutnya — Komiku hanya menyediakan tombol Prev */
  nextUrl?: string;
  /** path halaman detail komik, mis. "/manga/blue-lock/" */
  mangaUrl: string;
}

/** Hasil list berhalaman dari fragment api.komiku.org. */
export interface PagedResult<T> {
  items: T[];
  /** false bila tidak ada halaman berikut (deteksi dari span hx-get page/N) */
  hasNextPage: boolean;
}

/** Error terstruktur dari lapisan API (diteruskan ke UI sebagai error state). */
export interface ApiError {
  message: string;
  /** endpoint/source Komiku yang gagal */
  source: string;
  status?: number;
}
