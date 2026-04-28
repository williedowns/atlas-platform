// Lyon Financial 4-stage payment templates per 2026-04-28 letter from Madison Meixsell.
// Each project type has its own draw schedule; stage-1 is the deposit.
// Lyon requires a minimum of 10% to be paid at project completion.

import type { LyonStage } from "@/types";

export type LyonProjectType =
  | "fiberglass_pool"
  | "vinyl_liner_pool"
  | "materials_only"
  | "metal_building"
  | "metal_building_prefab";

export const LYON_PROJECT_TYPE_LABELS: Record<LyonProjectType, string> = {
  fiberglass_pool: "Fiberglass Pool",
  vinyl_liner_pool: "Vinyl Liner Pool",
  materials_only: "Materials Only / Shed",
  metal_building: "Metal Building / Shed (full)",
  metal_building_prefab: "Metal Building (prefab)",
};

interface StageTemplate {
  label: string;
  percent: number;
}

const TEMPLATES: Record<LyonProjectType, StageTemplate[]> = {
  fiberglass_pool: [
    { label: "Deposit", percent: 25 },
    { label: "Shell drop", percent: 25 },
    { label: "Backfill & Equipment OR Decking", percent: 25 },
    { label: "Project complete (incl. decking)", percent: 25 },
  ],
  vinyl_liner_pool: [
    { label: "Deposit", percent: 25 },
    { label: "Excavation", percent: 25 },
    { label: "Walls & Backfill", percent: 25 },
    { label: "Project complete (incl. liner drop)", percent: 25 },
  ],
  materials_only: [
    { label: "Deposit", percent: 30 },
    { label: "Project complete", percent: 70 },
  ],
  metal_building: [
    { label: "Deposit", percent: 25 },
    { label: "Concrete foundation", percent: 25 },
    { label: "Framing", percent: 25 },
    { label: "Project complete", percent: 25 },
  ],
  metal_building_prefab: [
    { label: "Deposit", percent: 25 },
    { label: "Delivery of prefab building", percent: 25 },
    { label: "Walls / framing set", percent: 25 },
    { label: "Project complete", percent: 25 },
  ],
};

/** Build the initial stages array for a contract amount + project type. */
export function buildLyonStages(projectType: LyonProjectType, totalAmount: number): LyonStage[] {
  const template = TEMPLATES[projectType];
  return template.map((t, idx) => ({
    stage_num: idx + 1,
    label: t.label,
    percent: t.percent,
    expected_amount: Math.round((totalAmount * t.percent) / 100 * 100) / 100,
    status: "not_started",
    customer_initial_status: "not_sent",
  }));
}
