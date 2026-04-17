"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

interface AutoRefreshProps {
  /** Polling interval in milliseconds. Defaults to 20s. */
  intervalMs?: number;
  /** Disable the polling loop entirely. */
  disabled?: boolean;
}

/**
 * Drop-in polling component for server-rendered dashboards.
 * Calls router.refresh() on an interval, which re-runs the server
 * component and swaps the DOM in place — no full page reload, no
 * flicker, no client-side data fetching layer.
 *
 * Usage:
 *   <AutoRefresh intervalMs={20000} />
 *
 * Pauses when the tab is hidden (visibilitychange) so we don't burn
 * database reads on an inactive browser tab.
 */
export function AutoRefresh({ intervalMs = 20_000, disabled = false }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    if (disabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        router.refresh();
      }, intervalMs);
    };

    const stop = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh(); // immediate refresh on re-focus
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stop();
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs, disabled, router]);

  return null;
}
