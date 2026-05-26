import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";
import { recalcTotals } from "@/lib/contract-recalc";
import type { ContractDiscount, ContractLineItem } from "@/types";

// Hard cap on the magnitude of a post-tax adjustment. Anything larger should
// be a real discount, not an adjustment — this guards against the field being
// misused to hide large off-books credits.
const MAX_ADJUSTMENT_ABS = 5;

interface AdjustmentBody {
  amount?: unknown;
  reason?: unknown;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager();
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as AdjustmentBody;

  const amount = Number(body.amount);
  if (!Number.isFinite(amount)) {
    return NextResponse.json(
      { error: "amount must be a finite number" },
      { status: 400 }
    );
  }
  if (Math.abs(amount) > MAX_ADJUSTMENT_ABS) {
    return NextResponse.json(
      { error: `amount magnitude must be ≤ $${MAX_ADJUSTMENT_ABS.toFixed(2)}` },
      { status: 400 }
    );
  }
  const roundedAmount = Math.round(amount * 100) / 100;

  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  if (roundedAmount !== 0 && reason.length === 0) {
    return NextResponse.json(
      { error: "reason is required when amount is non-zero" },
      { status: 400 }
    );
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, line_items, discounts, tax_rate, tax_exempt,
      tax_amount, doc_fee_amount, doc_fee_waived, deposit_paid,
      contract_pdf_url, contract_pdf_archive_urls, qbo_estimate_id,
      total, balance_due, total_adjustment_amount, total_adjustment_reason
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

  const previousAmount = Number(contract.total_adjustment_amount ?? 0);
  const previousReason = (contract.total_adjustment_reason ?? null) as string | null;
  const previousTotal = Number(contract.total ?? 0);
  const depositPaid = Number(contract.deposit_paid ?? 0);

  const totals = recalcTotals({
    line_items: lineItems,
    discounts,
    doc_fee_amount: Number(contract.doc_fee_amount ?? 0),
    doc_fee_waived: !!contract.doc_fee_waived,
    tax_rate: Number(contract.tax_rate ?? 0),
    tax_amount: Number(contract.tax_amount ?? 0),
    tax_exempt: !!contract.tax_exempt,
    total_adjustment_amount: roundedAmount,
  });

  // recalcTotals floors the total at 0. If the adjustment was large enough
  // to push it there, the stored adjustment and the stored total no longer
  // tell a consistent story. Reject loud rather than silently re-using a
  // clamped total on the next edit.
  const unclampedTotal = totals.subtotal - totals.discount_total +
    totals.tax_amount + totals.doc_fee_tax_amount + roundedAmount;
  if (unclampedTotal < 0) {
    return NextResponse.json(
      { error: "adjustment would drop the contract total below $0" },
      { status: 400 }
    );
  }

  const newBalanceDue = Math.max(0, totals.total - depositPaid);
  const pdfArchive = archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls);

  const { error: writeError } = await supabase
    .from("contracts")
    .update({
      total_adjustment_amount: roundedAmount,
      total_adjustment_reason: roundedAmount === 0 ? null : reason,
      total: totals.total,
      balance_due: newBalanceDue,
      ...pdfArchive,
      qbo_estimate_id: null,
    })
    .eq("id", id);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.adjustment_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      previous_amount: previousAmount,
      new_amount: roundedAmount,
      previous_reason: previousReason,
      new_reason: roundedAmount === 0 ? null : reason,
      previous_total: previousTotal,
      new_total: totals.total,
      pdf_archived: true,
      qbo_resync_required: true,
    },
    req,
  });

  return NextResponse.json({
    total_adjustment_amount: roundedAmount,
    total_adjustment_reason: roundedAmount === 0 ? null : reason,
    total: totals.total,
    balance_due: newBalanceDue,
    pdf_archived: true,
  });
}
