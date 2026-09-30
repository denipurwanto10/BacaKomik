/**
 * lib/api/chapter.ts — service reader chapter (multi-source).
 * Default = Komikindo (source utama); Komiku hanya fallback eksplisit.
 */
import { fetchChapter } from "./komiku";
import { fetchKiChapter } from "./komikindo";
import type { ComicSourceId } from "./aggregator";
import type { ChapterData } from "./types";

/**
 * Ambil satu chapter.
 * @param slug    slug komik, mis. "blue-lock"
 * @param chapter nomor chapter, mis. "360" atau "11-2" untuk 11.2
 * @param source  source gambar ("komikindo" default/utama; "komiku" fallback)
 */
export async function getChapter(
  slug: string,
  chapter: string,
  source: ComicSourceId = "komikindo",
): Promise<ChapterData> {
  const s = slug.replace(/^\/+|\/+$/g, "");
  const c = chapter.replace(/^\/+|\/+$/g, "");
  if (source === "komiku") return fetchChapter(`/${s}-chapter-${c}/`);
  // Slug detail Komikindo berprefix ID ("229848-solo-leveling") tapi path
  // chapter tidak memakainya ("/solo-leveling-chapter-178/") — kupas dulu.
  const ki = s.replace(/^\d+-/, "");
  return fetchKiChapter(`/${ki}-chapter-${c}/`);
}
