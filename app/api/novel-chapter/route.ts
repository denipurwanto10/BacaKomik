import type { NextRequest } from "next/server";
import { fetchNovelChapter } from "@/lib/api/novel";
import { guard, handle } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * GET /api/novel-chapter?path=/novel/<slug>/<srv>/chapter-N/
 * Isi chapter novel (teks paragraf + prev/next).
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const path = (searchParams.get("path") || "").trim();
  const blocked = await guard(req);
  if (blocked) return blocked;
  if (!path || !path.includes("/novel/")) {
    return handle(
      () => {
        throw new Error("Path chapter novel tidak valid.");
      },
      undefined,
    );
  }
  return handle(() => fetchNovelChapter(path), { revalidate: 300 });
}
