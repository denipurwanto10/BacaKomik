import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme";
import { BootSplash } from "@/components/boot-splash";
import { RouteMemory } from "@/components/route-memory";
import { BackToTop, Footer, Header, Main, MobileTabBar } from "@/components/layout";
import "./globals.css";

// Halaman bersifat statis (shell dari CDN) — data komik tetap live karena
// semua halaman fetch client-side via apiGet/apiGetSWR setelah mount.
// API route (/api/*) tetap dinamis via force-dynamic masing-masing.

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KomikFrost — Baca Manga, Manhwa & Manhua Bahasa Indonesia",
  description:
    "Platform baca komik online: manga, manhwa, dan manhua terbaru dalam Bahasa Indonesia.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "KomikFrost",
    // iOS 26+: status bar selalu transparan di atas konten — nilai yang
    // berlaku adalah black-translucent (teks putih); "black" diabaikan.
    // Default gelap (tema default aplikasi); ThemeProvider memperbarui
    // meta ini setiap tema diganti agar bar iOS ikut terang/gelap.
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  // Situs pribadi — jangan dirayapi / ditampilkan mesin pencari.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

// viewport-fit=cover diperlukan agar env(safe-area-inset-bottom) terbaca
// di iPhone bertakik/notch — dipakai oleh .pb-safe pada tab bar mobile.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  // Satu nilai default gelap (tema default aplikasi). Nilai media-query
  // dihapus — yang berlaku adalah meta theme-color yang ditulis ulang
  // ThemeProvider setiap tema diganti, agar bar browser/PWA selalu sama
  // dengan tema aplikasi, bukan tema OS.
  themeColor: "#101217",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning className={`${display.variable} ${sans.variable}`}>
      <head>
        {/* CDN gambar disambungkan lebih awal agar handshake TLS/DNS
            tidak menunggu gambar pertama. */}
        <link rel="preconnect" href="https://img.komiku.org" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://thumbnail.komiku.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.komiku.org" />
      </head>
      <body className="min-h-screen overflow-x-hidden bg-paper font-sans text-fg antialiased dark:bg-ink dark:text-fg-dark">
        {/* Splash statis server-render: langsung ada di first paint (sebelum
            JS hydrate) — semulus splash aplikasi native. Hanya tampil di PWA
            via CSS display-mode; JS (BootSplash) hanya fade-out. */}
        <div id="boot-splash" aria-hidden="true" className="boot-splash fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-ink">
          <span className="boot-splash-pop flex h-20 w-20 items-center justify-center rounded-2xl bg-accent text-white">
            <svg viewBox="0 0 256 256" className="h-14 w-14" fill="currentColor" aria-hidden="true">
              <path
                fillRule="evenodd"
                d="M64 64H192V192H64Z M124 64H156L128 128L156 192H124L96 128Z"
              />
            </svg>
          </span>
          <p className="font-display text-2xl font-extrabold tracking-tight text-white">
            Komik<span className="text-accent">Frost</span>
          </p>
        </div>
        <ThemeProvider>
          <BootSplash />
          <RouteMemory />
          <Header />
          <Main>{children}</Main>
          <Footer />
          <MobileTabBar />
          <BackToTop />
        </ThemeProvider>
      </body>
    </html>
  );
}
