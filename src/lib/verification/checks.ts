// Show Manager Verification Dashboard — check definitions + auto-compute.
//
// The dashboard verifies that manually-entered finance/contract info is clean
// before the Monday-morning bookkeeper handoff.
//
// Two kinds of checks:
//   auto   — derivable from DB state (contracts, payments, financing JSONB).
//            Computed on every GET; never sticky in the DB unless the manager
//            explicitly overrides (e.g. marks an auto-pass as `discrepancy`
//            with a note explaining why the data is wrong despite passing).
//   manual — the manager logs into an external system (QuickBooks / Intuit,
//            Foundation portal, Lyon portal, etc.) and confirms reality
//            matches our records. Default `pending` until ticked.
//
// One row per (contract_id, check_key) in `contract_verification_checks`.
// Lazy-created when the manager first hits the show's verification dashboard.

export type CheckStatus = "pending" | "verified" | "discrepancy" | "na";
export type CheckKind = "auto" | "manual";

export interface CheckDefinition {
  key: string;
  label: string;
  kind: CheckKind;
  /** Short helper text shown under the check label. */
  description: string;
  /** Order within the per-contract list. */
  order: number;
}

export const CHECK_DEFINITIONS: CheckDefinition[] = [
  // ─ Auto-derived ────────────────────────────────────────────────────────
  {
    key: "customer_signed",
    label: "Customer signature on file",
    kind: "auto",
    description: "Contract has a signed_at timestamp.",
    order: 10,
  },
  {
    key: "pdf_archived",
    label: "Signed contract PDF archived",
    kind: "auto",
    description: "Archived PDF URL is present on the contract.",
    order: 20,
  },
  {
    key: "deposit_collected",
    label: "Full deposit collected",
    kind: "auto",
    description: "deposit_paid covers deposit_amount.",
    order: 30,
  },
  {
    key: "payments_completed",
    label: "All payments marked completed",
    kind: "auto",
    description: "Every payment row on this contract has status=completed.",
    order: 40,
  },
  {
    key: "financing_has_approval",
    label: "Approval number entered for every lender",
    kind: "auto",
    description: "Every financing entry with a financed amount has an approval number.",
    order: 50,
  },

  // ─ Manual (human confirms in external system) ─────────────────────────
  {
    key: "intuit_charge_settled",
    label: "Card charges visible in QuickBooks / Intuit",
    kind: "manual",
    description: "Open Intuit/QuickBooks and confirm every card charge ran for the correct amount.",
    order: 60,
  },
  {
    key: "financing_portal_approved",
    label: "Financing visible in lender portal",
    kind: "manual",
    description: "Log into Foundation / Lyon / Wells / In-House and confirm the application is present and approved.",
    order: 70,
  },
  {
    key: "financing_amount_matches",
    label: "Financed amount matches lender portal",
    kind: "manual",
    description: "Confirm the dollar amount in the lender portal equals what's entered here.",
    order: 80,
  },
  {
    key: "customer_info_complete",
    label: "Customer contact info complete",
    kind: "manual",
    description: "Address, phone, and email are valid and Lori-ready for delivery scheduling.",
    order: 90,
  },
  {
    key: "workbook_complete",
    label: "Show Sales Workbook fields filled",
    kind: "manual",
    description: "Multi-rep splits, freight/crane/removal, spiffs, marketing feedback are entered.",
    order: 100,
  },
];

// ── Minimal types matching the DB shapes the API passes in ─────────────

export interface FinancingEntry {
  type?: string;
  financed_amount?: number;
  approval_number?: string;
  deduct_from_balance?: boolean;
}

export interface ContractSlim {
  id: string;
  deposit_amount: number | null;
  deposit_paid: number | null;
  signed_at: string | null;
  contract_pdf_url: string | null;
  financing: unknown; // JSONB — array OR legacy object {type:'none'}
}

export interface PaymentSlim {
  id: string;
  contract_id: string;
  status: string | null;
  amount: number | null;
  method: string | null;
  intuit_charge_id: string | null;
}

