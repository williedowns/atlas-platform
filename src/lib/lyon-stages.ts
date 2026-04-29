// Lyon Financial 4-stage payment templates per 2026-04-28 letter from Madison Meixsell.
// Each project type has its own draw schedule; stage-1 is the deposit.
// Lyon requires a minimum of 10% to be paid at project completion.

import type { LyonStage } from "@/types";

export type LyonProjectType =
  | "fiberglass_pool"
  | "vinyl_liner_pool"
  | "above_ground_pool"
  | "materials_only"
  | "metal_building"
  | "metal_building_prefab"
  | "hot_tub"
  | "swim_spa"
  | "cold_tub"
  | "sauna"
  | "bbq_island";

export const LYON_PROJECT_TYPE_LABELS: Record<LyonProjectType, string> = {
  fiberglass_pool: "Fiberglass Pool",
  vinyl_liner_pool: "Vinyl Liner Pool",
  above_ground_pool: "Above Ground Pool",
  materials_only: "Materials Only / Shed",
  metal_building: "Metal Building / Shed (full)",
  metal_building_prefab: "Metal Building (prefab)",
  hot_tub: "Hot Tub",
  swim_spa: "Swim Spa",
  cold_tub: "Cold Tub",
  sauna: "Sauna",
  bbq_island: "BBQ Island",
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
  // Above-ground pools follow Lyon's materials-only-style 30/70 split per the
  // 2026-04-28 letter pattern (no construction phases like fiberglass/vinyl).
  above_ground_pool: [
    { label: "Deposit", percent: 30 },
    { label: "Installation complete", percent: 70 },
  ],
  // Single-delivery items — confirm the exact split with Lyon, defaulting to
  // 25% deposit / 75% on delivery (the standard non-construction draw).
  hot_tub: [
    { label: "Deposit", percent: 25 },
    { label: "Delivery complete", percent: 75 },
  ],
  swim_spa: [
    { label: "Deposit", percent: 25 },
    { label: "Delivery complete", percent: 75 },
  ],
  cold_tub: [
    { label: "Deposit", percent: 25 },
    { label: "Delivery complete", percent: 75 },
  ],
  sauna: [
    { label: "Deposit", percent: 25 },
    { label: "Delivery complete", percent: 75 },
  ],
  // BBQ Islands are an outdoor build — mirroring the metal-building 4-stage pattern
  bbq_island: [
    { label: "Deposit", percent: 25 },
    { label: "Concrete / foundation", percent: 25 },
    { label: "Frame / build", percent: 25 },
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
