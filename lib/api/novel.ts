import * as cheerio from "cheerio";
import { KomikuError } from "./komiku";

/**
 * Lapisan HTTP + parsing HTML Meionovels (WordPress + plugin wp-manga /
 * tema Madara) — sumber section Novel.
 *
 * Sumber (dipakai situsnya sendiri, diverifikasi via fetch langsung):
 * - https://meionovels.com/novel/ (+ /page/N/)   daftar novel
 * - https://meionovels.com/?s=<kw>&post_type=wp-manga (+ &paged=N)  cari
 * - https://meionovels.com/novel/<slug>/          detail (info + Read First/Last)
 * - POST https://meionovels.com/novel/<slug>/ajax/chapters/  daftar chapter full (HTML)
 * - https://meionovels.com/novel/<slug>/<srv>/chapter-N/     isi chapter (teks)
 *
 * Semua fetch server-side (dari route /api/novel/*), tanpa bypass
 * autentikasi/CAPTCHA/pembatasan apa pun.
 */

const MEIO_BASE = "https://meionovels.com";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export interface NovelCard {
  slug: string;
  title: string;
  cover: string;
  /** Tipe novel dari situs, mis. "Web Novel China" (.manga-type). */
  type?: string;
  /** Genre pertama, mis. "Action" (hanya kartu search + hasil enrich). */
  genre?: string;
  latestChapter?: { label: string; url: string };
  firstChapter?: { label: string; url: string };
  /** Sinopsis singkat — hanya terisi setelah enrich dari halaman detail. */
  synopsis?: string;
  updatedAt?: string;
  rating?: string;
}

export interface NovelChapterRef {
  label: string;
  /** path relatif, mis. /novel/<slug>/htl/chapter-714/ */
  url: string;
  time?: string;
}

export interface NovelDetail {
  slug: string;
  title: string;
  cover: string;
  synopsis?: string;
  rating?: string;
  status?: string;
  author?: string;
  genres: string[];
  firstChapter?: NovelChapterRef;
  latestChapter?: NovelChapterRef;
  chapters: NovelChapterRef[];
}

export interface NovelChapterData {
  novelSlug: string;
  novelTitle: string;
  chapterLabel: string;
  /** paragraf teks bersih */
  paragraphs: string[];
  prevUrl?: string;
  nextUrl?: string;
  listUrl: string;
}

async function fetchMeio(url: string, init?: RequestInit): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  const isPost = (init?.method || "GET").toUpperCase() === "POST";
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Referer: MEIO_BASE + "/",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
        "Upgrade-Insecure-Requests": "1",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "same-origin",
        "Sec-Fetch-User": "?1",
        // Situsnya sendiri memanggil ajax/chapters/ via XHR — samakan.
        ...(isPost ? { "X-Requested-With": "XMLHttpRequest" } : {}),
      },
      signal: ctrl.signal,
      next: { revalidate: 60 },
      ...init,
    });
  } catch (e) {
    throw new KomikuError(
      e instanceof DOMException && e.name === "AbortError"
        ? "Meionovels terlalu lama merespons. Coba lagi."
        : "Tidak dapat terhubung ke Meionovels. Periksa koneksi internet lalu coba lagi.",
      url,
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new KomikuError(
      `Meionovels merespons dengan status ${res.status} untuk halaman ini.`,
      url,
      res.status,
    );
  }
  return res.text();
}

/** "https://meionovels.com/novel/x/" → "x" ; chapter URL → slug novelnya. */
export function novelSlugFromUrl(url: string): string {
  try {
    const path = new URL(url, MEIO_BASE).pathname;
    const m = path.match(/\/novel\/([^/]+)\/?/);
    return m ? decodeURIComponent(m[1]) : "";
  } catch {
    return "";
  }
}

function toPath(href: string | undefined): string {
  if (!href) return "";
  try {
    return new URL(href, MEIO_BASE).pathname;
  } catch {
    return href;
  }
}

function pickImg($el: cheerio.Cheerio<any>): string {
  const s = ($el.attr("data-src") || $el.attr("src") || "").trim();
  if (!s || s.startsWith("data:")) return "";
  if (s.startsWith("//")) return "https:" + s;
  if (s.startsWith("http")) return s;
  return MEIO_BASE + (s.startsWith("/") ? s : "/" + s);
}

