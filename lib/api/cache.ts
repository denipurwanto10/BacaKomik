/**
 * lib/api/cache.ts — cache memori per-instance untuk hasil scrape/merge.
 *
 * `force-dynamic` membuat setiap request route menembak ulang upstream
 * (fetch tanpa cache HTTP), padahal membuka reader berurutan memanggil
 * detail komik yang sama berkali-kali. Cache ini hanya menghilangkan KERJA
 * scrape/merge; gate + rate limit tetap jalan di setiap request.
 *
 * - TTL pendek (default 30-60 dtk) agar data terbaru tetap mengalir.
 * - Inflight dedupe: request bersamaan untuk key sama hanya memicu 1 kerja.
 * - Error TIDAK di-cache — kegagalan sementara boleh dicoba lagi.
 */

interface Entry<T> {
  at: number;
  data: T;
}

/** Cache satu nilai (satu key), mis. daftar genre. */
export function createTtlCache<T>(ttlMs: number) {
  let entry: Entry<T> | null = null;
  let inflight: Promise<T> | null = null;
  return {
    get(): T | null {
      return entry && Date.now() - entry.at < ttlMs ? entry.data : null;
    },
    async load(fn: () => Promise<T>): Promise<T> {
      if (entry && Date.now() - entry.at < ttlMs) return entry.data;
      if (!inflight) {
        inflight = fn()
          .then((data) => {
            entry = { at: Date.now(), data };
            return data;
          })
          .finally(() => {
            inflight = null;
          });
      }
      return inflight;
    },
  };
}

/** Cache ber-key (mis. per slug / per chapter) dengan batas entri. */
export function createKeyedCache<T>(ttlMs: number, maxEntries = 100) {
  const entries = new Map<string, Entry<T>>();
  const inflight = new Map<string, Promise<T>>();
  return {
    async load(key: string, fn: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && Date.now() - hit.at < ttlMs) return hit.data;
      const pending = inflight.get(key);
      if (pending) return pending;
      const next = fn()
        .then((data) => {
          entries.set(key, { at: Date.now(), data });
          // Buang entri terlama bila melewati batas (Map = urutan insert).
          if (entries.size > maxEntries) {
            const oldest = entries.keys().next().value;
            if (oldest !== undefined) entries.delete(oldest);
          }
          return data;
        })
        .finally(() => {
          if (inflight.get(key) === next) inflight.delete(key);
        });
      inflight.set(key, next);
      return next;
    },
    clear(): void {
      entries.clear();
    },
  };
}
