import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingRoot: __dirname,
  // Gambar chapter/cover dimuat langsung dari CDN Komiku (domain dinamis:
  // image2..image8.komiku.to, thumbnail.komiku.to, dll), jadi dipakai <img>
  // biasa dengan lazy loading, bukan next/image.
};

export default nextConfig;
