// Low-deposit detection — Robert Downs flagged in the 04-28 meeting that the
// finance manager wants to track contracts where the customer put down less
// than the suggested 30% deposit (cancellation / chase-the-balance risk).
//
// UPDATE 2026-05-21 (William Downs Sr. clarification): financed amounts run
// at point of sale count as deposits. A Wells-Fargo-funded sale with $0 cash
// down is NOT low-deposit — the money is committed. The threshold compares
// effective deposit (cash + processed financing) against contract total.
//
// Threshold is 30% of contract total by default, overridable via env. Only
// active (signed but not delivered/cancelled/quote) contracts evaluate.

import { effectiveDeposit, type FinancingEntry } from "./effective-deposit";

export const DEFAULT_LOW_DEPOSIT_THRESHOLD = 0.30;

const ACTIVE_STATUSES = new Set(["signed", "deposit_collected", "in_production", "ready_for_delivery"]);

interface ContractLike {
  total?: number | null;
  deposit_paid?: number | null;
  status?: string | null;
  financing?: FinancingEntry[] | FinancingEntry | null | unknown;
}

export interface LowDepositInfo {
  /** True when the active contract's effective deposit is below the threshold */
  isLow: boolean;
  /** effective deposit / total — 0 when total is zero */
  pct: number;
  /** Threshold used for the comparison (0–1) */
  threshold: number;
  /** Whether the contract is even eligible for evaluation (active status, total > 0) */
  evaluated: boolean;
  /** Breakdown of what the effective deposit was composed of */
  cash: number;
  financed: number;
}

/** Compute low-deposit status for a contract row (server-side or client-side, no network). */
export function lowDepositInfo(c: ContractLike, threshold = DEFAULT_LOW_DEPOSIT_THRESHOLD): LowDepositInfo {
  const total = Number(c.total ?? 0);
  const status = String(c.status ?? "");
  const eff = effectiveDeposit(c);

  if (total <= 0 || !ACTIVE_STATUSES.has(status)) {
    return { isLow: false, pct: 0, threshold, evaluated: false, cash: eff.cash, financed: eff.financed };
  }

  const pct = eff.total / total;
  return { isLow: pct < threshold, pct, threshold, evaluated: true, cash: eff.cash, financed: eff.financed };
}
