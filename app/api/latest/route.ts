import { fetchMangaList } from "@/lib/api/komiku";
import { handle } from "../_lib";

export async function GET(req: Request) {
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
  const status = searchParams.get("status") as "ongoing" | "end" | null;
  return handle(
    () =>
      fetchMangaList({
        page,
        ...(orderby ? { orderby } : {}),
        ...(tipe ? { tipe } : {}),
        ...(genre ? { genre } : {}),
        ...(status ? { status } : {}),
      }),
    { revalidate: 120 },
  );
}
