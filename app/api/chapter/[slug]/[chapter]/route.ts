import { getChapter } from "@/lib/api/chapter";
import { handle } from "../../../_lib";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter } = await ctx.params;
  // Chapter tidak berubah setelah terbit — simpan 1 jam.
  return handle(() => getChapter(decodeURIComponent(slug), decodeURIComponent(chapter)), {
    revalidate: 3600,
  });
}
