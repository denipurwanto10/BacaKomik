import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { ThemeProvider } from "@/components/theme";
import { BackToTop, Footer, Header, Main, MobileTabBar } from "@/components/layout";
import "./globals.css";

// Semua halaman memuat data live dari Komiku.org saat request —
// tidak ada prerender statis.
export const dynamic = "force-dynamic";

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
  title: "BacaKomik — Baca Manga, Manhwa & Manhua Bahasa Indonesia",
  description:
    "Platform baca komik online: manga, manhwa, dan manhua terbaru dalam Bahasa Indonesia.",
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
