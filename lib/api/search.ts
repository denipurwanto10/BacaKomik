/**
 * lib/api/search.ts — service pencarian (multi-source, berhalaman).
 * Berjalan server-side: ketiga source paralel → dedupe per halaman.
 */
import { fetchMangaDetail, searchMangaRemote } from "./komiku";
import { searchKomikcastRemote } from "./komikcast";
import { searchShiniRemote } from "./shinigami";
import { fetchAllSettled, mergeCards, normalizeTitle } from "./aggregator";
import type { MangaCard, PagedResult } from "./types";
import type { MergedMangaCard } from "./aggregator";

/** Ukuran halaman Shinigami per halaman UI (Komiku tetap 10/halaman upstream). */
const SHINI_PAGE_SIZE = 20;

/**
 * Skor relevansi judul terhadap kata kunci (0..1).
 * - 1 = judul memuat SEMUA token kata kunci (AND) → paling relevan.
 * - di bawah itu = proporsi token yang cocok.
 * - bonus kecil bila judul diawali kata kunci (exact-prefix).
 * Murni urutan tampil — tanpa membuang hasil, tanpa fuzzy.
 */
function relevanceScore(title: string, altTitle: string | undefined, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const norm = normalizeTitle(title);
  const alt = altTitle ? normalizeTitle(altTitle) : "";
  let hits = 0;
  for (const t of tokens) {
    if (t && (norm.includes(t) || (alt && alt.includes(t)))) hits++;
  }
  let score = hits / tokens.length;
  const kw = tokens.join(" ");
  if (kw && (norm === kw || norm.startsWith(kw))) score += 0.05;
  return Math.min(1.05, score);
}

/** Urutkan hasil merge: skor relevansi desc; stabil (urutan merge dipertahankan bila seri). */
function rankByRelevance(cards: MergedMangaCard[], keyword: string): MergedMangaCard[] {
  const tokens = normalizeTitle(keyword).split(" ").filter(Boolean);
  if (tokens.length <= 1) return cards;
  return cards
    .map((c, i) => ({ c, i, s: relevanceScore(c.title, c.altTitle, tokens) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.c);
}

/**
 * Cari komik di ketiga source, gabung + dedupe per halaman
 * (satu judul = satu item), lalu urutkan berdasar relevansi kata kunci.
 * Tiap source di-fetch sesuai halaman UI:
 * Komiku 10/halaman (pola /page/N/), Shinigami 20/halaman (?page=).
 * hasNextPage = salah satu source masih punya halaman berikut.
 * Hasil yang sinopsisnya kosong (judul murni Komiku — HTML search
 * Komiku tidak memuat sinopsis) di-enrich dari halaman detailnya:
 * paralel, max 10, gagal = biarin kosong (tetap tampil).
 */
export async function searchManga(
  keyword: string,
  page = 1,
): Promise<PagedResult<MangaCard>> {
  const kw = keyword.trim();
  if (!kw) return { items: [], hasNextPage: false };
  const p = Math.max(1, page);
  const { data } = await fetchAllSettled(
    {
      komiku: () => searchMangaRemote(kw, p),
      shinigami: () => searchShiniRemote(kw, p, SHINI_PAGE_SIZE),
      komikcast: () => searchKomikcastRemote(kw, p),
    },
    "search",
  );
  const merged = mergeCards({
    komiku: data.komiku?.items ?? [],
    shinigami: data.shinigami?.items ?? [],
    komikcast: data.komikcast?.items ?? [],
  });
  // Relevansi: judul yang memuat SEMUA token kata kunci naik ke atas;
  // yang cuma cocok sebagian tenggelam. Tanpa membuang hasil.
  const ranked = rankByRelevance(merged, kw);
  const needy = ranked.filter((c) => !c.synopsis && c.sourceSlug?.komiku).slice(0, 10);
  if (needy.length > 0) {
    await Promise.all(
      needy.map(async (c) => {
        try {
          const d = await fetchMangaDetail(c.sourceSlug!.komiku!);
          if (d.synopsis) c.synopsis = d.synopsis;
        } catch {
          // biarin kosong — kartu tetap tampil tanpa narasi
        }
      }),
    );
  }
  return {
    items: ranked,
    hasNextPage: Boolean(data.komiku?.hasNextPage || data.shinigami?.hasNextPage || data.komikcast?.hasNextPage),
  };
}
