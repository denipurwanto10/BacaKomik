import type { NextRequest } from "next/server";
import { getPopular } from "@/lib/api/manga";
import type { RankPeriod } from "@/lib/api/komiku";
import { guard, handle } from "../_lib";

const PERIODS: RankPeriod[] = ["harian", "mingguan", "bulanan", "total"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("period") || "harian").toLowerCase();
  const period: RankPeriod = PERIODS.includes(raw as RankPeriod)
    ? (raw as RankPeriod)
    : "harian";
  const blocked = await guard(req);
  if (blocked) return blocked;
  // Peringkat harian = agregator (Komiku rank + unik Komikindo).
  // Periode lain (mingguan/bulanan/total) hanya ada di Komiku.
  return handle(
    async () => {
      if (period !== "harian") {
        const { fetchRanking } = await import("@/lib/api/komiku");
        return { period, items: await fetchRanking(period) };
      }
      return { period, items: await getPopular() };
    },
    {
      revalidate: 30,
    },
  );
}
