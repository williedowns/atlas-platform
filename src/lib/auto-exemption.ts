// Auto-applies the TX hydrotherapy exemption when both the cert and the Rx
// land on a contract that still has tax owed in the balance. Different from
// the refund flow: this fires only when the tax has NOT been paid yet —
// instead of refunding money already collected, the system zeroes the tax
// up front and reduces the balance so the customer is never charged.
//
// Trigger points (callers):
//   - /api/customers/[id]/rx           when Rx is uploaded
//   - /api/portal/upload-cert          when cert is uploaded after Rx
//   - scripts/backfill-exemption-cert  per-contract during retro backfill
//
// Skipped (handled elsewhere):
//   - tax_amount = 0          nothing to exempt
//   - tax_refund_amount set   already refunded
//   - balance_due < tax       tax has been (at least partially) paid,
//                             use refund flow instead

import type { SupabaseClient } from "@supabase/supabase-js";
import { archivePdfUrls } from "@/lib/contract-pdf";

export interface AutoExemptResult {
  contractId: string;
  contractNumber: string;
  applied: boolean;
  taxAmount: number;
  reason?: string;
}

interface ContractRow {
  id: string;
  contract_number: string;
  tax_amount: number | null;
  total: number | null;
  balance_due: number | null;
  tax_exempt: boolean | null;
  tax_exempt_cert_received: boolean | null;
  tax_refund_amount: number | null;
  contract_pdf_url: string | null;
  contract_pdf_archive_urls: string[] | null;
}

async function applyToOne(
  supabase: SupabaseClient,
  c: ContractRow,
): Promise<AutoExemptResult> {
  const taxAmount = Number(c.tax_amount ?? 0);
  const balanceDue = Number(c.balance_due ?? 0);

  if (taxAmount === 0) {
    return { contractId: c.id, contractNumber: c.contract_number, applied: false, taxAmount: 0, reason: "Tax already zero" };
  }
  if (c.tax_refund_amount != null) {
    return { contractId: c.id, contractNumber: c.contract_number, applied: false, taxAmount, reason: "Refund already issued" };
  }
  if (!c.tax_exempt_cert_received) {
    return { contractId: c.id, contractNumber: c.contract_number, applied: false, taxAmount, reason: "Cert not on file" };
  }
  if (balanceDue + 0.01 < taxAmount) {
    // Tax has been paid (at least partially). Caller should route to the
    // refund flow instead of auto-exempting.
    return { contractId: c.id, contractNumber: c.contract_number, applied: false, taxAmount, reason: "Tax has been paid — use refund flow" };
  }

  const newTotal = Number(c.total ?? 0) - taxAmount;
  const newBalance = balanceDue - taxAmount;
  const pdfArchive = archivePdfUrls(c.contract_pdf_url, c.contract_pdf_archive_urls);

  const { error } = await supabase
    .from("contracts")
    .update({
      tax_exempt: true,
      tax_amount: 0,
      total: newTotal,
      balance_due: newBalance,
      ...pdfArchive,
      qbo_estimate_id: null,
    })
    .eq("id", c.id);

  if (error) {
    return { contractId: c.id, contractNumber: c.contract_number, applied: false, taxAmount, reason: error.message };
  }
  return { contractId: c.id, contractNumber: c.contract_number, applied: true, taxAmount };
}

/** Try to auto-exempt every contract belonging to a customer. Returns one
 *  result row per contract that had cert received + tax > 0 + no refund.
 *  Caller decides whether to audit-log or notify the bookkeeper. */
export async function applyAutoExemptionForCustomer(
  supabase: SupabaseClient,
  customerId: string,
): Promise<AutoExemptResult[]> {
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, tax_amount, total, balance_due, tax_exempt, tax_exempt_cert_received, tax_refund_amount, contract_pdf_url, contract_pdf_archive_urls",
    )
    .eq("customer_id", customerId)
    .eq("tax_exempt_cert_received", true)
    .gt("tax_amount", 0)
    .is("tax_refund_amount", null);

  if (error || !contracts) return [];
  const results: AutoExemptResult[] = [];
  for (const c of contracts as ContractRow[]) {
    results.push(await applyToOne(supabase, c));
  }
  return results;
}

/** Try to auto-exempt a single contract. Returns a single result row even
 *  if conditions aren't met (the reason field explains why). */
export async function applyAutoExemptionForContract(
  supabase: SupabaseClient,
  contractId: string,
): Promise<AutoExemptResult | null> {
  const { data: contract, error } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, tax_amount, total, balance_due, tax_exempt, tax_exempt_cert_received, tax_refund_amount, contract_pdf_url, contract_pdf_archive_urls",
    )
    .eq("id", contractId)
    .maybeSingle();
  if (error || !contract) return null;
  return applyToOne(supabase, contract as ContractRow);
}
