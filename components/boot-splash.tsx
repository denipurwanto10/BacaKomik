"use client";

import { useEffect, useState } from "react";

/**
 * Boot splash — HANYA tampil saat dibuka sebagai PWA terinstal (standalone).
 * Di browser biasa tidak tampil sama sekali.
 * Deteksi: display-mode standalone / fullscreen, iOS navigator.standalone,
 * atau android-app referrer. Komponen tidak pernah unmount saat navigasi
 * client-side, jadi splash TIDAK muncul lagi tiap pindah halaman.
 */
export function BootSplash() {
  const [show, setShow] = useState(false);
  const [fade, setFade] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true ||
      document.referrer.startsWith("android-app://");
    if (!standalone) {
      setGone(true);
      return;
    }
    setShow(true);
    const t1 = window.setTimeout(() => setFade(true), 550);
    const t2 = window.setTimeout(() => setGone(true), 1050);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, []);

  if (gone || !show) return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-ink motion-safe:transition-opacity motion-safe:duration-500 ${
        fade ? "opacity-0" : "opacity-100"
      }`}
    >
      <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-accent text-white">
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
