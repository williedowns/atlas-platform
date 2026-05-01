"use client";

import { useEffect, useRef, useState } from "react";
import { getQueueCount, SW_MSG_DRAINED, SW_MSG_QUEUED } from "@/lib/offline-queue";

export function OfflineIndicator() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const lastPending = useRef(0);

  useEffect(() => {
    setOnline(navigator.onLine);

    const refreshCount = async () => {
      const n = await getQueueCount();
      if (n !== lastPending.current) {
        lastPending.current = n;
        setPending(n);
      }
    };

    const goOffline = () => {
      setOnline(false);
      refreshCount();
    };
    const goOnline = () => {
      setOnline(true);
      refreshCount();
    };

    const onSwMessage = (event: MessageEvent) => {
      if (event.data?.type === SW_MSG_QUEUED || event.data?.type === SW_MSG_DRAINED) {
        refreshCount();
      }
    };

    refreshCount();
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.addEventListener("message", onSwMessage);
    }

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.removeEventListener("message", onSwMessage);
      }
    };
  }, []);

  if (online && pending === 0) return null;

  const itemWord = pending === 1 ? "item" : "items";
  const message = !online
    ? pending > 0
      ? `Offline · ${pending} ${itemWord} will sync when you reconnect`
      : "Offline · changes will sync when you reconnect"
    : `Syncing ${pending} pending ${itemWord}…`;

  return (
    <div
      className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 rounded-full shadow-lg text-sm font-semibold ${
        online ? "bg-amber-500 text-white" : "bg-slate-900 text-white"
      }`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}
