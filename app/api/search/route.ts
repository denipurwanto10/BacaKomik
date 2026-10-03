import type { NextRequest } from "next/server";
import { searchManga } from "@/lib/api/search";
import { guard, handle } from "../_lib";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const page = Math.min(50, Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1));
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(
    async () => ({ keyword: q, page, ...(await searchManga(q, page)) }),
    {
      revalidate: 300,
      scope: "private",
    },
  );
}
