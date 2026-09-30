/**
 * lib/api/chapter.ts — service reader chapter.
 * Berjalan server-side, data 100% dari Komiku.org (lihat ./komiku.ts).
 */
import { fetchChapter } from "./komiku";
import type { ChapterData } from "./types";

/**
 * Ambil satu chapter.
 * @param slug    slug komik, mis. "blue-lock"
 * @param chapter nomor chapter ala Komiku, mis. "360" atau "11-2" untuk 11.2
 */
export async function getChapter(slug: string, chapter: string): Promise<ChapterData> {
  const s = slug.replace(/^\/+|\/+$/g, "");
  const c = chapter.replace(/^\/+|\/+$/g, "");
  return fetchChapter(`/${s}-chapter-${c}/`);
}
