"use client";

import { useState, useTransition } from "react";
import { setLostReason } from "../opportunities/actions";

interface LostReasonFormProps {
  opportunityId: string;
}

const LOST_REASONS = [
  { value: "price", label: "Price — too expensive" },
  { value: "competitor", label: "Lost to a competitor" },
  { value: "timing", label: "Timing — not ready yet" },
  { value: "financing", label: "Financing fell through" },
  { value: "ghost", label: "Ghosted / no response" },
  { value: "no_decision_maker", label: "Couldn't reach the decision-maker" },
  { value: "feature_gap", label: "We don't carry what they wanted" },
  { value: "moved", label: "Customer moved / changed address" },
  { value: "other", label: "Other (specify below)" },
];

export default function LostReasonForm({ opportunityId }: LostReasonFormProps) {
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!reason) {
      setError("Pick a reason.");
      return;
    }
    if (reason === "other" && !notes.trim()) {
      setError("For 'Other', please describe the reason in notes.");
      return;
    }
    startTransition(async () => {
      const result = await setLostReason({ opportunityId, reason, notes });
      if (!result.ok) {
        setError(result.error ?? "Save failed.");
      }
    });
  }

  return (
    <section className="bg-red-50 rounded-2xl border-2 border-red-200 overflow-hidden">
      <div className="px-5 py-3 bg-red-100 border-b border-red-200">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-red-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-sm font-bold text-red-900">Why was this lost?</h3>
        </div>
        <p className="text-[11px] text-red-700 mt-0.5">
          A reason is required for win/loss analysis. The stage move set a placeholder — pick the real reason now.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-5 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {LOST_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => setReason(r.value)}
              className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                reason === r.value
                  ? "border-red-500 bg-white text-red-900 font-semibold"
                  : "border-red-200 bg-white text-slate-700 hover:border-red-400"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">
            Additional notes {reason === "other" && <span className="text-red-600">*</span>}
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional context for the win/loss review…"
            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 focus:border-[#00929C]"
          />
        </div>

        {error && (
          <div className="px-3 py-2 rounded-lg bg-red-100 border border-red-300 text-sm text-red-800">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-2">
          <button
            type="submit"
            disabled={pending || !reason}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
          >
            {pending ? "Saving…" : "Save reason"}
          </button>
        </div>
      </form>
    </section>
  );
}
