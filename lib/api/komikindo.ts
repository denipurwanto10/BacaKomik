import * as cheerio from "cheerio";
import type { ChapterData, ChapterItem, GenreRef, KomikType, MangaCard, MangaDetail, PagedResult } from "./types";

/**
 * Lapisan HTTP + parsing HTML Komikindo (komikindo.ch — WordPress).
 *
 * Pola sama seperti ./komiku.ts: fetch server-side + parse cheerio,
 * error dibungkus KomikuError agar route /api/* menanganinya seragam.
 *
 * Markup terverifikasi (fetch nyata, Sep 2026):
 * - Daftar: `.listupd .film-list .animepost` (+ homepage `.listupd.latestupdate-v2 .animepost`)
 *   - judul: `.tt h3 a`, link: `/komik/<slug>/`, cover: `.limit img[src]`
 *   - tipe: `span.typeflag` (teks: Manga/Manhwa/Manhua)
 *   - chapter list mini: `.adds .lsch a` ("Ch. N") + `span.datech` waktu
 * - Search: `GET /?s=<kw>&post_type=manga` → markup daftar yang sama
 * - Terbaru: `/komik-terbaru/` (+ `/page/N/`), per tipe: `/manga/`, `/manhwa/`, `/manhua/`
 * - Genre: `/genres/<slug>/` (+ `/page/N/`)
 * - Detail: `/komik/<slug>/` → `h1.entry-title`, `div.thumb img`, `.infox .spe span`,
 *   `.genre-info a`, `.entry-content-single` sinopsis, `div.bxcl ul#chapter_list li`
 *   (`span.lchx a` chapter + `span.dt` tanggal)
 * - Reader: `/<slug>-chapter-<n>/` → `div#Baca_Komik img`, `div.nextprev a[rel=prev]`,
 *   link `/komik/<slug>/` (daftar chapter), `h1.entry-title`
 */

const KI_BASE = "https://komikindo.ch";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export class KomikindoError extends Error {
  source: string;
  status?: number;
  constructor(message: string, source: string, status?: number) {
    super(message);
    this.name = "KomikindoError";
    this.source = source;
    this.status = status;
  }
}

async function fetchHtml(url: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12_000);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "User-Agent": UA, Referer: KI_BASE + "/", Accept: "text/html" },
      signal: ctrl.signal,
      next: { revalidate: 30 },
    });
  } catch (e) {
    throw new KomikindoError(
      e instanceof DOMException && e.name === "AbortError"
        ? "Komikindo terlalu lama merespons. Coba lagi."
        : "Tidak dapat terhubung ke Komikindo. Periksa koneksi internet lalu coba lagi.",
      url,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new KomikindoError(
      `Komikindo merespons dengan status ${res.status} untuk halaman ini.`,
      url,
      res.status,
    );
  }
  return res.text();
}

/** Path Komikindo dari href absolut/relatif, mis. "/komik/one-piece-id/". */
function toPath(href: string | undefined): string {
  if (!href) return "";
  try {
    return new URL(href, KI_BASE).pathname;
  } catch {
    return href;
  }
}

/** Slug dari path /komik/<slug>/. */
export function kiSlugFromPath(path: string): string {
  const m = path.match(/\/komik\/([^/]+)\/?/);
  return m ? decodeURIComponent(m[1]) : "";
}

/**
 * Metadata massal via WP REST API Komikindo (1 request = ≤50 slug):
 * sinopsis singkat + genre. Jauh lebih murah daripada fetch halaman detail
 * per kartu untuk daftar terbaru (markup daftar HTML tidak memuat sinopsis).
 * Gagal → Map kosong (kartu tetap tampil minim, tidak merusak halaman).
 */
