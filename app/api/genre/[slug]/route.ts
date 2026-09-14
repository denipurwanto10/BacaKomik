import { getMangaByGenre } from "@/lib/api/genre";
import { handle } from "../../_lib";

export async function GET(req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  return handle(
    async () => ({
      genre: decodeURIComponent(slug),
      page,
      ...(await getMangaByGenre(decodeURIComponent(slug), page)),
    }),
    { revalidate: 300 },
  );
}
