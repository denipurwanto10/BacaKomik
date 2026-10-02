# KomikFrost — Platform baca Manga, Manhwa & Manhua (agregator 3 source)

Seluruh data (judul, cover, genre, sinopsis, chapter, peringkat, gambar reader)
dimuat **langsung dari source upstream** setiap request. Tidak ada dummy data,
mock API, atau fake response — jika source tidak dapat diakses, UI menampilkan
error state yang jelas.

## Sumber data (prioritas: Shinigami > Komiku > Komikcast)

| Source | Bentuk | Contoh endpoint |
|---|---|---|
| Shinigami ⭐ PRIMARY | JSON API (`api.shngm.io/v1`) | `/manga/list`, `/manga/top`, `/manga/detail` |
| Komiku ↩ FALLBACK | HTML + fragment API (`api.komiku.org`) | `/manga/`, `?post_type=manga&s=`, `komiku.org/manga/<slug>/` |
| Komikcast ↩ FALLBACK | JSON API (`komikcast.top/api/v1`) | `/search`, `/series/<slug>`, `/series/<slug>/chapters`, `/home` |

Nomor chapter sama → Shinigami menang. Satu source gagal ≠ semua gagal
(`fetchAllSettled` + fallback per chapter). Detail endpoint Komiku:
`docs/API-KOMIKU.md`; adapter lain di `lib/api/`.

Dokumentasi hasil analisis endpoint: `docs/API-KOMIKU.md`.

| Fungsi | Source Komiku |
|---|---|
| Terbaru / rekomendasi | `api.komiku.org/manga/` (+ `/page/N/`, `?orderby=`, `?tipe=`, `?status=`) |
| Peringkat | `komiku.org/p/ranking/` (panel harian/mingguan/bulanan/total) |
| Pencarian | `api.komiku.org/?post_type=manga&s=` |
| Detail + daftar chapter | `komiku.org/manga/<slug>/` |
| Reader | `komiku.org/<slug>-chapter-<n>/` |
| Genre | `komiku.org/p/daftar-genre/` → `api.komiku.org/genre/<slug>/` |

Arsitektur: `Browser → Next.js API Route (/api/*) → upstream → JSON → UI`
(Komiku di-parse dengan cheerio, server-side, agar bebas CORS).

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
├── types.ts      # TypeScript interface gabungan
├── aggregator.ts # mergeCards/mergeDetails, SOURCE_PRIORITY, normalizeTitle (exact, tanpa fuzzy)
├── search.ts     # searchManga(keyword) — merge 3 source + ranking relevansi + flag exactMatch
├── manga.ts      # getLatest/getLatestPaged/getPopular/getRecommended/getMangaDetail (+ enrichKomikcastOnly)
├── komiku.ts     # HTTP + parser cheerio Komiku
├── shinigami.ts  # HTTP + mapping JSON Shinigami
├── komikcast.ts  # HTTP + mapping JSON Komikcast
├── chapter.ts    # getChapter(slug, chapter) — gabungan 3 source
└── genre.ts      # getGenres/getMangaByGenre
app/
├── page.tsx                 # homepage (peringkat, update terbaru, rekomendasi)
├── terbaru/                 # daftar + filter tipe + pagination (+ dedupe lintas-halaman client-side)
├── populer/                 # peringkat harian/mingguan/bulanan/total
├── cari/                    # pencarian (?q=) + label "hasil mirip"
├── komik/[slug]/            # detail + sinopsis + daftar chapter
├── baca/[slug]/[chapter]/   # reader (lazy loading, prefetch next-only, prev/next)
├── genre/ & genre/[slug]/   # daftar genre + komik per genre
├── masuk/                   # gate password situs pribadi
└── api/*/route.ts           # proxy server-side ke upstream
```

## Catatan

- Hanya request GET ke halaman/API publik; tanpa bypass auth/CAPTCHA/paywall/WAF,
  tanpa proxy publik, tanpa credential pihak lain.
- Gambar dimuat langsung dari CDN upstream dengan lazy loading — tanpa
  proxy/re-host image.
- Cache server singkat (`revalidate` per fetch) untuk mengurangi beban upstream.
- Situs pribadi (single-user): `robots` noindex + gate password (`middleware.ts`).
