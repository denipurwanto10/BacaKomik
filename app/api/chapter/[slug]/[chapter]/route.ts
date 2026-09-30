import type { NextRequest } from "next/server";
import { getChapter } from "@/lib/api/chapter";
import type { ComicSourceId } from "@/lib/api/aggregator";
import { guard, handle } from "../../../_lib";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter } = await ctx.params;
  const blocked = await guard(req);
  if (blocked) return blocked;
  // Source gambar opsional: ?source=komiku (fallback bila Shinigami gagal).
  // Default = otomatis per daftar chapter gabungan (Shinigami utama).
  const raw = new URL(req.url).searchParams.get("source");
  const source: ComicSourceId | undefined =
    raw === "komiku" ? "komiku" : raw === "shinigami" ? "shinigami" : undefined;
  // Chapter tidak berubah setelah terbit — respons boleh di-cache singkat.
  return handle(
    () => getChapter(decodeURIComponent(slug), decodeURIComponent(chapter), source),
    {
      revalidate: 30,
    },
  );
}
