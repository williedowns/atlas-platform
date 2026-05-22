// Effective deposit calculation.
//
// Per William Downs Sr. (owner) clarification 2026-05-21: "If we run the
// money at the point of sale, it would go under deposits. Under financed
// deposit. We should be able to see finance deposits and then total deposit."
//
// So a sale where Wells Fargo (or any financer) was run at POS — credit
// application processed, money committed to the deal — counts as a deposit
// the same way cash, check, or card does. The financing JSONB array on the
// contract carries one entry per financing source with a `financed_amount`.
//
// Effective deposit = cash deposit_paid + sum of processed financed amounts.
// "Processed" = financed_amount > 0 (the field is only non-zero when the
// finance application was actually run, not just contemplated).

export type FinancingEntry = {
  type?: string;
  financed_amount?: number | string | null;
  deduct_from_balance?: boolean;
  // other fields ignored here
};

type ContractLike = {
  deposit_paid?: number | null;
  financing?: FinancingEntry[] | FinancingEntry | null | unknown;
};

export type EffectiveDeposit = {
  cash: number;        // deposit_paid — cash / check / card / ACH at POS
  financed: number;    // sum of processed financed amounts
  total: number;       // cash + financed — the number that should be compared against contract total
};

export function effectiveDeposit(c: ContractLike): EffectiveDeposit {
  const cash = Number(c.deposit_paid ?? 0) || 0;
  let financed = 0;
  const raw = c.financing;
  const entries: FinancingEntry[] = Array.isArray(raw)
    ? (raw as FinancingEntry[])
    : raw && typeof raw === "object"
      ? [raw as FinancingEntry]
      : [];
  for (const f of entries) {
    const amt = Number(f.financed_amount ?? 0);
    if (Number.isFinite(amt) && amt > 0) financed += amt;
  }
  return { cash, financed, total: cash + financed };
}
