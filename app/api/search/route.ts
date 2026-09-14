import { searchManga } from "@/lib/api/search";
import { handle } from "../_lib";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  return handle(async () => ({ keyword: q, items: await searchManga(q) }), {
    revalidate: 120,
  });
}