// ── Auto-compute ───────────────────────────────────────────────────────

export function normalizeFinancing(raw: unknown): FinancingEntry[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw as FinancingEntry[];
  // Legacy single-object form: {type: 'none'} means no financing
  const obj = raw as FinancingEntry;
  if (obj.type && obj.type !== "none") return [obj];
  return [];
}

export interface AutoComputed {
  status: CheckStatus;
  reason: string;
}

export function computeAutoCheck(
  key: string,
  contract: ContractSlim,
  payments: PaymentSlim[],
): AutoComputed {
  switch (key) {
    case "customer_signed":
      return contract.signed_at
        ? { status: "verified", reason: `Signed ${contract.signed_at}` }
        : { status: "discrepancy", reason: "No signed_at timestamp on contract" };

    case "pdf_archived":
      return contract.contract_pdf_url
        ? { status: "verified", reason: "PDF URL present" }
        : { status: "discrepancy", reason: "contract_pdf_url is null — sign + archive needed" };

    case "deposit_collected": {
      const dep = Number(contract.deposit_amount ?? 0);
      const paid = Number(contract.deposit_paid ?? 0);
      if (dep <= 0) return { status: "na", reason: "No deposit required" };
      if (paid >= dep) return { status: "verified", reason: `$${paid.toFixed(2)} of $${dep.toFixed(2)} collected` };
      return {
        status: "discrepancy",
        reason: `Short: $${paid.toFixed(2)} collected of $${dep.toFixed(2)} required`,
      };
    }

    case "payments_completed": {
      if (payments.length === 0) {
        return { status: "na", reason: "No payment rows yet" };
      }
      const bad = payments.filter((p) => p.status !== "completed");
      if (bad.length === 0) {
        return { status: "verified", reason: `${payments.length} payment(s) completed` };
      }
      return {
        status: "discrepancy",
        reason: `${bad.length} of ${payments.length} payment(s) not marked completed (status: ${bad.map((p) => p.status).join(", ")})`,
      };
    }

    case "financing_has_approval": {
      const entries = normalizeFinancing(contract.financing).filter(
        (e) => Number(e.financed_amount ?? 0) > 0,
      );
      if (entries.length === 0) return { status: "na", reason: "Cash deal — no financing" };
      const missing = entries.filter((e) => !e.approval_number || !e.approval_number.trim());
      if (missing.length === 0) {
        return { status: "verified", reason: `Approval # entered for ${entries.length} lender(s)` };
      }
      return {
        status: "discrepancy",
        reason: `${missing.length} financing entry(ies) missing approval number`,
      };
    }

    default:
      return { status: "pending", reason: "Unknown auto-check key" };
  }
}

// Per-contract, return whether the contract has any financing rows. Useful
// for the API to mark manual financing checks as `na` when irrelevant.
export function isCashDeal(contract: ContractSlim): boolean {
  return normalizeFinancing(contract.financing).filter(
    (e) => Number(e.financed_amount ?? 0) > 0,
  ).length === 0;
}

// Per-contract, return whether the contract has any card payments. Card
// charges are what the manager would verify in QuickBooks/Intuit.
export function hasCardPayments(payments: PaymentSlim[]): boolean {
  return payments.some((p) => p.method === "credit_card" || p.method === "debit_card");
}

// "Ready for bookkeeper" gate: every check on every contract is either
// verified OR na. Manual checks must be explicitly resolved (no `pending`).
export interface PerContractStatus {
  contract_id: string;
  all_checks: { key: string; status: CheckStatus }[];
}

export function isReadyForBookkeeper(contracts: PerContractStatus[]): {
  ready: boolean;
  remaining: number;
} {
  let remaining = 0;
  for (const c of contracts) {
    for (const check of c.all_checks) {
      if (check.status !== "verified" && check.status !== "na") remaining += 1;
    }
  }
  return { ready: remaining === 0 && contracts.length > 0, remaining };
}
