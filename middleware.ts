import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { COOKIE, isAuthed } from "@/lib/gate";

/**
 * Gerbang akses + keamanan dasar:
 * 1. Password gate — semua rute (halaman + /api/*) butuh cookie sesi,
 *    kecuali /masuk, file statis, dan _next internal.
 * 2. Header anti-index global (backup dari metadata robots).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Jangan gate aset statis / internal Next.
  // robots.txt tetap diserve (isinya Disallow: / untuk semua crawler).
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    /\.(png|jpg|jpeg|webp|gif|svg|ico|css|js|woff2?)$/.test(pathname)
  ) {
    const res = NextResponse.next();
    res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    return res;
  }

  const res = NextResponse.next();
  // Anti-index lapis transport — berlaku walau crawler mengabaikan robots.txt.
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");

  // Halaman login + API login selalu lolos (kalau sudah login → lempar ke beranda).
  // PENTING: /api/gate harus dikecualikan — kalau tidak, user yang belum
  // login tidak akan pernah bisa login karena request login-nya ikut diblokir.
  if (pathname === "/masuk" || pathname === "/api/gate") {
    if (pathname === "/masuk" && isAuthed(req)) {
      const url = req.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }
    return res;
  }

  if (!isAuthed(req)) {
    // API → 401 JSON (bukan redirect HTML agar client fetch tetap waras).
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { message: "Akses terkunci.", source: "gate" } },
        { status: 401, headers: { "X-Robots-Tag": "noindex, nofollow" } },
      );
    }
    // Halaman → alihkan ke /masuk dengan kembali ke tujuan semula.
    const url = req.nextUrl.clone();
    url.pathname = "/masuk";
    url.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(url);
    redirect.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive, nosnippet");
    redirect.cookies.delete(COOKIE);
    return redirect;
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
