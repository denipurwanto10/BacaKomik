import { fetchRanking, type RankPeriod } from "@/lib/api/komiku";
import { handle } from "../_lib";

const PERIODS: RankPeriod[] = ["harian", "mingguan", "bulanan", "total"];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("period") || "harian").toLowerCase();
  const period: RankPeriod = PERIODS.includes(raw as RankPeriod)
    ? (raw as RankPeriod)
    : "harian";
  return handle(async () => ({ period, items: await fetchRanking(period) }), {
    revalidate: 300,
  });
}
