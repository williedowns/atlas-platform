"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// ── Concrete pad estimate reassign button ────────────────────────────────────
// Only renders for the coordinator (Alex). When a row is currently assigned
// to Alex it shows "Send to Chip"; when it's currently assigned to Chip it
// shows "Take back". Rows assigned to anyone else (Ryan via state routing,
// or null) get no button — the coordinator only manages the
// Alex/Chip handoff. Server-side gate on the PATCH endpoint is the security
// boundary; this conditional rendering is just UX hygiene.

interface ReassignButtonProps {
  contractId: string;
  currentAssignedTo: string | null;
  isCurrentUserAlex: boolean;
  alexUserId: string | null;
  chipUserId: string | null;
}

export function ReassignButton({
  contractId,
  currentAssignedTo,
  isCurrentUserAlex,
  alexUserId,
  chipUserId,
}: ReassignButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  if (!isCurrentUserAlex) return null;

  let label: string;
  let target: string | null;
  if (currentAssignedTo === alexUserId && chipUserId) {
    label = "Send to Chip";
    target = chipUserId;
  } else if (currentAssignedTo === chipUserId && alexUserId) {
    label = "Take back";
    target = alexUserId;
  } else {
    return null;
  }

  async function handleClick() {
    setPending(true);
    try {
      const res = await fetch(
        `/api/contracts/${contractId}/concrete-assignment`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ concrete_estimate_assigned_to: target }),
        },
      );
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        alert(json.error ?? "Failed to reassign — please try again.");
        return;
      }
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Network error — please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
    >
      {pending ? "…" : label}
    </button>
  );
}
