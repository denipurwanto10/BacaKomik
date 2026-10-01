# KomikFrost — Platform baca Manga, Manhwa & Manhua (data nyata Komiku.org)

Seluruh data (judul, cover, genre, sinopsis, chapter, peringkat, gambar reader)
dimuat **langsung dari Komiku.org** setiap request. Tidak ada dummy data,
mock API, atau fake response — jika Komiku tidak dapat diakses, UI menampilkan
error state yang jelas.

## Sumber data

Dokumentasi hasil analisis endpoint: `docs/API-KOMIKU.md`.

| Fungsi | Source Komiku |
|---|---|
| Terbaru / rekomendasi | `api.komiku.org/manga/` (+ `/page/N/`, `?orderby=`, `?tipe=`, `?status=`) |
| Peringkat | `komiku.org/p/ranking/` (panel harian/mingguan/bulanan/total) |
| Pencarian | `api.komiku.org/?post_type=manga&s=` |
| Detail + daftar chapter | `komiku.org/manga/<slug>/` |
| Reader | `komiku.org/<slug>-chapter-<n>/` |
| Genre | `komiku.org/p/daftar-genre/` → `api.komiku.org/genre/<slug>/` |

Arsitektur: `Browser → Next.js API Route (/api/*) → Komiku.org → JSON → UI`
(parsing HTML dengan cheerio, server-side, agar bebas CORS).

## Menjalankan

```bash
npm install
npm run dev      # development
npm run build && npm start   # production
```

Buka http://localhost:3000.

## Struktur

```text
lib/api/
├── types.ts      # TypeScript interface dari response Komiku sebenarnya
├── komiku.ts     # HTTP + parser cheerio (satu-satunya yang menyentuh Komiku)
├── komiku-service.ts  # re-export terpusat
├── manga.ts      # getLatest/getPopular/getRecommended/getMangaDetail/getChapterList
├── chapter.ts    # getChapter(slug, chapter)
├── genre.ts      # getGenres/getMangaByGenre
└── search.ts     # searchManga(keyword)
app/
├── page.tsx                 # homepage (peringkat, update terbaru, rekomendasi)
├── terbaru/                 # daftar + filter tipe + pagination
├── populer/                 # peringkat harian/mingguan/bulanan/total
├── cari/                    # pencarian (?q=)
├── komik/[slug]/            # detail + sinopsis + daftar chapter
├── baca/[slug]/[chapter]/   # reader (lazy loading, prev/next)
├── genre/ & genre/[slug]/   # daftar genre + komik per genre
└── api/*/route.ts           # proxy server-side ke Komiku
```

## Catatan

- Hanya request GET ke halaman publik Komiku; tanpa bypass auth/CAPTCHA/paywall.
- Gambar dimuat langsung dari CDN Komiku dengan lazy loading + fallback
  `imageN.komiku.to → img.komiku.org` (meniru perilaku situs aslinya).
- Cache server singkat (5 menit) untuk mengurangi beban server Komiku.
