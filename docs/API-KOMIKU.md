# Sumber Data Komiku.org — Hasil Analisis (14 Sep 2026)

Komiku.org **tidak memiliki public JSON API**. Semua data diambil dari HTML
server-rendered + satu fragment-HTML API resmi yang dipakai situsnya sendiri via htmx.

## Endpoint yang digunakan (semuanya milik Komiku, diakses server-side via Next.js proxy)

| Fungsi | Source |
|---|---|
| `getLatest()` (chapter terbaru) | `GET https://api.komiku.org/manga/` (+ `/manga/page/N/`, `?orderby=modified`) |
| `getPopular()` (peringkat harian) | `GET https://komiku.org/p/ranking/` panel `#rank-harian` |
| `getRecommended()` (komik baru) | `GET https://api.komiku.org/manga/?orderby=date` |
| `searchManga(keyword)` | `GET https://api.komiku.org/?post_type=manga&s=<kw>` |
| `getMangaDetail(slug)` | `GET https://komiku.org/manga/<slug>/` |
| `getChapterList(slug)` | sama — tabel `#Daftar_Chapter` di halaman detail |
| `getChapter(slug, chapter)` | `GET https://komiku.org/<slug>-chapter-<n>/` → `#Baca_Komik img` |
| `getGenres()` | `GET https://komiku.org/p/daftar-genre/` → `a.gnr` (98 genre + jumlah judul) |
| `getMangaByGenre(genre, page)` | `GET https://api.komiku.org/genre/<slug>/` (+ `/page/N/`) |

Parameter terverifikasi: `?tipe=manga|manhwa|manhua`, `?orderby=modified|date|popular`,
`?status=ongoing|end`, pagination path `/page/N/` (digabung dengan query string).

## Struktur markup yang di-parse (cheerio, server-side)

- **List (`.bge`)**: `h3` judul, `a href /manga/<slug>/`, `img src` thumbnail,
  `.tpe1_inf` = `<b>Tipe</b> Genre`, `.judul2` = `Genre | waktu | Berwarna?`,
  `p` sinopsis singkat, `.new1 a` = chapter Awal/Terbaru.
- **Search (`.bge`)**: sama, tanpa `.judul2`; `p` = `Update X lalu`.
- **Ranking (`article.ls4`)**: `.rank-num`, `h4 a` judul+slug, `img[data-src|src]`,
  `.ls4s` = `Genre · N views`, `a.ls24` = chapter terbaru.
- **Detail**: `.ims img` cover, `p.desc` sinopsis, `table.inftable` (Judul,
  Judul Alternatif, Tipe, Tema, Genre `ul.genre a`, Author, Status, Rating,
  Cara Baca), `.new1 a` chapter Awal/Terbaru, `#Daftar_Chapter tr` (link +
  `td.tanggalseries`).
- **Chapter**: `h1` judul, `#Baca_Komik img` (skip `komiku-promosi`),
  `.toolbar a.btn[aria-label=Prev/List]` navigasi. Chapter URL:
  `/<slug>-chapter-<n>/` (desimal memakai `-` mis. `chapter-11-2`).
- **Genre list**: `a.gnr` → `/genre/<slug>/`, `<b>` nama, `<i>` jumlah judul.

## Gambar

Hotlink langsung OK (HTTP 200): `image{2..8}.komiku.to`, `thumbnail.komiku.to`,
`thumbnail.komiku.org`. Fallback `imageN.komiku.to → img.komiku.org`
(seperti `onerror` bawaan Komiku). Di Next.js dipakai `<img loading="lazy">`
biasa (bukan `next/image`) agar domain apa pun bisa tampil tanpa config.

## Catatan kepatuhan

- Hanya GET halaman publik, tanpa bypass auth/CAPTCHA/paywall.
- Konten dimuat ulang tiap request dari Komiku (plus cache singkat untuk
  mengurangi beban), bukan disalin permanen.
- Jika Komiku gagal/unreachable → tampilkan error state, tanpa dummy data.
