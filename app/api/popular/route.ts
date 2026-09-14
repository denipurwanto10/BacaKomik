import type { NextRequest } from "next/server";
import { fetchRanking, type RankPeriod } from "@/lib/api/komiku";
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
  return handle(async () => ({ period, items: await fetchRanking(period) }), {
    revalidate: 30,
  });
}