export interface KiMeta {
  synopsis: string;
  genre: string;
}
export async function fetchKiMeta(slugs: string[]): Promise<Map<string, KiMeta>> {
  const out = new Map<string, KiMeta>();
  const uniq = [...new Set(slugs.filter(Boolean))];
  if (uniq.length === 0) return out;
  // CATATAN: WP REST Komikindo TIDAK mendukung daftar slug koma (hanya
  // 1 slug yang dicocokkan) — jadi fetch per slug. Respons kecil
  // (_fields terbatas), paralel 10 per batch, cache 5 menit.
  const one = async (slug: string): Promise<void> => {
    const url = `${KI_BASE}/wp-json/wp/v2/manga?slug=${encodeURIComponent(slug)}&per_page=1&_fields=slug,content,class_list`;
    let res: Response;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 12_000);
      try {
        res = await fetch(url, {
          headers: { "User-Agent": UA, Referer: KI_BASE + "/", Accept: "application/json" },
          signal: ctrl.signal,
          next: { revalidate: 300 },
        });
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return; // slug gagal → lewati, jangan gagalkan daftar
    }
    if (!res.ok) return;
    let arr: unknown;
    try {
      arr = await res.json();
    } catch {
      return;
    }
    if (!Array.isArray(arr) || arr.length === 0) return;
    const x = arr[0] as { slug?: string; content?: { rendered?: string }; class_list?: string[] };
    if (!x?.slug) return;
    // Sinopsis: teks polos content, potong singkat 1 baris (±120 char).
    const raw = (x.content?.rendered ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const synopsis = raw.length > 120 ? raw.slice(0, 120).replace(/\s+\S*$/, "") + "…" : raw;
    // Genre dari class_list: "genres-action" → "Action".
    const genres = (x.class_list ?? [])
      .filter((c) => c.startsWith("genres-"))
      .map((c) => c.slice("genres-".length).replace(/-/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()));
    const genre = [...new Set(genres)].slice(0, 3).join(", ");
    if (synopsis || genre) out.set(x.slug, { synopsis, genre });
  };
  for (let b = 0; b < uniq.length; b += 10) {
    await Promise.all(uniq.slice(b, b + 10).map(one));
  }
  return out;
}

function normalizeType(raw: string): KomikType | undefined {
  const v = raw.trim().toLowerCase();
  if (v.includes("manga")) return "Manga";
  if (v.includes("manhwa")) return "Manhwa";
  if (v.includes("manhua")) return "Manhua";
  return undefined;
}

function absUrl(src: string | undefined): string {
  if (!src) return "";
  const s = src.trim();
  if (!s || s.startsWith("data:")) return "";
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("http")) return s;
  return KI_BASE + (s.startsWith("/") ? s : "/" + s);
}

function pickImg($el: cheerio.Cheerio<any>): string {
  return absUrl(
    $el.attr("data-src") || $el.attr("data-lazy-src") || $el.attr("srcset")?.split(" ")[0] || $el.attr("src"),
  );
}

/** "Ch. 224" → "Chapter 224"; "Chapter 224" dibiarkan (jangan kupas "Ch" dari "Chapter"). */
function chapterLabel(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (/^chapter\b/i.test(t)) return t;
  const m = t.match(/^ch\.?\s+(.+)$/i);
  return m ? `Chapter ${m[1].trim()}` : t;
}

function dedupeCards(cards: MangaCard[]): MangaCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });
}

/**
 * Parser kartu `.animepost` — dipakai daftar, search, terbaru, genre, tipe.
 * Scope dipersempit ke `.listupd` agar sidebar "Terpopuler" tidak ikut.
 */
