"use client";

import Link from "next/link";
import { useState } from "react";
import { useBookmarks } from "@/lib/bookmarks";
import { TypeBadge } from "@/components/cards";
import { SectionHead, EmptyState } from "@/components/states";

function IconTrash({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-9 0 1 13h10l1-13"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function FavoritPage() {
  const { bookmarks, remove } = useBookmarks();
  const [filter, setFilter] = useState("");

  const filtered = bookmarks.filter((b) =>
    b.title.toLowerCase().includes(filter.trim().toLowerCase()),
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 sm:gap-4">
      <div className="min-w-0">
        <SectionHead title="Favorit" />
        {bookmarks.length > 0 && (
          <p className="-mt-2 text-xs text-muted dark:text-muted-dark">
            {bookmarks.length} judul · tersimpan di perangkat ini
          </p>
        )}
      </div>

      {bookmarks.length > 5 && (
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Cari favorit…"
          enterKeyHint="search"
          className="h-12 w-full min-w-0 rounded-full border border-line bg-paper-2 px-4 text-base text-fg outline-none placeholder:text-muted focus-visible:border-accent sm:h-10 sm:max-w-xs sm:text-sm dark:border-line-dark dark:bg-ink-2 dark:text-fg-dark dark:placeholder:text-muted-dark"
        />
      )}

      {bookmarks.length === 0 && (
        <EmptyState message="Belum ada favorit. Ketuk ikon bookmark di halaman komik untuk menyimpan judul kesukaanmu di sini." />
      )}

      {bookmarks.length > 0 && filtered.length === 0 && (
        <EmptyState message={`Tidak ada favorit yang cocok dengan "${filter}".`} />
      )}

      {filtered.length > 0 && (
        <div className="grid min-w-0 grid-cols-2 gap-2 min-[420px]:grid-cols-3 min-[420px]:gap-2.5 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-6">
          {filtered.map((b) => (
            <article
              key={b.slug}
              className="group relative flex min-w-0 flex-col overflow-hidden rounded-xl border border-line bg-paper-2 transition-shadow hover:shadow-lg hover:shadow-black/5 dark:border-line-dark dark:bg-ink-2 dark:hover:shadow-black/30"
            >
              <Link
                href={`/komik/${b.slug}`}
                aria-label={b.title}
                className="relative block aspect-[3/4] w-full shrink-0 overflow-hidden bg-paper-3 dark:bg-ink-3"
              >
                {b.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={b.cover}
                    alt={b.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted dark:text-muted-dark">
                    Tanpa cover
                  </div>
                )}
                {b.type && (
                  <div className="absolute left-1.5 top-1.5">
                    <TypeBadge type={b.type} />
                  </div>
                )}
              </Link>
              <button
                onClick={() => remove(b.slug)}
                aria-label={`Hapus ${b.title} dari favorit`}
                className="absolute right-1.5 top-1.5 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm hover:bg-mark-manga"
              >
                <IconTrash className="h-4 w-4" />
              </button>
              <div className="flex min-w-0 flex-1 flex-col p-2 sm:p-2.5">
                <Link
                  href={`/komik/${b.slug}`}
                  className="truncate text-xs font-semibold leading-snug text-fg hover:text-accent sm:text-[13px] dark:text-fg-dark"
                >
                  {b.title}
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
