import type { NextRequest } from "next/server";
import { getLatest, getPopular, getRecommended } from "@/lib/api/manga";
import { guard, handle } from "../_lib";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(
    async () => {
      // "latest" ditembak sendiri dulu (persis seperti /terbaru), baru
      // "popular" + "recommended" bareng — supaya request "terbaru" tidak
      // ikut macet/gagal gara-gara 3 request nembak bersamaan, yang
      // sebelumnya bikin dia diam-diam jatuh ke sumber fallback yang basi.
      const latest = await getLatest(1).catch(() => []);
      const [popular, recommended] = await Promise.all([
        getPopular().catch(() => []),
        getRecommended().catch(() => []),
      ]);
      if (latest.length === 0 && popular.length === 0 && recommended.length === 0) {
        throw new Error("upstream-empty");
      }
      return { latest, popular, recommended };
    },
    // Homepage harus mengambil daftar terbaru tanpa cache response API.
    undefined,
  );
}
