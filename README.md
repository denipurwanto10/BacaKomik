# KomikFrost — Baca Manga, Manhwa & Manhua (agregator 3 source)

Situs baca pribadi (single-user, gate password): manga, manhwa, manhua
Bahasa Indonesia. Seluruh data (judul, cover, genre, sinopsis, chapter,
peringkat, gambar reader) dimuat **langsung dari source upstream** setiap
request. Tidak ada dummy data, mock API, atau fake response — jika source
tidak dapat diakses, UI menampilkan error state yang jelas.

## Sumber data (prioritas: Shinigami > Komiku > Komikcast)

| Source | Bentuk | Contoh endpoint |
|---|---|---|
| Shinigami ⭐ PRIMARY | JSON API (`api.shngm.io/v1`) | `/manga/list`, `/manga/top`, `/manga/detail` |
| Komiku ↩ FALLBACK | HTML + fragment API (`api.komiku.org`) | `/manga/`, `?post_type=manga&s=`, `komiku.org/manga/<slug>/` |
| Komikcast ↩ FALLBACK | JSON API (`komikcast.top/api/v1`) | `/search`, `/series/<slug>`, `/series/<slug>/chapters`, `/home` |

Nomor chapter sama → Shinigami menang. Satu source gagal ≠ semua gagal
(`fetchAllSettled` + fallback per chapter).

Arsitektur: `Browser → Next.js API Route (/api/*) → upstream → JSON → UI`
(Komiku di-parse dengan cheerio, server-side, agar bebas CORS).
Gambar dimuat langsung dari CDN upstream dengan lazy loading — tanpa
proxy/re-host image.

| Fungsi | Source |
|---|---|
| Terbaru / rekomendasi | Komiku `api.komiku.org/manga/` (+ `/page/N/`, `?orderby=`, `?tipe=`, `?status=`) + Shinigami `/manga/list` (`is_update`, `sort=latest`) |
| Peringkat | Komiku `komiku.org/p/ranking/` (panel harian/mingguan/bulanan/total) + Shinigami `/manga/top` |
| Pencarian | Komiku `api.komiku.org/?post_type=manga&s=` + Shinigami `/manga/list?q=` + Komikcast `/search` |
| Detail + daftar chapter | Komiku `komiku.org/manga/<slug>/` + Shinigami `/manga/detail` + Komikcast `/series/<slug>` |
| Reader | `komiku.org/<slug>-chapter-<n>/` + Shinigami `/chapter/detail` + Komikcast `/chapters` |
| Genre | Komiku `komiku.org/p/daftar-genre/` → `api.komiku.org/genre/<slug>/` + Shinigami `/genre/list` |

Dokumentasi hasil analisis endpoint: `docs/API-KOMIKU.md` (khusus Komiku;
adapter Shinigami/Komikcast didokumentasikan di header `lib/api/shinigami.ts`
dan `lib/api/komikcast.ts`).

## Pagination

`/terbaru`, `/genre/[slug]`, `/cari` tampil **15 kartu per halaman**
(gabungan multi-source dipotong di server via `slice(0, 15)`; Shinigami
diminta `page_size=15`, Komiku ±15–20/halaman upstream). Satu judul = satu
kartu (dedupe `normalizeTitle` exact + jembatan altTitle). `/populer` tampil
20 (ranking penuh, bukan pagination). `/cari` tanpa exact-match = "hasil
mirip", tanpa pagination bila 1 judul.

## Menjalankan

```bash
npm install
npm run dev      # development
npm run build && npm start   # production
```

Buka http://localhost:3000. Login via `/masuk` (`SITE_PASSWORD` di env).

## Struktur

```text
lib/api/
├── types.ts      # TypeScript interface gabungan
├── aggregator.ts # mergeCards/mergeDetails, SOURCE_PRIORITY, normalizeTitle (exact, tanpa fuzzy)
├── search.ts     # searchManga(keyword) — merge 3 source + ranking relevansi + flag exactMatch
├── manga.ts      # getLatest/getLatestPaged/getPopular/getRecommended/getMangaDetail (+ enrichKomikcastOnly)
├── komiku.ts         # HTTP + parser cheerio Komiku
├── komiku-service.ts # re-export terpusat akses Komiku (dipakai route /api/*)
├── shinigami.ts      # HTTP + mapping JSON Shinigami
├── komikcast.ts      # HTTP + mapping JSON Komikcast
├── chapter.ts        # getChapter(slug, chapter) — gabungan 3 source
└── genre.ts          # getGenres/getMangaByGenre
lib/
├── client.ts         # apiGet + cache/SWR client-side
├── history.ts        # riwayat baca (localStorage per perangkat)
├── bookmarks.ts      # favorit (localStorage per perangkat)
├── gate.ts           # helper cookie gate password
├── morph.ts          # animasi cover morph
└── page-title.ts     # judul tab dinamis (client components)
app/
├── page.tsx                 # homepage (peringkat, update terbaru, rekomendasi)
├── terbaru/                 # daftar + filter tipe/status/genre + pagination 15 (+ dedupe lintas-halaman client-side)
├── populer/                 # peringkat harian/mingguan/bulanan/total
├── cari/                    # pencarian (?q=) + label "hasil mirip"
├── komik/[slug]/            # detail + sinopsis + daftar chapter
├── baca/[slug]/[chapter]/   # reader (lazy loading, prefetch next-only, prev/next)
├── genre/ & genre/[slug]/   # daftar genre + komik per genre (15/halaman)
├── favorit/ & riwayat/       # localStorage per perangkat
├── masuk/                   # gate password situs pribadi
├── loading.tsx / not-found.tsx / error.tsx  # fallback route global
└── api/*/route.ts           # proxy server-side ke upstream
```

## Catatan

- Hanya request GET ke halaman/API publik; tanpa bypass auth/CAPTCHA/paywall/WAF,
  tanpa proxy publik, tanpa credential pihak lain.
- Cache server singkat (`revalidate` per fetch) untuk mengurangi beban upstream.
- Situs pribadi (single-user): `robots` noindex + gate password (`middleware.ts`)
  + proteksi anti-index lapis transport.
