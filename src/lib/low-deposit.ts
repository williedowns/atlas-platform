// Low-deposit detection — Robert Downs flagged in the 04-28 meeting that the
// finance manager wants to track contracts where the customer put down less
// than the suggested 30% deposit (cancellation / chase-the-balance risk).
//
// Threshold is 30% of contract total by default, overridable via env. Only
// active (signed but not delivered/cancelled/quote) contracts evaluate.

export const DEFAULT_LOW_DEPOSIT_THRESHOLD = 0.30;

const ACTIVE_STATUSES = new Set(["signed", "deposit_collected", "in_production", "ready_for_delivery"]);

interface ContractLike {
  total?: number | null;
  deposit_paid?: number | null;
  status?: string | null;
}

export interface LowDepositInfo {
  /** True when the active contract's deposit is below the threshold and there's still a balance to lose */
  isLow: boolean;
  /** deposit_paid / total — 0 when total is zero */
  pct: number;
  /** Threshold used for the comparison (0–1) */
  threshold: number;
  /** Whether the contract is even eligible for evaluation (active status, total > 0) */
  evaluated: boolean;
}

/** Compute low-deposit status for a contract row (server-side or client-side, no network). */
export function lowDepositInfo(c: ContractLike, threshold = DEFAULT_LOW_DEPOSIT_THRESHOLD): LowDepositInfo {
  const total = Number(c.total ?? 0);
  const depositPaid = Number(c.deposit_paid ?? 0);
  const status = String(c.status ?? "");

  if (total <= 0 || !ACTIVE_STATUSES.has(status)) {
    return { isLow: false, pct: 0, threshold, evaluated: false };
  }

  const pct = depositPaid / total;
  return { isLow: pct < threshold, pct, threshold, evaluated: true };
}
