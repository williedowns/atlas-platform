"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

interface Props {
  contractId: string;
  defaultAddress?: string;
}

export default function ScheduleDeliveryButton({ contractId, defaultAddress }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState("");
  const [windowText, setWindowText] = useState("");
  const [address, setAddress] = useState(defaultAddress ?? "");
  const [instructions, setInstructions] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blockers, setBlockers] = useState<string[]>([]);
  const [canOverride, setCanOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");

  async function submit(override = false) {
    setSubmitting(true);
    setError(null);
    if (!override) {
      setBlockers([]);
      setCanOverride(false);
    }
    const r = await fetch("/api/deliveries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: contractId,
        scheduled_date: date,
        scheduled_window: windowText || null,
        delivery_address: address || null,
        special_instructions: instructions || null,
        override_readiness: override,
        override_reason: override ? overrideReason : null,
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

      {blockers.length > 0 && (
        <div className="rounded-lg bg-red-50 border-2 border-red-300 p-3 space-y-2">
          <p className="text-sm font-bold text-red-800">Readiness check failed:</p>
          <ul className="list-disc list-inside text-sm text-red-700">
            {blockers.map((b) => <li key={b}>{b}</li>)}
          </ul>
          {canOverride && (
            <div className="space-y-2">
              <label className="text-xs font-semibold text-red-800">Override reason (manager only)</label>
              <input
                type="text"
                placeholder="Why are you overriding the gate?"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                className="h-10 w-full rounded-lg border border-red-300 bg-white px-3 text-sm"
              />
              <Button
                variant="ghost"
                size="sm"
                disabled={submitting || !overrideReason.trim()}
                onClick={() => submit(true)}
              >
                Override and Schedule Anyway
              </Button>
            </div>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}

      <div className="flex gap-2">
        <Button
          variant="default"
          size="lg"
          className="flex-1"
          disabled={submitting || !date}
          onClick={() => submit(false)}
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
