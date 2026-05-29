import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";
import { recalcTotals, recomputeItemsTaxFlat } from "@/lib/contract-recalc";
import { countOutTheDoorDiscounts } from "@/lib/discounts";
import type { ContractDiscount, ContractLineItem } from "@/types";

interface DiscountsBody {
  discounts?: Array<{ label?: unknown; amount?: unknown }>;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager(id);
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as DiscountsBody;
  if (!Array.isArray(body.discounts)) {
    return NextResponse.json(
      { error: "discounts must be an array" },
      { status: 400 }
    );
  }

  const newDiscounts: ContractDiscount[] = [];
  for (let i = 0; i < body.discounts.length; i++) {
    const raw = body.discounts[i];
    const label = typeof raw?.label === "string" ? raw.label.trim() : "";
    if (label.length === 0) {
      return NextResponse.json(
        { error: `discounts[${i}].label must be a non-empty string` },
        { status: 400 }
      );
    }
    const amount = Number(raw?.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: `discounts[${i}].amount must be a positive number` },
        { status: 400 }
      );
    }
    newDiscounts.push({
      type: "other",
      label,
      amount,
      requires_approval: false,
    });
  }

  if (countOutTheDoorDiscounts(newDiscounts) > 1) {
    return NextResponse.json(
      { error: "Only one out-the-door discount is allowed per contract" },
      { status: 400 }
    );
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, line_items, discounts, tax_rate, tax_exempt,
      tax_amount, doc_fee_amount, doc_fee_waived, deposit_paid,
      contract_pdf_url, contract_pdf_archive_urls, qbo_estimate_id,
      total, balance_due, total_adjustment_amount,
      customer:customers(has_prescription)
    `)
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const lineItems: ContractLineItem[] = Array.isArray(contract.line_items)
    ? (contract.line_items as ContractLineItem[])
    : [];
  const previousDiscounts: ContractDiscount[] = Array.isArray(contract.discounts)
    ? (contract.discounts as ContractDiscount[])
    : [];
  const taxRate = Number(contract.tax_rate ?? 0);
  // Tax-exempt requires both the signed cert AND the Rx on file. See
  // contractStore.computeTotalsFromDraft for the matching client gate.
  const rxOnFile = Array.isArray(contract.customer)
    ? !!(contract.customer[0] as { has_prescription?: boolean } | undefined)?.has_prescription
    : !!(contract.customer as { has_prescription?: boolean } | null)?.has_prescription;
  const taxExempt = !!contract.tax_exempt && rxOnFile;
  const docFeeAmount = Number(contract.doc_fee_amount ?? 0);
  const docFeeWaived = !!contract.doc_fee_waived;
  const depositPaid = Number(contract.deposit_paid ?? 0);
  const previousTotal = Number(contract.total ?? 0);
  const previousDiscountTotal = previousDiscounts.reduce(
    (sum, d) => sum + Number(d.amount ?? 0),
    0
  );

  const newItemsTax = recomputeItemsTaxFlat(lineItems, newDiscounts, taxRate);
  const totals = recalcTotals({
    line_items: lineItems,
    discounts: newDiscounts,
    doc_fee_amount: docFeeAmount,
    doc_fee_waived: docFeeWaived,
    tax_rate: taxRate,
    tax_amount: newItemsTax,
    tax_exempt: taxExempt,
    total_adjustment_amount: Number(contract.total_adjustment_amount ?? 0),
  });

  const newBalanceDue = Math.max(0, totals.total - depositPaid);

  const pdfArchive = archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls);

  const { error: writeError } = await supabase
    .from("contracts")
    .update({
      discounts: newDiscounts,
      subtotal: totals.subtotal,
      discount_total: totals.discount_total,
      tax_amount: totals.tax_amount,
      doc_fee_tax_amount: totals.doc_fee_tax_amount,
      total: totals.total,
      balance_due: newBalanceDue,
      ...pdfArchive,
      qbo_estimate_id: null,
    })
    .eq("id", id);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.discounts_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      previous_discounts: previousDiscounts,
      new_discounts: newDiscounts,
      previous_discount_total: previousDiscountTotal,
      new_discount_total: totals.discount_total,
      previous_total: previousTotal,
      new_total: totals.total,
      pdf_archived: true,
      qbo_resync_required: true,
    },
    req,
  });

  return NextResponse.json({
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    tax_amount: totals.tax_amount,
    total: totals.total,
    balance_due: newBalanceDue,
    pdf_archived: true,
  });
}
