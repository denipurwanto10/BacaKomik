"use client";

import { prefetchApi } from "./client";

/**
 * Data API yang dipakai tiap tujuan menu utama. Dipanaskan sebelum menu
 * ditekan agar halaman tujuan langsung terisi dari cache — tanpa skeleton
 * besar yang terasa seperti reload halaman.
 */
const NAV_API: Record<string, string[]> = {
  "/": ["/api/home"],
  "/terbaru": ["/api/latest?page=1&orderby=modified"],
  "/populer": ["/api/popular?period=harian"],
  "/genre": ["/api/genres"],
};

/** Panaskan data satu tujuan menu (dipanggil saat hover/fokus/sentuh). */
export function warmRoute(href: string): void {
  const apis = NAV_API[href];
  if (!apis) return;
  for (const path of apis) prefetchApi(path);
}

let warmed = false;

function canWarm(): boolean {
  if (typeof window === "undefined" || warmed) return false;
  const conn = (
    navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (conn?.saveData) return false;
  if (conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType)) return false;
  return true;
}

/**
 * Panaskan data menu utama di latar belakang saat browser idle — sekali
 * per load. Ini yang membuat tap menu di ponsel (tanpa hover) tetap
 * instan: datanya sudah siap sebelum menu dipilih.
 */
export function warmPrimaryNav(currentPath: string): void {
  if (!canWarm()) return;
  warmed = true;

  const run = () => {
    for (const href of Object.keys(NAV_API)) {
      const isCurrent = href === "/" ? currentPath === "/" : currentPath.startsWith(href);
      if (!isCurrent) warmRoute(href);
    }
  };

  const ric = (
    window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    }
  ).requestIdleCallback;
  if (typeof ric === "function") ric(run, { timeout: 2500 });
  else window.setTimeout(run, 1500);
}
