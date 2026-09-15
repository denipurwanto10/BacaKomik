import type { NextRequest } from "next/server";
import { fetchReplies } from "@/lib/api/komiku";
import { guard, handle } from "../_lib";

/**
 * GET /api/replies?hash=<hash_id>&page=N — balasan satu komentar.
 * Read-only — tanpa login.
 */
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  const sp = new URL(req.url).searchParams;
  const hash = (sp.get("hash") || "").trim();
  const page = Math.min(50, Math.max(1, parseInt(sp.get("page") || "1", 10) || 1));
  return handle(async () => {
    if (!hash) throw new Error("Parameter hash wajib diisi.");
    return fetchReplies(hash, page);
  });
}
