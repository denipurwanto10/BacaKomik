"use client";

import { useCallback, useEffect, useRef } from "react";
import { prefetchApi } from "./client";

/** Jeda sentuh sebelum prefetch — cukup untuk membedakan tap dari scroll. */
const TOUCH_DELAY_MS = 150;

/**
 * Handler prefetch berbasis niat user.
 *
 * Di desktop: hover = niat membuka, prefetch langsung.
 * Di ponsel: `touchstart` juga menyala saat jari mulai menggeser layar, jadi
 * prefetch ditunda sebentar dan dibatalkan oleh `touchmove`/`touchend`/
 * `touchcancel`. Tanpa ini, satu gestur scroll memicu beberapa merge detail
 * 3 sumber yang tidak akan pernah dibuka — memenuhi rate limit dan membuat
 * halaman terasa lambat.
 */
export function useIntentPrefetch(path: string) {
  const timer = useRef<number | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  useEffect(() => cancel, [cancel]);

  return {
    onMouseEnter: () => prefetchApi(path),
    onTouchStart: () => {
      cancel();
      timer.current = window.setTimeout(() => {
        timer.current = null;
        prefetchApi(path);
      }, TOUCH_DELAY_MS);
    },
    onTouchMove: cancel,
    onTouchEnd: cancel,
    onTouchCancel: cancel,
  };
}
