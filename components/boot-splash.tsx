"use client";

import { useEffect, useState } from "react";

/**
 * Boot splash — HANYA di PWA terinstal (standalone), tidak di browser.
 * Visibilitas dikunci via CSS (@media display-mode) agar muncul mulus
 * di first paint tanpa kedip JS; JS hanya mengatur fade-out + fallback
 * iOS lama (navigator.standalone) / referrer android-app.
 * Tidak pernah unmount saat navigasi client-side → tidak muncul lagi
 * tiap pindah halaman. Tile logo fixed hijau + glyph putih (tanpa
 * varian dark:) agar identik di kedua tema.
 */
export function BootSplash() {
  const [force, setForce] = useState(false);
  const [fade, setFade] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const mq =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    const legacy =
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true || document.referrer.startsWith("android-app://");
    // Bukan PWA: jangan tampil sama sekali.
    if (!mq && !legacy) {
      setGone(true);
      return;
    }
    // iOS lama tanpa dukungan display-mode: paksa tampil via inline style.
    if (legacy && !mq) setForce(true);
    const t1 = window.setTimeout(() => setFade(true), 650);
    const t2 = window.setTimeout(() => setGone(true), 1350);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (gone) return null;

  return (
    <div
      aria-hidden="true"
      style={force ? { display: "flex" } : undefined}
      className={`boot-splash fixed inset-0 z-[100] flex-col items-center justify-center gap-4 bg-ink motion-safe:transition-opacity motion-safe:duration-700 ${
        fade ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
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
  );
}
