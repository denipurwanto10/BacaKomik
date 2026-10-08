/**
 * lib/api/img-proxy.ts — rewrite URL gambar upstream yang rusak dari
 * jaringan Indonesia menjadi proxy origin sendiri (/api/img?u=...).
 *
 * Latar: assets.shngm.id me-reset koneksi TLS dari ISP Indonesia
 * (curl exit 35 / ECONNRESET, openssl EOF saat handshake) — browser
 * me-render slot abu-abu kosong walau URL dari API valid. Host lain
 * (Komiku/Komikcast) lolos langsung agar hemat bandwidth proxy.
 */

/** Host yang wajib lewat proxy (TLS-nya diblokir dari jaringan ID). */
const PROXY_HOSTS = new Set(["assets.shngm.id"]);

/**
 * Kembalikan URL gambar siap render di browser: host bermasalah
 * → `/api/img?u=<encode>`; sisanya (kosong/relatif/host sehat) utuh.
 */
export function proxiedImage(url: string | undefined | null): string {
  const u = (url ?? "").trim();
  if (!u) return "";
  try {
    const parsed = new URL(u);
    if (parsed.protocol === "https:" && PROXY_HOSTS.has(parsed.hostname.toLowerCase())) {
      return `/api/img?u=${encodeURIComponent(u)}`;
    }
  } catch {
    // Relatif / tidak valid → teruskan apa adanya.
  }
  return u;
}
