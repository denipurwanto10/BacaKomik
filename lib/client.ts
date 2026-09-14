/**
 * Client fetcher untuk API internal (/api/*).
 * Mengembalikan `data` atau melempar Error berisi pesan + source Komiku.
 *
 * Dilengkapi cache memori singkat + dedupe request:
 * - Navigasi bolak-balik (komik → chapter → kembali) tidak fetch ulang
 *   selama data masih segar (TTL 60 detik).
 * - Komponen yang me-request URL sama bersamaan hanya memicu 1 fetch.
 */

export interface ApiSuccess<T> {
  data: T;
}

const TTL_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(path, {
    headers: { Accept: "application/json" },
    signal,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.error) {
    const msg =
      json?.error?.message ||
      `Gagal memuat data (HTTP ${res.status}). Coba lagi nanti.`;
    throw new Error(msg);
  }
  return (json as ApiSuccess<T>).data;
}

export async function apiGet<T>(path: string, opts?: { signal?: AbortSignal }): Promise<T> {
  // Data segar dari cache — tanpa round-trip jaringan sama sekali.
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS && !opts?.signal) {
    return hit.data as T;
  }

  const pending = inflight.get(path);
  if (pending && !opts?.signal) return pending as Promise<T>;

  const p = fetchJson<T>(path, opts?.signal)
    .then((data) => {
      cache.set(path, { at: Date.now(), data });
      return data;
    })
    .finally(() => {
      if (inflight.get(path) === p) inflight.delete(path);
    });
  if (!opts?.signal) inflight.set(path, p);
  return p;
}

/** Intip cache tanpa fetch — untuk melengkapi data tanpa request tambahan. */
export function peekApiCache<T>(path: string): T | null {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.data as T;
  return null;
}

/** Panaskan cache sebelum user membuka halaman — dipanggil saat hover/touch. */
export function prefetchApi(path: string): void {
  if (typeof window === "undefined") return;
  if (cache.has(path) || inflight.has(path)) return;
  void apiGet(path).catch(() => {
    // Prefetch boleh gagal diam-diam; halaman tujuan akan fetch ulang.
  });
}

/** Hapus cache satu URL (mis. setelah retry) atau semuanya. */
export function invalidateApi(path?: string): void {
  if (path) cache.delete(path);
  else cache.clear();
}
