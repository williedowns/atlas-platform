// Server-side mirror of `computeTotalsFromDraft` in src/store/contractStore.ts.
// Used by every post-sale modify endpoint that touches line_items, discounts,
// doc fee, or tax — so the server is the single source of truth for totals
// rather than trusting client-supplied numbers.

import type { ContractLineItem, ContractDiscount } from "@/types";

export interface RecalcInput {
  line_items: ContractLineItem[];
  discounts: ContractDiscount[];
  doc_fee_amount: number;
  doc_fee_waived: boolean;
  tax_rate: number;
  // Items tax computed by /api/tax. Pass the existing value when only items
  // or discounts changed — caller decides if it needs a fresh Avalara call.
  tax_amount: number;
  tax_exempt: boolean;
}

export interface RecalcOutput {
  subtotal: number;             // items + (doc fee if not waived)
  discount_total: number;
  tax_amount: number;           // effective items tax (0 if exempt)
  doc_fee_tax_amount: number;   // tax on the doc fee (never refunded)
  total: number;                // grand total customer owes
}

export function recalcTotals(input: RecalcInput): RecalcOutput {
  const itemsSubtotal = input.line_items.reduce(
    (sum, item) => sum + (item.sell_price ?? 0) * (item.quantity ?? 0),
    0
  );
  const docFeeAmount = input.doc_fee_waived ? 0 : (input.doc_fee_amount ?? 0);
  const subtotal = itemsSubtotal + docFeeAmount;
  const discount_total = input.discounts.reduce((sum, d) => sum + (d.amount ?? 0), 0);

  // Tax-exempt zeroes items tax (Rx-on-file customer). Doc fee tax always
  // collected — it's the non-refundable portion at the bookkeeper level.
  const effectiveItemsTax = input.tax_exempt ? 0 : (input.tax_amount ?? 0);
  const doc_fee_tax_amount = docFeeAmount > 0
    ? Math.round(docFeeAmount * (input.tax_rate ?? 0) * 100) / 100
    : 0;
  const totalTax = effectiveItemsTax + doc_fee_tax_amount;

  const total = Math.max(0, subtotal - discount_total + totalTax);

  return {
    subtotal: round2(subtotal),
    discount_total: round2(discount_total),
    tax_amount: round2(effectiveItemsTax),
    doc_fee_tax_amount: round2(doc_fee_tax_amount),
    total: round2(total),
  };
}

// Recompute items tax from line_items + discounts when the tax_rate is known
// and we don't want to round-trip to Avalara for a small edit.
export function recomputeItemsTaxFlat(
  line_items: ContractLineItem[],
  discounts: ContractDiscount[],
  tax_rate: number
): number {
  const itemsSubtotal = line_items.reduce(
    (sum, item) => sum + (item.sell_price ?? 0) * (item.quantity ?? 0),
    0
  );
  const discount_total = discounts.reduce((sum, d) => sum + (d.amount ?? 0), 0);
  const taxable = Math.max(0, itemsSubtotal - discount_total);
  return Math.round(taxable * (tax_rate ?? 0) * 100) / 100;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
