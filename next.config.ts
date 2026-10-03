import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // Jangan bocorkan "X-Powered-By: Next.js" ke browser.
  poweredByHeader: false,
  // Header hardening global (halaman + /api/* + aset statis).
  // CSP sengaja minimal (frame-ancestors saja) — script-src ketat butuh
  // nonce per-request dan akan merusak inline script Next.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
  // Gambar chapter/cover dimuat langsung dari CDN Komiku (domain dinamis:
  // image2..image8.komiku.to, thumbnail.komiku.to, dll), jadi dipakai <img>
  // biasa dengan lazy loading, bukan next/image.
};

export default nextConfig;
