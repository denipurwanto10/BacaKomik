import { getLatest, getPopular, getRecommended } from "@/lib/api/manga";
import { handle } from "../_lib";

export async function GET() {
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
