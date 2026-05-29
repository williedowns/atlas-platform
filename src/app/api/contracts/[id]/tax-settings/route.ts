import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";
import { recalcTotals, recomputeItemsTaxFlat } from "@/lib/contract-recalc";
import type { ContractLineItem, ContractDiscount } from "@/types";

interface PatchBody {
  tax_rate?: unknown;
  tax_exempt?: unknown;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager(id);
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as PatchBody;

  const hasTaxRate = body.tax_rate !== undefined;
  const hasTaxExempt = body.tax_exempt !== undefined;
  if (!hasTaxRate && !hasTaxExempt) {
    return NextResponse.json(
      { error: "At least one of tax_rate or tax_exempt must be provided" },
      { status: 400 }
    );
  }

  let nextTaxRate: number | undefined;
  if (hasTaxRate) {
    const candidate = Number(body.tax_rate);
    if (!Number.isFinite(candidate) || candidate < 0 || candidate > 0.20) {
      return NextResponse.json(
        { error: "tax_rate must be a number between 0 and 0.20 (20% max)" },
        { status: 400 }
      );
    }
    nextTaxRate = candidate;
  }

  let nextTaxExempt: boolean | undefined;
  if (hasTaxExempt) {
    if (typeof body.tax_exempt !== "boolean") {
      return NextResponse.json(
        { error: "tax_exempt must be a boolean" },
        { status: 400 }
      );
    }
    nextTaxExempt = body.tax_exempt;
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, line_items, discounts, tax_rate, tax_exempt, tax_amount,
      doc_fee_amount, doc_fee_waived, deposit_paid, total,
      contract_pdf_url, contract_pdf_archive_urls, qbo_estimate_id,
      total_adjustment_amount,
      customer:customers(has_prescription)
    `)
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const lineItems: ContractLineItem[] = Array.isArray(contract.line_items)
    ? (contract.line_items as ContractLineItem[])
    : [];
  const discounts: ContractDiscount[] = Array.isArray(contract.discounts)
    ? (contract.discounts as ContractDiscount[])
    : [];

  const previousTaxRate = Number(contract.tax_rate ?? 0);
  const previousTaxExempt = Boolean(contract.tax_exempt);
  const previousTotal = Number(contract.total ?? 0);
  const docFeeAmount = Number(contract.doc_fee_amount ?? 0);
  const docFeeWaived = Boolean(contract.doc_fee_waived);
  const depositPaid = Number(contract.deposit_paid ?? 0);

  const effectiveTaxRate = nextTaxRate ?? previousTaxRate;
  // The contracts.tax_exempt column stores the rep's intent (cert collected).
  // The actual tax-zeroing requires the Rx on file too. See
  // contractStore.computeTotalsFromDraft for the matching client gate.
  const effectiveTaxExempt = nextTaxExempt ?? previousTaxExempt;
  const rxOnFile = Array.isArray(contract.customer)
    ? !!(contract.customer[0] as { has_prescription?: boolean } | undefined)?.has_prescription
    : !!(contract.customer as { has_prescription?: boolean } | null)?.has_prescription;
  const recalcTaxExempt = effectiveTaxExempt && rxOnFile;

  const newItemsTax = recomputeItemsTaxFlat(lineItems, discounts, effectiveTaxRate);
  const totals = recalcTotals({
    line_items: lineItems,
    discounts,
    doc_fee_amount: docFeeAmount,
    doc_fee_waived: docFeeWaived,
    tax_rate: effectiveTaxRate,
    tax_amount: newItemsTax,
    tax_exempt: recalcTaxExempt,
    total_adjustment_amount: Number(contract.total_adjustment_amount ?? 0),
  });

  const newBalanceDue = Math.max(0, totals.total - depositPaid);

  const pdfArchive = archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls);

  const updatePayload: Record<string, unknown> = {
    tax_amount: totals.tax_amount,
    doc_fee_tax_amount: totals.doc_fee_tax_amount,
    total: totals.total,
    balance_due: newBalanceDue,
    ...pdfArchive,
    qbo_estimate_id: null,
  };
  if (hasTaxRate) updatePayload.tax_rate = effectiveTaxRate;
  if (hasTaxExempt) updatePayload.tax_exempt = effectiveTaxExempt;

  const { error: writeError } = await supabase
    .from("contracts")
    .update(updatePayload)
    .eq("id", id);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.tax_settings_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      before: {
        tax_rate: previousTaxRate,
        tax_exempt: previousTaxExempt,
      },
      after: {
        tax_rate: effectiveTaxRate,
        tax_exempt: effectiveTaxExempt,
      },
      previous_total: previousTotal,
      new_total: totals.total,
      pdf_archived: true,
      qbo_resync_required: true,
    },
    req,
  });

  return NextResponse.json({
    tax_rate: effectiveTaxRate,
    tax_exempt: effectiveTaxExempt,
    tax_amount: totals.tax_amount,
    total: totals.total,
    balance_due: newBalanceDue,
    pdf_archived: true,
  });
}
