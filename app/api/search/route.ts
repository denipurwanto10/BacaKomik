import type { NextRequest } from "next/server";
import { searchManga } from "@/lib/api/search";
import { guard, handle } from "../_lib";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(async () => ({ keyword: q, items: await searchManga(q) }), {
    revalidate: 300,
  });
}
