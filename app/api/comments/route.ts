import type { NextRequest } from "next/server";
import { fetchCommentIds, fetchComments, type CommentSort } from "@/lib/api/komiku";
import { guard, handle } from "../_lib";

/**
 * GET /api/comments?kind=manga&ref=<slug>           komentar level komik
 * GET /api/comments?kind=chapter&ref=</slug-ch-N/>   komentar satu chapter
 * GET /api/comments?series=<id>&chapter=<id>&sort=&page=
 *   (dipakai pagination/sort tanpa scrape ulang ID)
 * Read-only — tanpa form kirim, tanpa login.
 */
export const dynamic = "force-dynamic";

const SORTS = ["popular", "latest", "earliest", "subscribed"] as const;

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const sp = new URL(req.url).searchParams;
  const sortRaw = sp.get("sort");
  const sort: CommentSort = (
    SORTS as readonly string[]
  ).includes(sortRaw ?? "")
    ? (sortRaw as CommentSort)
    : "latest";
  const page = Math.min(50, Math.max(1, parseInt(sp.get("page") || "1", 10) || 1));
  return handle(async () => {
    const series = sp.get("series");
    const chapter = sp.get("chapter") ?? "";
    if (series) {
      return fetchComments(series, chapter, sort, page);
    }
    const kind = sp.get("kind") === "chapter" ? "chapter" : "manga";
    const ref = (sp.get("ref") || "").trim();
    if (!ref) throw new Error("Parameter ref wajib diisi.");
    const ids = await fetchCommentIds(kind, ref);
    return fetchComments(ids.seriesId, ids.chapterId, sort, page);
  });
}
