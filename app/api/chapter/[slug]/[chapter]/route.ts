import type { NextRequest } from "next/server";
import { getChapter } from "@/lib/api/chapter";
import { guard, handle } from "../../../_lib";

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ slug: string; chapter: string }> },
) {
  const { slug, chapter } = await ctx.params;
  const blocked = await guard(req);
  if (blocked) return blocked;
  // Chapter tidak berubah setelah terbit — simpan 1 jam.
  return handle(() => getChapter(decodeURIComponent(slug), decodeURIComponent(chapter)), {
    revalidate: 3600,
  });
}
