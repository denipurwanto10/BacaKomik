import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getMangaDetail } from "@/lib/api/manga";
import { guard, handle } from "../../_lib";

export const maxDuration = 30;

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  // Slug persen-encode rusak membuat decodeURIComponent melempar URIError
  // di luar try — kembalikan 400 JSON, bukan HTML 500.
  let decoded: string;
  try {
    decoded = decodeURIComponent(slug);
  } catch {
    return NextResponse.json(
      { error: { message: "Parameter slug tidak valid.", source: "validation" } },
      { status: 400 },
    );
  }
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(() => getMangaDetail(decoded), { revalidate: 30, scope: "private" });
}
