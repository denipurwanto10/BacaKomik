import { NextRequest, NextResponse } from "next/server";
import { KomikuError } from "@/lib/api/komiku";
import { KomikindoError } from "@/lib/api/komikindo";
import { isAuthed, rateLimited } from "@/lib/gate";

/**
 * Bungkus handler agar KomikuError menjadi JSON error yang konsisten.
 * Proteksi lapis API (selain middleware gate):
 * - Rate limit 60 req/menit/IP — cegah 1 orang menyedot API.
 * - Origin/Referer check — tolak embed lintas-situs (header mudah
 *   dipalsukan, jadi ini pertahanan kedua; gate password yang utama).
 */
export async function guard(req: NextRequest): Promise<NextResponse | null> {
  if (rateLimited(req)) {
    return NextResponse.json(
      { error: { message: "Terlalu banyak permintaan. Tunggu sebentar.", source: "rate-limit" } },
      { status: 429 },
    );
  }
  if (!isAuthed(req)) {
    return NextResponse.json(
      { error: { message: "Akses terkunci.", source: "gate" } },
      { status: 401 },
    );
  }
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "";
  const sameSite = (u: string | null) => {
    if (!u) return false;
    try {
      return new URL(u).host === host;
    } catch {
      return false;
    }
  };
  if ((origin || referer) && !sameSite(origin) && !sameSite(referer)) {
    return NextResponse.json(
      { error: { message: "Akses ditolak.", source: "gate" } },
      { status: 403 },
    );
  }
  return null;
}

export async function handle<T>(
  fn: () => Promise<T>,
  opts?: { revalidate?: number },
) {
  try {
    const data = await fn();
    return NextResponse.json(
      { data },
      opts?.revalidate
        ? {
            headers: {
              // Browser + CDN boleh menyimpan respons — isinya memang di-cache
              // singkat di sisi server (revalidate 30s di fetchHtml).
              "Cache-Control": `public, s-maxage=${opts.revalidate}, stale-while-revalidate=${opts.revalidate * 2}`,
            },
          }
        : undefined,
    );
  } catch (e) {
    if (e instanceof KomikuError || e instanceof KomikindoError) {
      // URL sumber lengkap hanya masuk log server — ke browser kirim
      // message saja agar domain asal tidak bocor via DevTools.
      console.error(`[api-error] ${e.source}: ${e.message}`);
      return NextResponse.json(
        { error: { message: e.message, source: "upstream" } },
        { status: e.status ?? 502 },
      );
    }
    return NextResponse.json(
      { error: { message: "Terjadi kesalahan tak terduga.", source: "internal" } },
      { status: 500 },
    );
  }
}
