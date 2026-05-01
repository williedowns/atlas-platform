"use client";

import { useEffect } from "react";

interface SyncRegistration extends ServiceWorkerRegistration {
  sync: { register(tag: string): Promise<void> };
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    let registration: ServiceWorkerRegistration | null = null;

    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .then((reg) => {
        registration = reg;
      })
      .catch((err) => {
        console.warn("[sw] registration failed", err);
      });

    const replay = () => {
      navigator.serviceWorker.controller?.postMessage("REPLAY_QUEUE");
      // Background Sync isn't supported on iOS Safari — postMessage above is the fallback.
      if (registration && "sync" in registration) {
        (registration as SyncRegistration).sync.register("replay-queue").catch(() => {});
      }
    };

    window.addEventListener("online", replay);
    return () => window.removeEventListener("online", replay);
  }, []);

  return null;
}
