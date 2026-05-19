"use client";

import { useState, useTransition } from "react";
import { moveOpportunityStage } from "../opportunities/actions";

interface StageMoveSelectProps {
  opportunityId: string;
  currentStageId: string;
  stages: Array<{ id: string; name: string }>;
}

export default function StageMoveSelect({ opportunityId, currentStageId, stages }: StageMoveSelectProps) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const newStageId = e.target.value;
    if (newStageId === currentStageId) return;

    setError(null);
    startTransition(async () => {
      const result = await moveOpportunityStage(opportunityId, newStageId);
      if (!result.ok) {
        setError(result.error ?? "Move failed");
      }
    });
  }

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <select
        value={currentStageId}
        onChange={handleChange}
        disabled={pending}
        aria-label="Move to stage"
        className="text-[11px] font-medium px-2 py-1 rounded bg-white border border-slate-200 text-slate-700 hover:border-[#00929C] focus:outline-none focus:ring-2 focus:ring-[#00929C]/30 cursor-pointer disabled:opacity-50"
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error && (
        <div className="absolute top-full left-0 mt-1 text-[10px] text-red-600 bg-white px-2 py-0.5 rounded shadow border border-red-200 whitespace-nowrap z-20">
          {error}
        </div>
      )}
    </div>
  );
}
