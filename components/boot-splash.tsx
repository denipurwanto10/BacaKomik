"use client";

import { useEffect } from "react";

/**
 * Pengendali splash statis (div #boot-splash dirender server di layout).
 * HANYA di PWA terinstal (standalone) — di browser node langsung dibuang.
 * Splash hilang saat halaman siap (window load) + tampil minimal 900ms,
 * lalu crossfade 650ms ala splash aplikasi native. Tidak pernah unmount
 * saat navigasi client-side → tidak muncul lagi tiap pindah halaman.
 */
export function BootSplash() {
  useEffect(() => {
    const node = document.getElementById("boot-splash");
    if (!node) return;
    const mq =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.matchMedia("(display-mode: fullscreen)").matches;
    const legacy =
      (window.navigator as Navigator & { standalone?: boolean }).standalone ===
        true || document.referrer.startsWith("android-app://");
    // Bukan PWA: buang node agar tidak menutupi apa pun.
    if (!mq && !legacy) {
      node.remove();
      return;
    }
    const started =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    const MIN_SHOW = 900;
    const FADE_MS = 750;
    let done = false;
    const hide = () => {
      if (done) return;
      done = true;
      node.classList.add("boot-splash-hide");
      window.setTimeout(() => node.remove(), FADE_MS + 100);
    };
    const hideWhenReady = () => {
      const elapsed =
        (typeof performance !== "undefined" ? performance.now() : Date.now()) -
        started;
      const wait = Math.max(0, MIN_SHOW - elapsed);
      window.setTimeout(hide, wait);
    };
    if (document.readyState === "complete") {
      hideWhenReady();
    } else {
      window.addEventListener("load", hideWhenReady, { once: true });
      // Pengaman: jangan menggantung lebih dari 2,5 dtk bila load macet.
      window.setTimeout(hide, 2500);
    }
  }, []);

  return null;
}