function parseAnimeCards($: cheerio.CheerioAPI): MangaCard[] {
  const cards: MangaCard[] = [];
  $(".listupd .animepost").each((_, el) => {
    const root = $(el);
    const link = root.find(".tt h3 a[href]").first();
    const href = toPath(link.attr("href"));
    const slug = kiSlugFromPath(href);
    const title = link.text().trim();
    if (!slug || !title) return;

    const thumbnail = pickImg(root.find(".limit img, .limietles img").first());
    // Tipe ada di CLASS span.typeflag ("typeflag Manhwa"), bukan teksnya.
    const type = normalizeType(root.find("span.typeflag").first().attr("class") ?? "");

    // Chapter mini list (.lsch): terbaru dulu — pertama = latest, terakhir
    // = awal (tombol "Awal" di kartu daftar). Di /komik-terbaru/ biasanya
    // hanya 1 chapter per kartu sehingga firstChapter absen — itu batas
    // markup (bukan bug): chapter awal + sinopsis lengkap hanya ada di
    // halaman detail (/komik/<slug>/).
    let latestChapter: MangaCard["latestChapter"];
    let firstChapter: MangaCard["firstChapter"];
    let updatedAt: string | undefined;
    root.find(".adds .lsch").each((i, l) => {
      const $l = $(l);
      const a = $l.find("a[href]").first();
      const url = toPath(a.attr("href"));
      if (!url || !/-chapter-/.test(url)) return;
      const label = chapterLabel(a.text());
      if (!label) return;
      if (i === 0 || !latestChapter) {
        latestChapter = { label, url };
        updatedAt = $l.find("span.datech").first().text().trim() || undefined;
      }
      // Timpa terus — sisa terakhir = chapter paling lama di mini list.
      // Bila mini list hanya 1 chapter, URL-nya sama dengan latest dan
      // dibuang saat push di bawah (tak ada info chapter lebih tua).
      firstChapter = { label, url };
    });

    cards.push({
      slug,
      title,
      thumbnail,
      ...(type ? { type } : {}),
      ...(updatedAt ? { updatedAt } : {}),
      ...(latestChapter ? { latestChapter } : {}),
      ...(firstChapter && firstChapter.url !== latestChapter?.url ? { firstChapter } : {}),
    });
  });
  return dedupeCards(cards);
}

/** Ada halaman berikut? — link /page/N/ di .pagination. */
function detectNextPage($: cheerio.CheerioAPI): boolean {
  let found = false;
  $(".pagination a[href]").each((_, el) => {
    const v = $(el).attr("href") || "";
    if (/\/page\/\d+\/?/.test(v)) found = true;
  });
  return found;
}

/* ------------------------------------------------------------------ */
/* Terbaru (/komik-terbaru/) + per tipe (/manga|manhwa|manhua/)         */
/* ------------------------------------------------------------------ */

export type KiTipe = "manga" | "manhwa" | "manhua";

export async function fetchKiLatest(page = 1, tipe?: KiTipe): Promise<PagedResult<MangaCard>> {
  const p = Math.max(1, page);
  const base = tipe ? `${KI_BASE}/${tipe}/` : `${KI_BASE}/komik-terbaru/`;
  const url = p > 1 ? `${base}page/${p}/` : base;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  return { items: parseAnimeCards($), hasNextPage: detectNextPage($) };
}

/* ------------------------------------------------------------------ */
/* Daftar / genre                                                       */
/* ------------------------------------------------------------------ */

export async function fetchKiByGenre(genre: string, page = 1): Promise<PagedResult<MangaCard>> {
  const p = Math.max(1, page);
  const base = `${KI_BASE}/genres/${encodeURIComponent(genre)}/`;
  const url = p > 1 ? `${base}page/${p}/` : base;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  return { items: parseAnimeCards($), hasNextPage: detectNextPage($) };
}

/* ------------------------------------------------------------------ */
/* Pencarian (/?s=<kw>&post_type=manga)                                 */
/* ------------------------------------------------------------------ */

export async function searchKiRemote(keyword: string): Promise<MangaCard[]> {
  const url = `${KI_BASE}/?s=${encodeURIComponent(keyword)}&post_type=manga`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);
  return parseAnimeCards($);
}

/* ------------------------------------------------------------------ */
/* Detail (/komik/<slug>/)                                              */
/* ------------------------------------------------------------------ */

