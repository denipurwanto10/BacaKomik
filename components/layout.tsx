"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "./theme";
import { SearchSuggest } from "./search-suggest";

const NAV = [
  { href: "/", label: "Beranda", icon: IconHome },
  { href: "/terbaru", label: "Terbaru", icon: IconClock },
  { href: "/populer", label: "Peringkat", icon: IconFlame },
  { href: "/genre", label: "Genre", icon: IconTag },
  { href: "/riwayat", label: "Riwayat", icon: IconHistory },
  { href: "/favorit", label: "Favorit", icon: IconBookmark },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Logo mark: a notched ink panel, like a torn-off comic panel corner. */
function Mark() {
  return (
    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center bg-accent text-sm font-black text-white [clip-path:polygon(0_0,100%_0,100%_100%,25%_100%,0_75%)]">
      B
    </span>
  );
}

export function Header() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const [q, setQ] = useState("");
  const [mobileSearch, setMobileSearch] = useState(false);

  // Teks pencarian lama jangan kebawa: tiap pindah halaman
  // (masuk /cari, detail, dsb.) input dikosongkan + bar mobile ditutup.
  useEffect(() => {
    setQ("");
    setMobileSearch(false);
  }, [pathname]);

  const submitSearch = () => {
    const kw = q.trim();
    if (!kw) return;
    setMobileSearch(false);
    setQ("");
    router.push(`/cari?q=${encodeURIComponent(kw)}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper-2/90 backdrop-blur-md dark:border-line-dark dark:bg-ink-2/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href="/" className="flex min-w-0 shrink-0 items-center gap-2" aria-label="KomikFrost — Beranda">
          <Mark />
          <span className="truncate font-display text-base font-extrabold tracking-tight text-fg sm:text-lg dark:text-fg-dark">
            Komik<span className="text-accent">Frost</span>
          </span>
        </Link>

        {/* Search + saran langsung — full width on desktop, hidden on mobile (bottom tab covers it) */}
        <form
          className="relative hidden min-w-0 flex-1 items-center md:flex"
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
        >
          <IconSearch className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-muted dark:text-muted-dark" />
          <SearchSuggest
            value={q}
            onChange={setQ}
            onSubmit={submitSearch}
            inputClassName="h-10 w-full min-w-0 rounded-full border border-line bg-paper pl-9 pr-4 text-sm text-fg outline-none placeholder:text-muted focus-visible:border-accent dark:border-line-dark dark:bg-ink dark:text-fg-dark dark:placeholder:text-muted-dark"
          />
        </form>

        {/* Desktop nav */}
        <nav className="hidden shrink-0 items-center gap-1 md:flex">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-accent-soft text-accent-strong dark:bg-accent-soft-dark dark:text-accent"
                    : "text-muted hover:bg-paper hover:text-fg dark:text-muted-dark dark:hover:bg-ink dark:hover:text-fg-dark"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:ml-0">
          <button
            onClick={() => setMobileSearch((v) => !v)}
            aria-label="Cari komik"
            aria-expanded={mobileSearch}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-line text-fg md:hidden dark:border-line-dark dark:text-fg-dark"
          >
            {mobileSearch ? (
              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            ) : (
              <IconSearch className="h-[18px] w-[18px]" />
            )}
          </button>
          <button
            onClick={toggle}
            aria-label="Ganti tema"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line text-fg dark:border-line-dark dark:text-fg-dark"
          >
            {theme === "dark" ? <IconSun className="h-[18px] w-[18px]" /> : <IconMoon className="h-[18px] w-[18px]" />}
          </button>
        </div>
      </div>
      {/* Bar pencarian mobile — expand di bawah header, hasil dropdown
          langsung tanpa pindah halaman. */}
      {mobileSearch && (
        <div className="mx-auto max-w-6xl px-3 pb-3 md:hidden">
          <form
            className="relative flex min-w-0 items-center"
            onSubmit={(e) => {
              e.preventDefault();
              submitSearch();
            }}
          >
            <IconSearch className="pointer-events-none absolute left-3 z-10 h-4 w-4 text-muted dark:text-muted-dark" />
            <SearchSuggest
              value={q}
              onChange={setQ}
              onSubmit={submitSearch}
              autoFocus
              inputClassName="h-11 w-full min-w-0 rounded-full border border-line bg-paper pl-9 pr-4 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent dark:border-line-dark dark:bg-ink dark:text-fg-dark dark:placeholder:text-muted-dark"
            />
          </form>
        </div>
      )}
    </header>
  );
}

/** Wrapper for page content — trims bottom padding while reading, where the tab bar is hidden. */
export function Main({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const reading = pathname.startsWith("/baca/");
  return (
    <main
      className={`mx-auto w-full max-w-6xl min-w-0 px-3 pt-3 sm:px-4 sm:pt-4 sm:py-6 ${
        reading ? "pb-4" : "pb-24 md:pb-6"
      }`}
    >
      {children}
    </main>
  );
}

/** Fixed bottom tab bar — app-like primary nav for mobile, hidden on desktop. */
export function MobileTabBar() {  const pathname = usePathname();
  // Tab bar kecil: Beranda, Terbaru, Peringkat, Riwayat.
  // Cari = tombol di header (expand inline + saran langsung).
  // Genre & Favorit tetap di nav desktop + halaman masing-masing.
  const items = NAV.filter((n) => n.href !== "/genre" && n.href !== "/favorit");

  // Sembunyikan saat membaca chapter — halaman baca butuh layar penuh.
  if (pathname.startsWith("/baca/")) return null;

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper-2/95 backdrop-blur-md md:hidden dark:border-line-dark dark:bg-ink-2/95">
      <div className="mx-auto grid max-w-6xl grid-cols-4 items-stretch px-1">
        {items.map((n) => {
          const active = isActive(pathname, n.href);
          const Icon = n.icon;
          return (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active ? "page" : undefined}
              className="flex min-w-0 flex-col items-center gap-0.5 px-1 py-2 text-[11px] font-medium"
            >
              <Icon
                className={`h-[22px] w-[22px] shrink-0 ${active ? "text-accent" : "text-muted dark:text-muted-dark"}`}
              />
              <span className={`truncate ${active ? "font-semibold text-accent" : "text-muted dark:text-muted-dark"}`}>
                {n.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="mt-10 hidden border-t border-line py-6 md:block dark:border-line-dark">
      <div className="mx-auto max-w-6xl px-4 text-center text-xs leading-relaxed text-muted dark:text-muted-dark">
        <p className="font-display font-bold text-fg dark:text-fg-dark">KomikFrost</p>
        <p className="mt-1">
          Seluruh data (judul, cover, sinopsis, chapter, peringkat) dimuat langsung dari
          sumber eksternal. KomikFrost tidak menyimpan konten komik.
        </p>
      </div>
    </footer>
  );
}

/**
 * Tombol kembali-ke-atas global — tampil di SEMUA halaman (daftar, detail,
 * terbaru, genre…) setelah user scroll ke bawah (>600px).
 * Di halaman baca (/baca/…) tidak tampil karena reader punya tombolnya
 * sendiri agar tidak dobel.
 * Mobile: tombol disembunyikan saat sudah dekat ke bawah halaman
 * (<350px dari dasar) agar tidak menutupi pagination. Desktop tidak
 * berubah (tetap tampil seperti semula).
 */
export function BackToTop() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      if (y <= 600) {
        setVisible(false);
        return;
      }
      // Mobile saja: sembunyikan saat pagination (di dasar konten)
      // sedang terlihat agar tombol melayang tidak menabraknya.
      if (window.innerWidth < 768) {
        const doc = document.documentElement;
        const distToBottom = doc.scrollHeight - y - window.innerHeight;
        setVisible(distToBottom > 350);
      } else {
        setVisible(true);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [pathname]);

  if (pathname.startsWith("/baca/")) return null;
  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      aria-label="Kembali ke atas"
      className="pb-safe fixed bottom-20 right-3 z-40 flex h-11 w-11 touch-manipulation items-center justify-center rounded-full bg-accent text-white shadow-xl transition-transform active:scale-95 md:bottom-6 md:right-6"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M12 19V5m0 0l-6 6m6-6l6 6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

/* ------------------------------- Icons -------------------------------- */
type IconProps = { className?: string };

function IconHome({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 11.5 12 4l8 7.5M6 9.5V19a1 1 0 0 0 1 1h3.5v-5a1.5 1.5 0 0 1 1.5-1.5v0A1.5 1.5 0 0 1 13.5 15v5H17a1 1 0 0 0 1-1V9.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconClock({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconFlame({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 3c1 2.5-2.5 3.8-2.5 7a4 4 0 0 0 8 0c0-1-.4-1.8-1-2.5.6 2-.6 2.8-1.2 1.8C14.6 7.5 13 6.5 12 3ZM7.5 14A4.5 4.5 0 0 0 12 18.5a4.5 4.5 0 0 0 4.5-4.5c0-.7-.1-1.2-.3-1.7a6 6 0 0 1-8.4 0c-.2.5-.3 1-.3 1.7Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconTag({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M11.5 4H6a2 2 0 0 0-2 2v5.5a2 2 0 0 0 .59 1.41l8 8a2 2 0 0 0 2.82 0l5.5-5.5a2 2 0 0 0 0-2.82l-8-8A2 2 0 0 0 11.5 4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="1.3" fill="currentColor" />
    </svg>
  );
}

function IconSearch({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="m20 20-4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconHistory({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 5v5h5M4.5 10a8 8 0 1 1-.6 4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IconBookmark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M7 4h10a1 1 0 0 1 1 1v15l-6-4-6 4V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSun({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 2.5v2M12 19.5v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2.5 12h2M19.5 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
