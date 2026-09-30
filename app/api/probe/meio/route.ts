import { fetchNovelList } from "@/lib/api/novel";

/**
 * Probe sementara: buktikan header browser fetchMeio lolos 403 Meionovels
 * dari environment production (Vercel). HAPUS setelah pembuktian.
 */
export async function GET() {
  try {
    const { items, hasNextPage } = await fetchNovelList(1);
    return Response.json({
      ok: true,
      count: items.length,
      hasNextPage,
      sample: items.slice(0, 3).map((c) => ({
        slug: c.slug,
        title: c.title,
        genre: c.genre,
        type: c.type,
        latest: c.latestChapter?.label,
        updatedAt: c.updatedAt,
      })),
    });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
