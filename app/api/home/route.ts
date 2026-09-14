import type { NextRequest } from "next/server";
import { getLatest, getPopular, getRecommended } from "@/lib/api/manga";
import { guard, handle } from "../_lib";

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  return handle(
    async () => {
      const [latest, popular, recommended] = await Promise.all([
        getLatest(1).catch(() => []),
        getPopular().catch(() => []),
        getRecommended().catch(() => []),
      ]);
      if (latest.length === 0 && popular.length === 0 && recommended.length === 0) {
        throw new Error("upstream-empty");
      }
      return { latest, popular, recommended };
    },
    // Homepage paling sering dibuka — simpan 2 menit di edge/CDN.
    { revalidate: 120 },
  );
}
