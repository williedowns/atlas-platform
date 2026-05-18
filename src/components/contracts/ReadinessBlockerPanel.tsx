"use client";

import { Button } from "@/components/ui/button";

interface Props {
  blockers: string[];
  canOverride: boolean;
  overrideReason: string;
  onOverrideReasonChange: (v: string) => void;
  onConfirm: () => void;
  submitting: boolean;
  confirmLabel?: string;
}

export default function ReadinessBlockerPanel({
  blockers,
  canOverride,
  overrideReason,
  onOverrideReasonChange,
  onConfirm,
  submitting,
  confirmLabel = "Override and Schedule Anyway",
}: Props) {
  if (blockers.length === 0) return null;

  return (
    <div className="rounded-lg bg-red-50 border-2 border-red-300 p-3 space-y-2">
      <p className="text-sm font-bold text-red-800">Readiness check failed:</p>
      <ul className="list-disc list-inside text-sm text-red-700">
        {blockers.map((b) => <li key={b}>{b}</li>)}
      </ul>
      {canOverride ? (
        <div className="space-y-2 pt-1">
          <label className="text-xs font-semibold text-red-800">
            Override reason (admin/manager only)
          </label>
          <input
            type="text"
            placeholder="Why are you overriding the gate?"
            value={overrideReason}
            onChange={(e) => onOverrideReasonChange(e.target.value)}
            className="h-10 w-full rounded-lg border border-red-300 bg-white px-3 text-sm"
          />
          <Button
            variant="ghost"
            size="sm"
            disabled={submitting || !overrideReason.trim()}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-red-700 pt-1">
          Only an admin or manager can override these blockers.
        </p>
      )}
    </div>
  );
}
