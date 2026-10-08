import type { NextRequest } from "next/server";
import { guard } from "../_lib";

/**
 * GET /api/img?u=<url-gambar-upstream-encode>
 * Proxy gambar upstream (cover + reader) lewat origin sendiri.
 *
 * Latar: host gambar Shinigami (assets.shngm.id) me-reset koneksi TLS
 * dari jaringan Indonesia (ECONNRESET/000) — browser me-render slot
 * abu-abu kosong walau URL cover dari API valid. Lewat proxy ini,
 * browser memuat dari origin KomikFrost (relatif, tanpa CORS/hotlink),
 * dan fetch server-side (Vercel, jaringan luar) mencapai host-nya.
 *
 * Keamanan: hanya host upstream yang dikenal; path dibatasi ke gambar;
 * tanpa cookie/auth ke upstream; timeout 15 dtk; Content-Type dari
 * respons upstream yang tervalidasi; Cache-Control publik 1 hari.
 */
export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const ALLOWED_HOSTS = new Set([
  "assets.shngm.id",
  "image2.komiku.to",
  "image3.komiku.to",
  "image4.komiku.to",
  "image5.komiku.to",
  "image6.komiku.to",
  "image7.komiku.to",
  "image8.komiku.to",
  "img.komiku.org",
  "thumbnail.komiku.to",
  "thumbnail.komiku.org",
  "cdn.komikcast.top",
]);

const IMG_EXT = /\.(jpe?g|png|webp|gif|avif)(\?|$)/i;

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;

  const raw = (req.nextUrl.searchParams.get("u") || "").trim();
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return Response.json(
      { error: { message: "Parameter gambar tidak valid.", source: "validation" } },
      { status: 400 },
    );
  }
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname.toLowerCase())) {
    return Response.json(
      { error: { message: "Host gambar tidak diizinkan.", source: "validation" } },
      { status: 400 },
    );
  }
  if (!IMG_EXT.test(url.pathname)) {
    return Response.json(
      { error: { message: "Bukan URL gambar.", source: "validation" } },
      { status: 400 },
    );
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const upstream = await fetch(url.toString(), {
      headers: { "User-Agent": UA, Accept: "image/*,*/*;q=0.8", Referer: `${url.protocol}//${url.host}/` },
      signal: ctrl.signal,
      cache: "no-store",
    });
    if (!upstream.ok || !upstream.body) {
      return Response.json(
        { error: { message: "Gambar upstream tidak tersedia.", source: "upstream" } },
        { status: 502 },
      );
    }
    const ct = (upstream.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (!ct.startsWith("image/")) {
      return Response.json(
        { error: { message: "Respons bukan gambar.", source: "upstream" } },
        { status: 502 },
      );
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": ct,
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=86400",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return Response.json(
      { error: { message: "Gagal mengambil gambar.", source: "upstream" } },
      { status: 502 },
    );
  } finally {
    clearTimeout(timer);
  }
}
