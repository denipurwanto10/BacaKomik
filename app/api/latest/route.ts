import type { NextRequest } from "next/server";
import { fetchMangaList } from "@/lib/api/komiku";
import { guard, handle } from "../_lib";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const orderby = searchParams.get("orderby") as
    | "modified"
    | "date"
    | "popular"
    | "rand"
    | null;
  const tipe = searchParams.get("tipe") as "manga" | "manhwa" | "manhua" | null;
  const genre = searchParams.get("genre");
  const genre2 = searchParams.get("genre2");
  const status = searchParams.get("status") as "ongoing" | "end" | null;
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(
    () =>
      fetchMangaList({
        page,
        ...(orderby ? { orderby } : {}),
        ...(tipe ? { tipe } : {}),
        ...(genre ? { genre } : {}),
        ...(genre2 ? { genre2 } : {}),
        ...(status ? { status } : {}),
      }),
    { revalidate: 30 },
  );
}
