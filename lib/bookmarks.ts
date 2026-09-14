"use client";

import { useCallback, useEffect, useState } from "react";

/** Satu komik favorit — disimpan per perangkat di localStorage. */
export interface BookmarkEntry {
  slug: string;
  title: string;
  cover: string;
  /** tipe komik bila diketahui (badge di daftar favorit) */
  type?: string;
  /** timestamp ms ditambahkan */
  addedAt: number;
}

const KEY = "bk-bookmarks-v1";
const MAX = 200;

function readAll(): BookmarkEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter(
      (e): e is BookmarkEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as BookmarkEntry).slug === "string" &&
        typeof (e as BookmarkEntry).title === "string",
    );
  } catch {
    return [];
  }
}

function writeAll(entries: BookmarkEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    // Storage penuh/diblokir — favorit sekadar tidak tersimpan.
  }
}

function notify(): void {
  window.dispatchEvent(new CustomEvent("bk-bookmarks-changed"));
}

export function isBookmarked(slug: string): boolean {
  return readAll().some((e) => e.slug === slug);
}

/** Toggle favorit — mengembalikan status baru (true = kini tersimpan). */
export function toggleBookmark(entry: Omit<BookmarkEntry, "addedAt">): boolean {
  const prev = readAll();
  const exists = prev.some((e) => e.slug === entry.slug);
  const all = exists
    ? prev.filter((e) => e.slug !== entry.slug)
    : [{ ...entry, addedAt: Date.now() }, ...prev].slice(0, MAX);
  writeAll(all);
  notify();
  return !exists;
}

export function removeBookmark(slug: string): BookmarkEntry[] {
  const all = readAll().filter((e) => e.slug !== slug);
  writeAll(all);
  notify();
  return all;
}

/** Hook reaktif: daftar favorit terbaru dulu, ter-update lintas tab/halaman. */
export function useBookmarks(): {
  bookmarks: BookmarkEntry[];
  marked: (slug: string) => boolean;
  toggle: (entry: Omit<BookmarkEntry, "addedAt">) => boolean;
  remove: (slug: string) => void;
  refresh: () => void;
} {
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);

  const refresh = useCallback(() => setBookmarks(readAll()), []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) refresh();
    };
    window.addEventListener("bk-bookmarks-changed", onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("bk-bookmarks-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const marked = useCallback(
    (slug: string) => bookmarks.some((e) => e.slug === slug),
    [bookmarks],
  );

  const toggle = useCallback((entry: Omit<BookmarkEntry, "addedAt">) => {
    const now = toggleBookmark(entry);
    setBookmarks(readAll());
    return now;
  }, []);

  const remove = useCallback((slug: string) => {
    setBookmarks(removeBookmark(slug));
  }, []);

  return { bookmarks, marked, toggle, remove, refresh };
}
