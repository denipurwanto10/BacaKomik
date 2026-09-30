import { NextResponse, type NextRequest } from "next/server";
import { guard } from "../../_lib";

export const dynamic = "force-dynamic";

/**
 * Probe SEMENTARA: uji akses server-side Vercel → Komikcast `komikcast.top`.
 *
 * Terisolasi: tidak menyentuh /api/search, Komiku, Shinigami, agregator,
 * maupun frontend. Hanya 5 request terkontrol (home, search, detail,
 * chapter, 1 image HEAD) + validasi isi minimal. Log ringkas saja.
 * HAPUS route + branch ini setelah tahap pembuktian selesai.
 */
const BASE = "https://komikcast.top";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36";

const TIMEOUT_MS = 12_000;

type Step = {
  name: string;
  url: string;
  status: number;
  latencyMs: number;
  size: number;
  contentType: string;
  server: string;
  cfCache: string;
  valid: boolean;
  note: string;
};

async function timedGet(
  name: string,
  url: string,
  validate: (status: number, text: string) => { valid: boolean; note: string },
): Promise<Step> {
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
      signal: ctrl.signal,
      cache: "no-store",
      redirect: "follow",
    });
    const text = await res.text();
    const latencyMs = Date.now() - started;
    const { valid, note } = validate(res.status, text);
    return {
      name,
      url,
      status: res.status,
      latencyMs,
      size: text.length,
      contentType: res.headers.get("content-type") ?? "",
      server: res.headers.get("server") ?? "",
      cfCache: res.headers.get("cf-cache-status") ?? "",
      valid,
      note,
    };
  } catch (e) {
    const latencyMs = Date.now() - started;
    const reason = e instanceof DOMException && e.name === "AbortError" ? "timeout" : "fetch-error";
    return {
      name,
      url,
      status: 0,
      latencyMs,
      size: 0,
      contentType: "",
      server: "",
      cfCache: "",
      valid: false,
      note: reason,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET(req: NextRequest) {
  const blocked = await guard(req);
  if (blocked) return blocked;

  const steps: Step[] = [];

  // 1. Homepage
  steps.push(
    await timedGet("home", `${BASE}/`, (s, t) => ({
      valid: s === 200 && t.toLowerCase().includes("komikcast"),
      note: s === 200 ? "homepage komikcast" : `unexpected status ${s}`,
    })),
  );

  // 2. Search
  const search = await timedGet("search", `${BASE}/search?q=solo%20leveling`, (s, t) => ({
    valid: s === 200 && t.includes("/solo-leveling"),
    note: s === 200 ? "hasil solo-leveling ditemukan" : `unexpected status ${s}`,
  }));
  steps.push(search);

  // 3. Detail — slug dari hasil discovery lokal
  const detail = await timedGet("detail", `${BASE}/solo-leveling`, (s, t) => ({
    valid: s === 200 && t.includes("chapter-") && t.includes("bahasa-indonesia"),
    note:
      s === 200
        ? `${(t.match(/chapter-\d+-bahasa-indonesia/g) ?? []).length} chapter-link`
        : `unexpected status ${s}`,
  }));
  steps.push(detail);

  // 4. Chapter — URL live dari HTML detail (bukan hardcode nomor).
  // Parse chapter URL langsung dari body detail yang sudah diunduh
  // (fetch ulang sekali agar kode tetap linear).
  let chapterUrl = "";
  if (detail.valid) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const r = await fetch(`${BASE}/solo-leveling`, {
        headers: { "User-Agent": UA },
        signal: ctrl.signal,
        cache: "no-store",
      });
      const chapterBody = await r.text();
      const m = chapterBody.match(/https:\/\/komikcast\.top\/[a-z0-9-]+-chapter-\d+-bahasa-indonesia/);
      chapterUrl = m?.[0] ?? "";
    } catch {
      chapterUrl = "";
    } finally {
      clearTimeout(timer);
    }
  }

  let imageUrl = "";
  if (chapterUrl) {
    const chapter = await timedGet("chapter", chapterUrl, (s, t) => {
      const imgs = t.match(/https:\/\/komikcast\.top\/kc-img\/[^"'\s]+/g) ?? [];
      if (imgs[0]) imageUrl = imgs[0];
      return {
        valid: s === 200 && imgs.length >= 3,
        note: s === 200 ? `${imgs.length} kc-img` : `unexpected status ${s}`,
      };
    });
    steps.push(chapter);
  } else {
    steps.push({
      name: "chapter",
      url: "(tidak ada URL chapter dari detail)",
      status: 0,
      latencyMs: 0,
      size: 0,
      contentType: "",
      server: "",
      cfCache: "",
      valid: false,
      note: "skip — detail tidak valid",
    });
  }

  // 5. Image — HEAD saja, tanpa download body
  if (imageUrl) {
    const started = Date.now();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(imageUrl, {
        method: "HEAD",
        headers: { "User-Agent": UA },
        signal: ctrl.signal,
        cache: "no-store",
      });
      const ct = res.headers.get("content-type") ?? "";
      steps.push({
        name: "image",
        url: imageUrl,
        status: res.status,
        latencyMs: Date.now() - started,
        size: Number(res.headers.get("content-length") ?? 0),
        contentType: ct,
        server: res.headers.get("server") ?? "",
        cfCache: res.headers.get("cf-cache-status") ?? "",
        valid: res.status === 200 && ct.startsWith("image/"),
        note: ct.startsWith("image/") ? "image valid" : `content-type ${ct || "-"}`,
      });
    } catch (e) {
      steps.push({
        name: "image",
        url: imageUrl,
        status: 0,
        latencyMs: Date.now() - started,
        size: 0,
        contentType: "",
        server: "",
        cfCache: "",
        valid: false,
        note: e instanceof DOMException && e.name === "AbortError" ? "timeout" : "fetch-error",
      });
    } finally {
      clearTimeout(timer);
    }
  }

  const pass = steps.length === 5 && steps.every((s) => s.valid);
  console.log(
    `[KC-PROBE] ${steps.map((s) => `${s.name}=${s.status}${s.valid ? "" : "!"}(${s.latencyMs}ms)`).join(" ")} verdict=${pass ? "PASS" : "FAIL"}`,
  );
  return NextResponse.json({ infra: "vercel", verdict: pass ? "PASS" : "FAIL", steps });
}
