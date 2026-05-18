"use client";

import { Button } from "@/components/ui/button";

interface Props {
  conflicts: string[];
  reason: string;
  onReasonChange: (v: string) => void;
  onContinue: () => void;
  submitting: boolean;
  continueLabel?: string;
}

export default function ConflictWarningPanel({
  conflicts,
  reason,
  onReasonChange,
  onContinue,
  submitting,
  continueLabel = "Continue Anyway",
}: Props) {
  if (conflicts.length === 0) return null;

  return (
    <div className="rounded-lg bg-amber-50 border-2 border-amber-300 p-3 space-y-2">
      <p className="text-sm font-bold text-amber-800">Crew schedule conflict</p>
      <ul className="list-disc list-inside text-sm text-amber-700">
        {conflicts.map((c) => <li key={c}>{c}</li>)}
      </ul>
      <div className="space-y-2 pt-1">
        <label className="text-xs font-semibold text-amber-800">
          Reason (optional, appended to notes)
        </label>
        <input
          type="text"
          placeholder="e.g. morning + afternoon split, second crew on standby"
          value={reason}
          onChange={(e) => onReasonChange(e.target.value)}
          className="h-10 w-full rounded-lg border border-amber-300 bg-white px-3 text-sm"
        />
        <Button
          variant="ghost"
          size="sm"
          disabled={submitting}
          onClick={onContinue}
        >
          {continueLabel}
        </Button>
      </div>
    </div>
  );
}
