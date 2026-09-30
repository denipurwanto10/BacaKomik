import type { NextRequest } from "next/server";
import { fetchNovelList, searchNovelRemote } from "@/lib/api/novel";
import { guard, handle } from "../_lib";

export const dynamic = "force-dynamic";

/**
 * GET /api/novels?page=N&q=kw
 * Tanpa q = daftar terbaru (/novel/); dengan q = pencarian.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const q = (searchParams.get("q") || "").trim();
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(
    () =>
      q
        ? searchNovelRemote(q, page, page === 1 ? { enrich: true } : undefined)
        : fetchNovelList(page, page === 1 ? { enrich: true } : undefined),
    q ? { revalidate: 300 } : undefined,
  );
}
