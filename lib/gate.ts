import type { NextRequest } from "next/server";

export const COOKIE = "bk-gate";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 hari

function getPassword(): string {
  return process.env.SITE_PASSWORD || "";
}

/** constant-time compare sederhana agar tidak bocor via timing. */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function isAuthed(req: NextRequest): boolean {
  const pw = getPassword();
  if (!pw) return true; // ENV belum dipasang (dev lokal) → terbuka.
  const raw = req.cookies.get(COOKIE)?.value ?? "";
  // Cookie berisi password mentah yang dibandingkan constant-time.
  try {
    const v = decodeURIComponent(raw);
    return v.length === pw.length && safeEqual(v, pw);
  } catch {
    return false;
  }
}

/** Rate limit memori per-IP (cukup untuk hobby deploy 1 instance). */
const hits = new Map<string, { n: number; reset: number }>();
const WINDOW_MS = 60_000;
const LIMIT = 60; // 60 req/menit/IP untuk /api/*

export function rateLimited(req: NextRequest): boolean {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now > rec.reset) {
    hits.set(ip, { n: 1, reset: now + WINDOW_MS });
    return false;
  }
  rec.n += 1;
  return rec.n > LIMIT;
}

/** Cek password untuk dipakai route /api/gate (dibutuhkan di sana). */
export function checkPassword(input: string): boolean {
  const pw = getPassword();
  if (!pw) return true;
  return input.length === pw.length && safeEqual(input, pw);
}

export function getSitePassword(): string {
  return getPassword();
}

export function gateCookie(pw: string): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=${encodeURIComponent(pw)}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${secure}`;
}

export function clearGateCookie(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
