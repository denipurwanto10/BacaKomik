"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiGet, prefetchApi } from "@/lib/client";
import type { MangaCard } from "@/lib/api/types";
import { SourceBadge } from "./cards";

interface SuggestPayload {
  keyword: string;
  items: MangaCard[];
}

const MIN_LEN = 2;
const MAX_ITEMS = 8;

/**
 * Input pencarian + dropdown saran langsung (cover + judul + badge sumber).
 * Ketik ≥2 huruf → debounce 300ms → /api/search → max 8 saran.
 * Klik saran = langsung ke detail; Enter = submit parent (/cari);
 * panah atas/bawah + Enter = pilih saran via keyboard; Esc = tutup.
 */
export function SearchSuggest({
  value,
  onChange,
  onSubmit,
  inputClassName = "",
  id,
  autoFocus,
  placeholder = "Cari judul komik…",
  enabled = true,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  inputClassName?: string;
  id?: string;
  autoFocus?: boolean;
  placeholder?: string;
  /** false = input polos tanpa dropdown (dipakai halaman /cari — hasilnya sudah tampil di bawah). */
  enabled?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<MangaCard[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [hi, setHi] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);
  const reqId = useRef(0);

  const kw = value.trim();

  useEffect(() => {
    if (!enabled || kw.length < MIN_LEN) {
      setItems(null);
      setLoading(false);
      setOpen(false);
      setHi(-1);
      return;
    }
    setLoading(true);
    const my = ++reqId.current;
    const t = window.setTimeout(() => {
      apiGet<SuggestPayload>(`/api/search?q=${encodeURIComponent(kw)}`)
        .then((res) => {
          if (reqId.current !== my) return;
          setItems(res.items.slice(0, MAX_ITEMS));
          setHi(-1);
          setOpen(true);
        })
        .catch(() => {
          if (reqId.current === my) setItems([]);
        })
        .finally(() => {
          if (reqId.current === my) setLoading(false);
        });
    }, 300);
    return () => window.clearTimeout(t);
  }, [kw, enabled]);

  // Tutup saat klik/tap di luar.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, []);

  const goDetail = (slug: string) => {
    setOpen(false);
    router.push(`/komik/${slug}`);
  };

  const showDropdown = enabled && open && kw.length >= MIN_LEN;

  return (
    <div ref={boxRef} className="relative min-w-0 flex-1">
      <input
        id={id}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onFocus={() => {
          if (items && items.length > 0) setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && items && items.length > 0) {
            e.preventDefault();
            setOpen(true);
            setHi((h) => (h + 1) % items.length);
          } else if (e.key === "ArrowUp" && items && items.length > 0) {
            e.preventDefault();
            setOpen(true);
            setHi((h) => (h - 1 + items.length) % items.length);
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && hi >= 0 && items?.[hi]) goDetail(items[hi].slug);
            else {
              setOpen(false);
              onSubmit();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        placeholder={placeholder}
        aria-label="Cari judul komik"
        aria-expanded={showDropdown}
        role="combobox"
        aria-autocomplete="list"
        autoFocus={autoFocus}
        enterKeyHint="search"
        autoComplete="off"
        className={inputClassName}
      />
      {showDropdown && (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-paper-2 dark:border-line-dark dark:bg-ink-2"
        >
          {loading && (!items || items.length === 0) && (
            <p className="px-4 py-3 text-sm text-muted dark:text-muted-dark">Mencari…</p>
          )}
          {!loading && items && items.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted dark:text-muted-dark">
              Tidak ada hasil untuk &quot;{kw}&quot;.
            </p>
          )}
          {items && items.length > 0 && (
            <ul className="max-h-[320px] overflow-y-auto py-1">
              {items.map((it, i) => (
                <li key={`${it.slug}#${it.latestChapter?.url ?? ""}`} role="option" aria-selected={i === hi}>
                  <Link
                    href={`/komik/${it.slug}`}
                    onClick={() => setOpen(false)}
                    onMouseEnter={() => {
                      setHi(i);
                      prefetchApi(`/api/manga/${encodeURIComponent(it.slug)}`);
                    }}
                    className={`flex min-w-0 items-center gap-2.5 px-3 py-2 ${
                      i === hi ? "bg-paper-3 dark:bg-ink-3" : ""
                    }`}
                  >
                    {it.thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={it.thumbnail}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        fetchPriority="low"
                        onLoad={(e) => e.currentTarget.classList.add("blur-done")}
                        className="blur-up h-14 w-10 shrink-0 rounded-md bg-paper-3 object-cover dark:bg-ink-3"
                      />
                    ) : (
                      <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-md bg-paper-3 text-[9px] text-muted dark:bg-ink-3 dark:text-muted-dark">
                        —
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold leading-snug text-fg dark:text-fg-dark">
                        {it.title}
                      </span>
                      <span className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        {it.latestChapter && (
                          <span className="min-w-0 flex-1 truncate text-[11px] text-accent">
                            {it.latestChapter.label}
                          </span>
                        )}
                        <SourceBadge
                          sources={it.latestSource ? [it.latestSource] : it.sources?.slice(0, 1)}
                        />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {items && items.length > 0 && (
            <button
              onClick={() => {
                setOpen(false);
                onSubmit();
              }}
              className="w-full border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-accent hover:underline dark:border-line-dark"
            >
              Lihat semua hasil untuk &quot;{kw}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
