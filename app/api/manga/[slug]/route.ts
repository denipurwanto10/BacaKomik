import type { NextRequest } from "next/server";
import { getMangaDetail } from "@/lib/api/manga";
import { guard, handle } from "../../_lib";

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(() => getMangaDetail(decodeURIComponent(slug)), { revalidate: 30, scope: "private" });
}
