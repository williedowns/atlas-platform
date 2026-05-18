"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ReadinessBlockerPanel from "@/components/contracts/ReadinessBlockerPanel";
import ConflictWarningPanel from "@/components/contracts/ConflictWarningPanel";

interface Props {
  contractId: string;
  defaultAddress?: string;
  // Preview-only props — when readiness is already known (server-evaluated on RSC parent),
  // the form shows blockers proactively before the user even submits.
  initialBlockers?: string[];
  canOverride?: boolean;
}

export default function ScheduleDeliveryButton({
  contractId,
  defaultAddress,
  initialBlockers = [],
  canOverride: initialCanOverride = false,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [windowText, setWindowText] = useState("");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Seed blockers from server preview so the staff member sees them BEFORE filling the form,
  // not after a failed submit.
  const [blockers, setBlockers] = useState<string[]>(initialBlockers);
  const [canOverride, setCanOverride] = useState(initialCanOverride);
  const [overrideReason, setOverrideReason] = useState("");
  const [conflicts, setConflicts] = useState<string[]>([]);
  const [conflictReason, setConflictReason] = useState("");

  async function submit(opts: { overrideReadiness?: boolean; overrideConflicts?: boolean } = {}) {
    const { overrideReadiness = false, overrideConflicts = false } = opts;
    setSubmitting(true);
    setError(null);
    if (!overrideReadiness) {
      setBlockers([]);
      setCanOverride(false);
    }
    if (!overrideConflicts) setConflicts([]);
    const r = await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: contractId,
        scheduled_date: date,
        scheduled_window: windowText || null,
        delivery_address: address || null,
        special_instructions: instructions || null,
        override_readiness: overrideReadiness,
        override_reason: overrideReadiness ? overrideReason : null,
        override_conflicts: overrideConflicts,
        conflict_reason: overrideConflicts ? conflictReason : null,
      }),
    });
    setSubmitting(false);
    if (!r.ok) {
      const body = await r.json().catch(() => ({}));
      if (r.status === 409 && body.blockers) {
        setBlockers(body.blockers);
        setCanOverride(!!body.can_override);
        return;
      }
      if (r.status === 409 && body.conflicts) {
        setConflicts(body.conflicts);
        return;
      }
      setError(body.error ?? "Failed to schedule");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  if (!open) {
    return (
      <Button variant="default" size="lg" onClick={() => setOpen(true)}>
        Schedule Delivery
      </Button>
    );
  }

  return (
    <div className="rounded-xl border-2 border-[#00929C]/30 bg-[#00929C]/5 p-4 space-y-3">
      <p className="text-sm font-bold text-[#00929C]">Schedule Delivery</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-slate-600 block mb-1">Window</label>
          <input
            type="text"
            placeholder="2-4 PM"
            value={windowText}
            onChange={(e) => setWindowText(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Delivery Address (override)</label>
        <input
          type="text"
          placeholder={defaultAddress ?? "Customer address used by default"}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-600 block mb-1">Special Instructions</label>
        <textarea
          placeholder="Gate code, dog warning, narrow alley..."
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm resize-none"
        />
      </div>

      <ReadinessBlockerPanel
        blockers={blockers}
        canOverride={canOverride}
        overrideReason={overrideReason}
        onOverrideReasonChange={setOverrideReason}
        onConfirm={() => submit({ overrideReadiness: true })}
        submitting={submitting}
      />

      <ConflictWarningPanel
        conflicts={conflicts}
        reason={conflictReason}
        onReasonChange={setConflictReason}
        onContinue={() => submit({ overrideConflicts: true })}
        submitting={submitting}
      />

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="default"
          size="lg"
          className="flex-1"
          disabled={submitting || !date}
          onClick={() => submit()}
        >
          {submitting ? "Scheduling…" : "Schedule"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
