import { NextResponse, type NextRequest } from "next/server";
import { guard } from "../../_lib";

export const dynamic = "force-dynamic";

/**
 * Probe SEMENTARA (Tahap 1): uji akses server-side Vercel → API JSON
 * Komikindo `GET /wp-json/apk/v2/latest/1`.
 *
 * Terisolasi: tidak menyentuh /api/latest, fetchKiLatest/Detail/Chapter,
 * Komiku, agregator, maupun frontend. Hanya validasi upstream
 * (status, content-type, ukuran, validitas JSON, header CF).
 * HAPUS route ini setelah tahap pembuktian selesai.
 */
const ENDPOINT = "https://komikindo.ch/wp-json/apk/v2/latest/1";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;

  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(ENDPOINT, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      cache: "no-store",
    });
    const latencyMs = Date.now() - started;
    const text = await res.text();
    const contentType = res.headers.get("content-type") ?? "";
    const server = res.headers.get("server") ?? "";
    const cfRay = res.headers.get("cf-ray") ?? "";
    const cfCache = res.headers.get("cf-cache-status") ?? "";

    let jsonValid = false;
    let isArray = false;
    let itemCount = 0;
    let firstItemKeys: string[] = [];
    try {
      const parsed: unknown = JSON.parse(text);
      jsonValid = true;
      isArray = Array.isArray(parsed);
      if (isArray) {
        itemCount = (parsed as unknown[]).length;
        const first = (parsed as Record<string, unknown>[])[0];
        if (first && typeof first === "object") firstItemKeys = Object.keys(first);
      }
    } catch {
      // jsonValid tetap false
    }

    const summary = {
      endpoint: "/wp-json/apk/v2/latest/1",
      runtime: "netlify-test",
      status: res.status,
      contentType,
      size: text.length,
      latencyMs,
      jsonValid,
      isArray,
      itemCount,
      firstItemKeys,
      server,
      cfRay,
      cfCache,
    };
    console.log(
      `[KI-APK-PROBE] endpoint=${summary.endpoint} status=${summary.status} ` +
        `content-type=${contentType || "-"} size=${summary.size} latency=${latencyMs}ms ` +
        `json=${jsonValid} items=${itemCount} server=${server || "-"} cf-ray=${cfRay || "-"}`,
    );
    return NextResponse.json({ data: summary });
  } catch (e) {
    const latencyMs = Date.now() - started;
    const reason = e instanceof DOMException && e.name === "AbortError" ? "timeout" : "fetch-error";
    console.log(
      `[KI-APK-PROBE] endpoint=/wp-json/apk/v2/latest/1 status=ERR reason=${reason} latency=${latencyMs}ms`,
    );
    return NextResponse.json({ data: { endpoint: "/wp-json/apk/v2/latest/1", status: 0, reason, latencyMs } });
  } finally {
    clearTimeout(timer);
  }
}