export async function fetchKiDetail(slug: string): Promise<MangaDetail> {
  const clean = slug.replace(/^\/+|\/+$/g, "");
  const html = await fetchHtml(`${KI_BASE}/komik/${encodeURIComponent(clean)}/`);
  const $ = cheerio.load(html);

  const cover = pickImg($("div.thumb img").first());
  const rawTitle = $("h1.entry-title").first().text().replace(/\s+/g, " ").trim();
  const title = rawTitle.replace(/^komik\s+/i, "").trim() || rawTitle;

  const info: Record<string, string> = {};
  $(".infox .spe span").each((_, sp) => {
    const $sp = $(sp);
    const key = $sp.find("b").first().text().trim().replace(/:$/, "").toLowerCase();
    const val = $sp.clone().children("b").remove().end().text().replace(/\s+/g, " ").trim();
    if (key && val) info[key] = val;
  });

  const altTitle = info["judul alternatif"] || undefined;
  const authorRaw = info["pengarang"] || info["author"] || undefined;
  // Komikindo memisahkan Pengarang & Ilustrator — gabung jadi satu string author.
  const illustrator = info["ilustrator"] || undefined;
  const author =
    [authorRaw, illustrator && illustrator !== authorRaw ? illustrator : undefined]
      .filter(Boolean)
      .join(", ") || undefined;
  const statusRaw = (info["status"] || "").toLowerCase();
  const status = statusRaw.includes("jalan") || statusRaw.includes("ongoing")
    ? "Ongoing"
    : statusRaw.includes("tamat") || statusRaw.includes("completed") || statusRaw.includes("end")
      ? "Completed"
      : info["status"] || undefined;
  const type = info["jenis komik"] || undefined;

  const genres: GenreRef[] = [];
  $(".genre-info a[href]").each((_, a) => {
    const $a = $(a);
    const href = toPath($a.attr("href"));
    const m = href.match(/\/genres\/([^/]+)\/?/);
    const name = $a.text().trim();
    if (m && name) genres.push({ name, slug: m[1] });
  });

  const synopsis = $(".entry-content.entry-content-single, .entry-content-single")
    .first()
    .text()
    .replace(/\s+/g, " ")
    .trim();

  const chapters: ChapterItem[] = [];
  // id="chapter_list" menempel di div.bxcl (bukan di ul) — selektor harus
  // menarget li di dalamnya, bukan ul#chapter_list.
  $("#chapter_list li").each((_, li) => {
    const $li = $(li);
    const a = $li.find("span.lchx a[href]").first();
    const url = toPath(a.attr("href"));
    const chTitle = chapterLabel(a.text());
    const date = $li.find("span.dt").first().text().replace(/\s+/g, " ").trim() || undefined;
    if (url && chTitle) chapters.push({ title: chTitle, url, ...(date ? { date } : {}) });
  });

  if (!title) {
    throw new KomikindoError("Halaman Komikindo tidak memuat data yang dikenali.", `${KI_BASE}/komik/${clean}/`);
  }

  // Daftar chapter Komikindo terbaru-dulu; Awal = terakhir, Terbaru = pertama.
  const first = chapters.length > 0 ? chapters[chapters.length - 1] : undefined;
  const latest = chapters.length > 0 ? chapters[0] : undefined;

  return {
    slug: clean,
    title,
    ...(altTitle ? { altTitle } : {}),
    cover,
    synopsis,
    ...(type ? { type } : {}),
    genres,
    ...(author ? { author } : {}),
    ...(status ? { status } : {}),
    ...(first ? { firstChapter: { label: first.title, url: first.url } } : {}),
    ...(latest ? { latestChapter: { label: latest.title, url: latest.url } } : {}),
    chapters,
  };
}

/* ------------------------------------------------------------------ */
/* Reader (/<slug>-chapter-<n>/)                                        */
/* ------------------------------------------------------------------ */

/** Slug komik + token chapter dari path "/<slug>-chapter-<n>/". */
export function parseKiChapterPath(path: string): { mangaSlug: string; chapter: string } | null {
  const m = path.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)-chapter-(.+?)\/?$/i);
  if (!m) return null;
  return { mangaSlug: m[1], chapter: m[2] };
}

