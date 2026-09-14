import type { NextRequest } from "next/server";
import { getMangaByGenre } from "@/lib/api/genre";
import { guard, handle } from "../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(
    async () => ({
      genre: decodeURIComponent(slug),
      page,
      ...(await getMangaByGenre(decodeURIComponent(slug), page)),
    }),
    { revalidate: 300 },
  );
}
