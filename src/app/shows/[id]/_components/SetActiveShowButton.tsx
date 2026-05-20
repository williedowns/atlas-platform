"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export default function SetActiveShowButton({
  showId,
  isCurrentlyActive,
}: {
  showId: string;
  isCurrentlyActive: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimistic, setOptimistic] = useState(isCurrentlyActive);

  const handleClick = async () => {
    const willBeActive = !optimistic;
    setOptimistic(willBeActive);

    const res = await fetch("/api/active-show", {
      method: willBeActive ? "POST" : "DELETE",
      headers: willBeActive ? { "Content-Type": "application/json" } : {},
      body: willBeActive ? JSON.stringify({ show_id: showId }) : undefined,
    });

    if (!res.ok) {
      setOptimistic(!willBeActive);
      const data = await res.json().catch(() => ({}));
      alert(`Failed: ${data.error ?? "Unknown error"}`);
      return;
    }

    startTransition(() => router.refresh());
  };

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`w-full inline-flex items-center justify-center gap-2 font-semibold rounded-md py-3 px-3 transition-colors disabled:opacity-60 ${
        optimistic
          ? "bg-[#00929C] text-white hover:bg-[#007a82]"
          : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
      }`}
    >
      {optimistic ? (
        <>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
          Active Show — Tap to Clear
        </>
      ) : (
        "Set as Active Show"
      )}
    </button>
  );
}