export async function fetchKiChapter(chapterPath: string): Promise<ChapterData> {
  const clean = "/" + chapterPath.replace(/^\/+|\/+$/g, "") + "/";
  const parsed = parseKiChapterPath(clean);
  if (!parsed) {
    throw new KomikindoError("Format URL chapter Komikindo tidak valid.", `${KI_BASE}${clean}`);
  }
  const html = await fetchHtml(`${KI_BASE}${clean}`);
  const $ = cheerio.load(html);

  const rawTitle = $("h1.entry-title").first().text().replace(/\s+/g, " ").trim();
  const title = rawTitle.replace(/^komik\s+/i, "").trim() || rawTitle;

  const images: string[] = [];
  $("div#Baca_Komik img").each((_, img) => {
    const src = absUrl($(img).attr("src"));
    if (!src) return;
    // Iklan GIF blogger + banner domain — bukan halaman komik.
    if (/blogger\.googleusercontent|gif$/i.test(src)) return;
    if (/arat|arab777|gaza88|ratu89|indo666|penta|kaiko/i.test(src)) return;
    images.push(src);
  });

  // Navigasi: prev dari markup, manga slug dari link /komik/<slug>/.
  let prevUrl: string | undefined;
  let kiMangaSlug = "";
  $("div.nextprev a[href]").each((_, a) => {
    const href = toPath($(a).attr("href"));
    if (!href) return;
    if (/-chapter-/.test(href)) prevUrl = prevUrl ?? href;
    else if (/\/komik\//.test(href)) kiMangaSlug = kiSlugFromPath(href);
  });
  if (!kiMangaSlug) kiMangaSlug = parsed.mangaSlug;
  // Path detail gaya Komikindo (/komik/<slug>/) — frontend memakai mangaSlug
  // untuk link /komik/<slug>, field ini hanya info asal.
  const mangaUrl = `/komik/${kiMangaSlug}/`;

  // Next akurat dari daftar chapter (terbaru dulu): index-1 = lebih baru.
  let nextUrl: string | undefined;
  try {
    const detailHtml = await fetchHtml(`${KI_BASE}/komik/${encodeURIComponent(kiMangaSlug)}/`);
    const $$ = cheerio.load(detailHtml);
    const list: string[] = [];
    $$("#chapter_list li span.lchx a[href]").each((_, a) => {
      const href = toPath($$(a).attr("href"));
      if (href && /-chapter-/.test(href)) list.push(href);
    });
    const norm = (u: string) => u.replace(/\/+$/, "").toLowerCase();
    const idx = list.findIndex((u) => norm(u) === norm(clean));
    if (idx > 0) nextUrl = list[idx - 1];
    if (idx >= 0 && idx + 1 < list.length) prevUrl = list[idx + 1];
  } catch {
    // Navigasi tetap jalan dengan prevUrl dari markup.
  }

  const chapterLabelText =
    title.replace(new RegExp(`^${kiMangaSlug.replace(/-/g, " ")}\\s*`, "i"), "").trim() || title;

  if (!title || images.length === 0) {
    throw new KomikindoError("Halaman chapter Komikindo tidak memuat gambar yang dikenali.", `${KI_BASE}${clean}`);
  }

  return {
    title,
    mangaSlug: kiMangaSlug,
    chapterLabel: chapterLabelText,
    images,
    ...(prevUrl ? { prevUrl } : {}),
    ...(nextUrl ? { nextUrl } : {}),
    mangaUrl,
  };
}

/* ------------------------------------------------------------------ */
/* Genre list — Komikindo tidak punya halaman /daftar-genre publik      */
/* yang stabil; daftar genre diambil dari halaman utama bila perlu.     */
/* Untuk agregator: genre Komikindo mengikuti slug Komiku (nama sama).  */
/* ------------------------------------------------------------------ */

export async function fetchKiGenres(): Promise<GenreRef[]> {
  const html = await fetchHtml(`${KI_BASE}/`);
  const $ = cheerio.load(html);
  const genres: GenreRef[] = [];
  const seen = new Set<string>();
  $("a[href*='/genres/']").each((_, a) => {
    const href = toPath($(a).attr("href"));
    const m = href.match(/\/genres\/([^/]+)\/?/);
    const name = $(a).text().trim();
    if (m && name && !seen.has(m[1])) {
      seen.add(m[1]);
      genres.push({ name, slug: m[1] });
    }
  });
  return genres;
}
