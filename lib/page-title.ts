"use client";

import { useEffect } from "react";

/** Nama situs untuk suffix tab browser. */
const SITE = "KomikFrost";

/**
 * Judul tab browser untuk halaman client component (generateMetadata tidak
 * berlaku di "use client"). Judul dinamis dari data yang sudah ada —
 * nol request baru. Kembali ke judul bawaan saat halaman dilepas.
 */
export function usePageTitle(title: string | null | undefined): void {
  useEffect(() => {
    if (!title) return;
    const prev = document.title;
    document.title = `${title} | ${SITE}`;
    return () => {
      document.title = prev;
    };
  }, [title]);
}
