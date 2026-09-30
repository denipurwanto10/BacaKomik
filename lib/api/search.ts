/**
 * lib/api/search.ts — service pencarian (multi-source).
 * Berjalan server-side: Shinigami + Komiku paralel → dedupe.
 */
import { searchMangaRemote } from "./komiku";
import { searchShiniRemote } from "./shinigami";
import { fetchAllSettled, mergeCards } from "./aggregator";
import type { MangaCard } from "./types";

/** Cari komik di kedua source, gabung + dedupe (satu judul = satu item). */
export async function searchManga(keyword: string): Promise<MangaCard[]> {
  const kw = keyword.trim();
  if (!kw) return [];
  const { data } = await fetchAllSettled(
    {
      komiku: () => searchMangaRemote(kw),
      shinigami: () => searchShiniRemote(kw),
    },
    "search",
  );
  return mergeCards({ komiku: data.komiku ?? [], shinigami: data.shinigami ?? [] });
}
