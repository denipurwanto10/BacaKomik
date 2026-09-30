/**
 * lib/api/chapter.ts — service reader chapter (multi-source).
 * SHINIGAMI UTAMA; Komiku mengisi per chapter yang tidak ada di Shinigami.
 */
import { fetchChapter, KomikuError } from "./komiku";
import {
  fetchShiniChapter,
  isShiniId,
  parseNumToken,
  resolveShiniDetailForSlug,
} from "./shinigami";
import { getMangaDetail } from "./manga";
import { chapterNum, type ComicSourceId, type MergedMangaDetail } from "./aggregator";
import type { ChapterData } from "./types";

/**
 * Ambil satu chapter.
 * @param slug    slug Komiku ("blue-lock") atau UUID Shinigami
 * @param chapter nomor chapter, mis. "360" atau "11-2" untuk 11.2
 * @param source  override manual ("shinigami"/"komiku"); default otomatis
 *                per daftar chapter gabungan (Shinigami bila nomor ada di sana)
 */
export async function getChapter(
  slug: string,
  chapter: string,
  source?: ComicSourceId,
): Promise<ChapterData> {
  const s = slug.replace(/^\/+|\/+$/g, "");
  const c = chapter.replace(/^\/+|\/+$/g, "");
  const num = parseNumToken(c);

  // Override eksplisit (dipakai ?source=... saat satu sisi gagal total).
  if (source === "komiku") return fetchChapter(`/${s}-chapter-${c}/`);
  if (source === "shinigami") {
    if (isShiniId(s)) {
      if (!Number.isFinite(num)) throw new KomikuError("Nomor chapter tidak valid.", s);
      return fetchShiniChapter(s, num, s, "");
    }
    return getChapterMerged(s, c, num, "shinigami");
  }

  // Slug UUID murni → langsung Shinigami (tanpa Komiku).
  if (isShiniId(s)) {
    if (!Number.isFinite(num)) throw new KomikuError("Nomor chapter tidak valid.", s);
    return fetchShiniChapter(s, num, s, "");
  }

  return getChapterMerged(s, c, num, undefined);
}

/**
 * Jalur gabungan: daftar chapter merge → source per nomor chapter →
 * fetch sisi pemenang → prev/next ditulis ulang dari daftar gabungan
 * (navigasi lintas source) → gagal → coba sisi lain bila tersedia.
 */
async function getChapterMerged(
  slug: string,
  token: string,
  num: number,
  prefer?: ComicSourceId,
): Promise<ChapterData> {
  const merged = (await getMangaDetail(slug)) as MergedMangaDetail;
  const shinigamiId = merged.sourceSlug?.shinigami;
  const item = Number.isFinite(num)
    ? merged.chapters.find((ch) => Math.abs(chapterNum(ch.title) - num) < 1e-6)
    : undefined;
  const entrySources = item?.sources ?? [];
  const hasShini = shinigamiId && entrySources.some((r) => r.source === "shinigami");
  const komikuUrl =
    entrySources.find((r) => r.source === "komiku")?.url ?? `/${slug}-chapter-${token}/`;

  // Urutan coba: prefer → pemenang merge → sisi lain.
  const order: ComicSourceId[] = [];
  if (prefer) order.push(prefer);
  const winner: ComicSourceId = hasShini ? "shinigami" : "komiku";
  if (!order.includes(winner)) order.push(winner);
  const other: ComicSourceId = winner === "shinigami" ? "komiku" : "shinigami";
  if (!order.includes(other) && (other === "komiku" || shinigamiId)) order.push(other);

  let lastErr: unknown = null;
  for (const src of order) {
    try {
      const data: ChapterData =
        src === "shinigami"
          ? shinigamiId
            ? await fetchShiniChapter(shinigamiId, num, merged.slug, merged.title)
            : await Promise.reject(new KomikuError("Tidak tersedia di Shinigami.", slug))
          : await fetchChapter(komikuUrl);
      return withMergedNav(data, merged, num);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Gagal memuat chapter.");
}

/**
 * Tulis ulang prev/next dari daftar chapter gabungan (terbaru dulu):
 * idx-1 = lebih baru (next), idx+1 = lebih lama (prev). URL sudah
 * displaySlug-based sehingga navigasi lintas source tetap valid.
 */
function withMergedNav(data: ChapterData, merged: MergedMangaDetail, num: number): ChapterData {
  if (!Number.isFinite(num)) return data;
  const idx = merged.chapters.findIndex((ch) => Math.abs(chapterNum(ch.title) - num) < 1e-6);
  if (idx < 0) return data;
  const next = idx > 0 ? merged.chapters[idx - 1] : undefined;
  const prev = idx + 1 < merged.chapters.length ? merged.chapters[idx + 1] : undefined;
  return {
    ...data,
    ...(prev ? { prevUrl: prev.url } : {}),
    ...(next ? { nextUrl: next.url } : {}),
  };
}

// Re-export agar route lama yang mengimpor resolve tetap jalan bila perlu.
export { resolveShiniDetailForSlug };
