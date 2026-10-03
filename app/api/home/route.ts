import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getLatest, getPopular, getRecommended } from "@/lib/api/manga";
import { guard, handle } from "../_lib";

export const dynamic = "force-dynamic";

type HomeData = { latest: unknown[]; popular: unknown[]; recommended: unknown[] };

/**
 * Cache respons per-instance 60 detik.
 * `dynamic = force-dynamic` membuat fetch upstream no-store, tapi
 * /api/home menembak 3 source scrape (2-6 dtk). Cache memori ini
 * menghilangkan KERJA SCRAPE saja — guard (gate+rate limit) tetap
 * jalan di SETIAP request. Tanpa Cache-Control publik.
 */
const CACHE_MS = 60_000;
let cache: { at: number; data: HomeData } | null = null;
let inflight: Promise<HomeData> | null = null;

async function buildHome(): Promise<HomeData> {
  const [latest, popular, recommended] = await Promise.all([
    getLatest(1).catch(() => [] as unknown[]),
    getPopular().catch(() => [] as unknown[]),
    getRecommended().catch(() => [] as unknown[]),
  ]);
  if (latest.length === 0 && popular.length === 0 && recommended.length === 0) {
    throw new Error("upstream-empty");
  }
  cache = { at: Date.now(), data: { latest, popular, recommended } };
  return cache.data;
}

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(
      { data: cache.data },
      { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } },
    );
  }
  if (!inflight) inflight = buildHome().finally(() => { inflight = null; });
  const pending = inflight;
  return handle(() => pending, { revalidate: 60, scope: "private" });
}
