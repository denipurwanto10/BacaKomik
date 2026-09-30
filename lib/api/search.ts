/**
 * lib/api/search.ts — service pencarian.
 * Berjalan server-side, data 100% dari Komiku.org (lihat ./komiku.ts).
 */
import { searchMangaRemote } from "./komiku";
import type { MangaCard } from "./types";

/** Cari komik via API pencarian Komiku. */
export async function searchManga(keyword: string): Promise<MangaCard[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  return searchMangaRemote(kw);
}
