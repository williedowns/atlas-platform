// Single source of truth for delivery-readiness evaluation.
// Used by /api/deliveries (server gate) AND by RSC pages that render the
// ReadinessChecklist component, so UI preview and server gate never diverge.

import { formatCurrency } from "@/lib/utils";

export type ReadinessItemKey =
  | "balance"
  | "drivers_license"
  | "permit"
  | "hoa";

export interface ReadinessItem {
  key: ReadinessItemKey;
  label: string;
  satisfied: boolean;
  detail: string;
  applicable: boolean; // false = item not relevant to this contract (e.g. no financing → no DL needed)
}

export interface ReadinessContractInput {
  balance_due: number | null;
  financing: unknown; // array | object | null — normalize here
  needs_permit: boolean | null;
  permit_status: string | null;
  needs_hoa: boolean | null;
  hoa_status: string | null;
}

export interface ReadinessResult {
  items: ReadinessItem[];
  blockers: ReadinessItem[]; // applicable && !satisfied
  ok: boolean;
}

function hasFinancing(financing: unknown): boolean {
  if (!financing) return false;
  if (Array.isArray(financing)) return financing.length > 0;
  if (typeof financing === "object") {
    // Legacy shape: { type: "none" } means no financing
    const f = financing as Record<string, unknown>;
    return f.type !== "none" && f.type !== undefined;
  }
  return false;
}

export function evaluateReadiness(
  contract: ReadinessContractInput,
  dlPresent: boolean,
): ReadinessResult {
  const balanceCleared = (contract.balance_due ?? 0) <= 0.01;
  const financingActive = hasFinancing(contract.financing);
  const permitNeeded = !!contract.needs_permit;
  const hoaNeeded = !!contract.needs_hoa;

  const items: ReadinessItem[] = [
    {
      key: "balance",
      label: "Balance cleared",
      satisfied: balanceCleared,
      detail: balanceCleared
        ? "Balance is paid in full"
        : `${formatCurrency(contract.balance_due ?? 0)} still due`,
      applicable: true,
    },
    {
      key: "drivers_license",
      label: "Driver's license on file",
      satisfied: !financingActive || dlPresent,
      detail: !financingActive
        ? "Not required (no financing)"
        : dlPresent
          ? "DL uploaded to customer file vault"
          : "Required for financing — missing from file vault",
      applicable: financingActive,
    },
    {
      key: "permit",
      label: "Permit approved",
      satisfied: !permitNeeded || contract.permit_status === "approved",
      detail: !permitNeeded
        ? "Not required for this contract"
        : contract.permit_status === "approved"
          ? "Permit approved"
          : `Permit status: ${contract.permit_status ?? "not started"}`,
      applicable: permitNeeded,
    },
    {
      key: "hoa",
      label: "HOA approval",
      satisfied: !hoaNeeded || contract.hoa_status === "approved",
      detail: !hoaNeeded
        ? "Not required for this contract"
        : contract.hoa_status === "approved"
          ? "HOA approved"
          : `HOA status: ${contract.hoa_status ?? "not started"}`,
      applicable: hoaNeeded,
    },
  ];

  const blockers = items.filter((i) => i.applicable && !i.satisfied);

  return {
    items,
    blockers,
    ok: blockers.length === 0,
  };
}

// Helper for server components: pass contract + dl-count, get full result.
export function blockerLabels(result: ReadinessResult): string[] {
  return result.blockers.map((b) => b.label);
}
