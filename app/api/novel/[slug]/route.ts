import type { NextRequest } from "next/server";
import { fetchNovelDetail } from "@/lib/api/novel";
import { guard, handle } from "../../_lib";

export const dynamic = "force-dynamic";

/** GET /api/novel/<slug> — detail + daftar chapter. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const blocked = await guard(_req);
  if (blocked) return blocked;
  return handle(() => fetchNovelDetail(decodeURIComponent(slug)), {
    revalidate: 120,
  });
}
