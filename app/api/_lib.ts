import { NextResponse } from "next/server";
import { KomikuError } from "@/lib/api/komiku";

/** Bungkus handler agar KomikuError menjadi JSON error yang konsisten. */
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
              // singkat di sisi server (revalidate 300s di fetchHtml).
              "Cache-Control": `public, s-maxage=${opts.revalidate}, stale-while-revalidate=${opts.revalidate * 2}`,
            },
          }
        : undefined,
    );
  } catch (e) {
    if (e instanceof KomikuError) {
      return NextResponse.json({ error: e.toJSON() }, { status: e.status ?? 502 });
    }
    return NextResponse.json(
      { error: { message: "Terjadi kesalahan tak terduga.", source: "internal" } },
      { status: 500 },
    );
  }
}