function dedupeNovels(cards: NovelCard[]): NovelCard[] {
  const seen = new Set<string>();
  return cards.filter((c) => {
    if (!c.slug || seen.has(c.slug)) return false;
    seen.add(c.slug);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Daftar (/novel/ + /page/N/) — kartu .page-listing-item               */
/* ------------------------------------------------------------------ */

function parseNovelListCards($: cheerio.CheerioAPI): NovelCard[] {
  const cards: NovelCard[] = [];
  $(".page-listing-item").each((_, el) => {
    const root = $(el);
    const titleLink = root.find(".post-title a[href*='/novel/']").first();
    const thumbLink = root.find(".item-thumb a[href*='/novel/']").first();
    const slug = novelSlugFromUrl(titleLink.attr("href") || thumbLink.attr("href") || "");
    const title = titleLink.text().trim() || thumbLink.attr("title")?.trim() || "";
    if (!slug || !title) return;
    const cover = pickImg(root.find("img").first());
    const type = root.find(".manga-type").first().text().trim().slice(0, 40) || undefined;
    const chA = root.find(".list-chapter .chapter-item .chapter a").first();
    const chHref = toPath(chA.attr("href"));
    const chLabel = chA
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 60);
    const time =
      root.find(".list-chapter .chapter-item .post-on").first().text().trim().replace(/\s+/g, " ") ||
      undefined;
    const rating = root.find(".score, .post-rating").first().text().trim().slice(0, 10) || undefined;
    cards.push({
      slug,
      title,
      cover,
      ...(type ? { type } : {}),
      ...(chHref && chLabel ? { latestChapter: { label: chLabel, url: chHref } } : {}),
      ...(time ? { updatedAt: time } : {}),
      ...(rating ? { rating } : {}),
    });
  });
  return dedupeNovels(cards);
}

function detectListNextPage($: cheerio.CheerioAPI): boolean {
  let found = false;
  $(".nav-links a, .wp-pagenavi a, .pagination a").each((_, el) => {
    const href = $(el).attr("href") || "";
    if (/\/page\/\d+\/?/.test(href)) found = true;
  });
  return found;
}

export async function fetchNovelList(
  page = 1,
  opts: { enrich?: boolean } = {},
): Promise<{ items: NovelCard[]; hasNextPage: boolean }> {
  const p = Math.max(1, page);
  const url = p > 1 ? `${MEIO_BASE}/novel/page/${p}/` : `${MEIO_BASE}/novel/`;
  const $ = cheerio.load(await fetchMeio(url));
  const items = parseNovelListCards($);
  // Halaman list tidak memuat sinopsis/firstChapter — enrich max 6 kartu
  // dari detail (paralel, gagal = kartu tetap tampil minimal).
  if (opts.enrich) await enrichNovelCards(items, 6);
  return { items, hasNextPage: detectListNextPage($) };
}

/** Potong sinopsis jadi ±2 kalimat untuk kartu list. */
function shortSynopsis(s: string): string {
  const flat = s.replace(/\s+/g, " ").trim();
  const parts = flat.match(/[^.!?]+[.!?]+/g);
  const out = (parts && parts.length > 0 ? parts.slice(0, 2).join(" ") : flat).trim();
  return out.length > 220 ? out.slice(0, 217).trimEnd() + "…" : out;
}

/**
 * Lengkapi kartu novel dengan sinopsis (2 kalimat) + firstChapter dari
 * halaman detail. Bounded: max N kartu, paralel, satu gagal tidak
 * menggagalkan yang lain.
 */
export async function enrichNovelCards(cards: NovelCard[], max = 6): Promise<void> {
  const needy = cards.filter((c) => !c.synopsis || !c.firstChapter).slice(0, max);
  await Promise.all(
    needy.map(async (c) => {
      try {
        const d = await fetchNovelDetail(c.slug);
        if (!c.synopsis && d.synopsis) c.synopsis = shortSynopsis(d.synopsis);
        if (!c.firstChapter && d.firstChapter) c.firstChapter = d.firstChapter;
        if (!c.genre && d.genres.length > 0) c.genre = d.genres[0];
        // Detail juga tahu latest yang lebih akurat (daftar chapter full).
        if (d.latestChapter) c.latestChapter = d.latestChapter;
      } catch {
        // biarin minimal — kartu tetap tampil
      }
    }),
  );
}

/* ------------------------------------------------------------------ */
/* Cari (?s= + post_type=wp-manga) — kartu .c-tabs-item__content         */
/* ------------------------------------------------------------------ */

export async function searchNovelRemote(
  keyword: string,
  page = 1,
  opts: { enrich?: boolean } = {},
): Promise<{ items: NovelCard[]; hasNextPage: boolean }> {
  const kw = keyword.trim();
  if (kw.length < 2) return { items: [], hasNextPage: false };
  const p = Math.max(1, page);
  const url =
    `${MEIO_BASE}/?s=${encodeURIComponent(kw)}&post_type=wp-manga` + (p > 1 ? `&paged=${p}` : "");
  const $ = cheerio.load(await fetchMeio(url));
  const cards: NovelCard[] = [];
  $(".c-tabs-item__content").each((_, el) => {
    const root = $(el);
    const link = root.find(".post-title a").first();
    const slug = novelSlugFromUrl(link.attr("href") || "");
    const title = link.text().trim();
    if (!slug || !title) return;
    const cover = pickImg(root.find("img").first());
    const genre =
      root.find(".mg_genres .summary-content a").first().text().trim().slice(0, 30) || undefined;
    const chA = root.find(".latest-chap .chapter a, .tab-meta .chapter a").first();
    const chHref = toPath(chA.attr("href"));
    const chLabel = chA.text().trim().replace(/\s+/g, " ").slice(0, 60);
    const time =
      root.find(".latest-chap .post-on, .tab-meta .post-on").first().text().trim() || undefined;
    cards.push({
      slug,
      title,
      cover,
      ...(genre ? { genre } : {}),
      ...(chHref && chLabel ? { latestChapter: { label: chLabel, url: chHref } } : {}),
      ...(time ? { updatedAt: time } : {}),
    });
  });
  const items = dedupeNovels(cards);
  if (opts.enrich) await enrichNovelCards(items, 6);
  // Search Madara tanpa penanda next yang jelas — halaman penuh (12 kartu)
  // berarti kemungkinan masih ada halaman berikut (terverifikasi p1 vs p2).
  return { items, hasNextPage: items.length >= 12 };
}

/* ------------------------------------------------------------------ */
/* Detail (/novel/<slug>/) + daftar chapter (ajax/chapters/)            */
/* ------------------------------------------------------------------ */

function parseNovelChapters(html: string): NovelChapterRef[] {
  const $ = cheerio.load(html);
  const out: NovelChapterRef[] = [];
  const seen = new Set<string>();
  $("li.wp-manga-chapter a").each((_, el) => {
    const a = $(el);
    const url = toPath(a.attr("href"));
    const label = a
      .clone()
      .children()
      .remove()
      .end()
      .text()
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 80) || a.text().trim().replace(/\s+/g, " ").slice(0, 80);
    if (!url || !label || seen.has(url)) return;
    seen.add(url);
    const time = a.parent().find(".chapter-release-date, .chapter-time").first().text().trim() || undefined;
    out.push({ label, url, ...(time ? { time } : {}) });
  });
  return out;
}

export async function fetchNovelDetail(slug: string): Promise<NovelDetail> {
  const s = slug.replace(/^\/+|\/+$/g, "");
  if (!s) throw new KomikuError("Slug novel kosong.", `${MEIO_BASE}/novel/`, 400);
  const base = `${MEIO_BASE}/novel/${encodeURIComponent(s)}/`;
  const $ = cheerio.load(await fetchMeio(base));

  const title =
    $("h1").first().text().trim() ||
    $(".post-title h1, .post-title").first().text().trim() ||
    s;
  const cover = pickImg($(".summary_image img, .post-thumbnail img").first());
  const synopsis =
    $(".description-summary .summary__content").text().trim().replace(/\s+/g, " ").slice(0, 2000) ||
    undefined;

  // Info box: label di .summary-heading + nilai di .summary-content.
  const info: Record<string, string> = {};
  $(".post-content_item, .post-content-item").each((_, el) => {
    const label = $(el).find(".summary-heading").first().text().trim().toLowerCase();
    const val = $(el).find(".summary-content").first().text().trim().replace(/\s+/g, " ");
    if (label && val) info[label] = val;
  });
  const genres: string[] = [];
  $(".post-content_item:contains('Genre') .summary-content a, .mg_genres a").each((_, el) => {
    const g = $(el).text().trim();
    if (g && !genres.includes(g)) genres.push(g);
  });
  const author =
    info["author(s)"] ||
    $(".author-content a").first().text().trim() ||
    undefined;
  const status = info["status"] || undefined;
  const rating =
    $(".post-total-rating .score, .ratings_stars + .score, .summary-content.vote-details")
      .first()
      .text()
      .trim()
      .slice(0, 20) || undefined;

  // Read First / Read Last — id tertukar di markup (btn-read-last = First),
  // jadi baca dari teks link, bukan id.
  let firstChapter: NovelChapterRef | undefined;
  let lastChapter: NovelChapterRef | undefined;
  $("#init-links a").each((_, el) => {
    const a = $(el);
    const t = a.text().trim().toLowerCase();
    const url = toPath(a.attr("href"));
    if (!url) return;
    if (t.includes("first")) firstChapter = { label: "Chapter awal", url };
    else if (t.includes("last")) lastChapter = { label: "Chapter terbaru", url };
  });

  // Daftar chapter full via endpoint ajax internal (POST, tanpa auth).
  let chapters: NovelChapterRef[] = [];
  try {
    const chHtml = await fetchMeio(`${base}ajax/chapters/`, { method: "POST" });
    chapters = parseNovelChapters(chHtml);
  } catch {
    // Gagal = daftar kosong, Awal/Terbaru dari Read First/Last tetap ada.
  }
  const latestChapter =
    chapters.length > 0
      ? chapters[0]
      : lastChapter
        ? { label: lastChapter.label, url: lastChapter.url }
        : undefined;
  const first =
    chapters.length > 0
      ? chapters[chapters.length - 1]
      : firstChapter
        ? { label: firstChapter.label, url: firstChapter.url }
        : undefined;

  return {
    slug: s,
    title,
    cover,
    ...(synopsis ? { synopsis } : {}),
    ...(rating ? { rating } : {}),
    ...(status ? { status } : {}),
    ...(author ? { author } : {}),
    genres,
    ...(first ? { firstChapter: first } : {}),
    ...(latestChapter ? { latestChapter } : {}),
    chapters,
  };
}

/* ------------------------------------------------------------------ */
/* Isi chapter (teks) — /novel/<slug>/<srv>/chapter-N/                  */
/* ------------------------------------------------------------------ */

export async function fetchNovelChapter(chapterPath: string): Promise<NovelChapterData> {
  const path = chapterPath.startsWith("/") ? chapterPath : `/${chapterPath}`;
  const $ = cheerio.load(await fetchMeio(`${MEIO_BASE}${path}`));
  const slug = novelSlugFromUrl(path);
  const fullTitle = $("h1").first().text().trim();
  const novelTitle =
    $(".breadcrumb a").last().text().trim() ||
    fullTitle.split(" - ")[0]?.trim() ||
    slug;
  const chapterLabel =
    fullTitle
      .replace(novelTitle, "")
      .replace(/^[-\s]+/, "")
      .trim()
      .slice(0, 100) || "Chapter";

  const paragraphs: string[] = [];
  const seen = new Set<string>();
  $(".reading-content p, .text-content p, .entry-content p").each((_, el) => {
    const t = $(el).text().trim().replace(/\s+/g, " ");
    if (!t || t.length < 2 || seen.has(t)) return;
    // Buang baris navigasi/iklan yang nyangkut di konten.
    if (/^(prev|next|daftar isi|chapter (sebelumnya|berikutnya))/i.test(t) && t.length < 40) return;
    seen.add(t);
    paragraphs.push(t);
  });

  let prevUrl: string | undefined;
  let nextUrl: string | undefined;
  $("a").each((_, el) => {
    const t = $(el).text().trim();
    const href = toPath($(el).attr("href"));
    if (!href || !href.includes("/novel/")) return;
    if (/^prev$/i.test(t)) prevUrl = href;
    else if (/^next$/i.test(t)) nextUrl = href;
  });

  if (paragraphs.length === 0) {
    throw new KomikuError("Isi chapter tidak ditemukan di Meionovels.", `${MEIO_BASE}${path}`, 404);
  }
  return {
    novelSlug: slug,
    novelTitle,
    chapterLabel,
    paragraphs,
    ...(prevUrl ? { prevUrl } : {}),
    ...(nextUrl ? { nextUrl } : {}),
    listUrl: `/novel/${slug}`,
  };
}
