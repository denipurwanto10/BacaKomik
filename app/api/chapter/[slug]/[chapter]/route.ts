import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getChapter } from "@/lib/api/chapter";
import type { ComicSourceId } from "@/lib/api/aggregator";
import { guard, handle } from "../../../_lib";

export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter } = await ctx.params;
  // Slug/chapter persen-encode rusak membuat decodeURIComponent melempar
  // URIError di luar try — kembalikan 400 JSON, bukan HTML 500.
  let decodedSlug: string;
  let decodedChapter: string;
  try {
    decodedSlug = decodeURIComponent(slug);
    decodedChapter = decodeURIComponent(chapter);
  } catch {
    return NextResponse.json(
      { error: { message: "Parameter chapter tidak valid.", source: "validation" } },
      { status: 400 },
    );
  }
  const blocked = await guard(req);
  if (blocked) return blocked;
  // Source gambar opsional: ?source=komiku|komikcast (fallback bila Shinigami gagal).
  // Default = otomatis per daftar chapter gabungan (Shinigami utama).
  const raw = new URL(req.url).searchParams.get("source");
  const source: ComicSourceId | undefined =
    raw === "komiku" ? "komiku" : raw === "shinigami" ? "shinigami" : raw === "komikcast" ? "komikcast" : undefined;
  // Chapter tidak berubah setelah terbit — cache browser 1 jam (private).
  return handle(
    () => getChapter(decodedSlug, decodedChapter, source),
    {
      revalidate: 3600,
      scope: "private",
    },
  );
}
