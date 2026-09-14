import { getMangaDetail } from "@/lib/api/manga";
import { handle } from "../../_lib";

export async function GET(_req: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  return handle(() => getMangaDetail(decodeURIComponent(slug)), { revalidate: 300 });
}
