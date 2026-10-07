import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme";
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
    statusBarStyle: "default",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#eef0f3" },
    { media: "(prefers-color-scheme: dark)", color: "#101217" },
  ],
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
        <ThemeProvider>
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
