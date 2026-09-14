import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  experimental: {
    // Lingkungan tanpa child_process: jalankan kompilasi dalam proses utama,
    // dan static worker via worker_threads (keduanya opsi resmi Next.js).
    webpackBuildWorker: false,
    workerThreads: true,
  },
  // Gambar chapter/cover dimuat langsung dari CDN Komiku (domain dinamis:
  // image2..image8.komiku.to, thumbnail.komiku.to, dll), jadi dipakai <img>
  // biasa dengan lazy loading, bukan next/image.
};

export default nextConfig;
