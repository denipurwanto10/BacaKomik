import type { NextRequest } from "next/server";
import { getLatest } from "@/lib/api/manga";
import { guard, handle } from "../_lib";

export const dynamic = "force-dynamic";

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
  // Filter lanjutan (tipe/genre ganda/status) hanya ada di Komiku —
  // untuk itu tetap pakai path lama; kasus umum (terbaru + orderby)
  // lewat agregator multi-source.
  if (tipe || genre2 || status) {
    const { fetchMangaList } = await import("@/lib/api/komiku");
    return handle(
      () =>
        fetchMangaList({
          page,
          ...(orderby ? { orderby } : {}),
          ...(tipe ? { tipe } : {}),
          ...(genre ? { genre } : {}),
          ...(genre2 ? { genre2 } : {}),
          ...(status ? { status } : {}),
          fresh: true,
        }),
      undefined,
    );
  }
  // Filter genre tunggal: gabung Komiku + Komikindo, dedupe.
  if (genre) {
    const { getMangaByGenre } = await import("@/lib/api/genre");
    return handle(() => getMangaByGenre(genre, page), { revalidate: 30 });
  }
  return handle(
    async () => {
      let items: Awaited<ReturnType<typeof getLatest>>;
      if (orderby && orderby !== "modified") {
        // Orderby non-modified (date/popular/rand) hanya ada di Komiku.
        const { fetchMangaList } = await import("@/lib/api/komiku");
        const r = await fetchMangaList({ page, orderby, fresh: true });
        items = r.items;
      } else {
        items = await getLatest(page);
      }
      // hasNextPage: agregator tidak tahu total halaman; heuristik lama:
      // halaman penuh (≈24 item) → kemungkinan ada halaman berikut.
      return { items, hasNextPage: items.length >= 24 };
    },
    // Jangan biarkan browser/CDN menyimpan daftar chapter terbaru.
    // Endpoint ini harus langsung mengikuti update dari sumber.
    undefined,
  );
}
