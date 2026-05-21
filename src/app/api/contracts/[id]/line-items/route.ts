import { NextResponse } from "next/server";
import { logAction } from "@/lib/audit";
import { requireAdminOrManager } from "@/lib/auth-guard";
import { archivePdfUrls } from "@/lib/contract-pdf";
import { recalcTotals, recomputeItemsTaxFlat } from "@/lib/contract-recalc";
import type { ContractLineItem, ContractDiscount } from "@/types";

interface PatchBody {
  line_items?: unknown;
}

interface DiffAdded {
  product_name: string;
  sell_price: number;
  quantity: number;
}

interface DiffRemoved {
  product_name: string;
  sell_price: number;
  quantity: number;
}

interface DiffChanged {
  product_name: string;
  from: {
    sell_price: number;
    quantity: number;
    shell_color: string | null;
    cabinet_color: string | null;
  };
  to: {
    sell_price: number;
    quantity: number;
    shell_color: string | null;
    cabinet_color: string | null;
  };
}

function normColor(v: string | undefined | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 ? null : t;
}

// PATCH /api/contracts/[id]/line-items
// Full replacement of the contract's line_items array. Recalculates subtotal,
// items tax, totals, and balance_due. Archives the prior PDF (forces regen),
// clears qbo_estimate_id so the bookkeeper knows a resync is needed.
// Admin/manager only — matches the rest of the post-sale modify policy.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const guard = await requireAdminOrManager();
  if (guard instanceof NextResponse) return guard;
  const { user, supabase } = guard;

  const body = (await req.json().catch(() => ({}))) as PatchBody;
  if (!Array.isArray(body.line_items)) {
    return NextResponse.json({ error: "line_items must be an array" }, { status: 400 });
  }

  const incoming = body.line_items as unknown[];
  const validated: ContractLineItem[] = [];
  for (let i = 0; i < incoming.length; i++) {
    const raw = incoming[i] as Partial<ContractLineItem> | null;
    if (!raw || typeof raw !== "object") {
      return NextResponse.json(
        { error: `line_items[${i}] is not an object` },
        { status: 400 }
      );
    }
    const productId = typeof raw.product_id === "string" ? raw.product_id.trim() : "";
    const productName = typeof raw.product_name === "string" ? raw.product_name.trim() : "";
    const sellPrice = Number(raw.sell_price);
    const quantity = Number(raw.quantity);
    if (productId.length === 0) {
      return NextResponse.json(
        { error: `line_items[${i}].product_id is required` },
        { status: 400 }
      );
    }
    if (productName.length === 0) {
      return NextResponse.json(
        { error: `line_items[${i}].product_name is required` },
        { status: 400 }
      );
    }
    if (!Number.isFinite(sellPrice) || sellPrice < 0) {
      return NextResponse.json(
        { error: `line_items[${i}].sell_price must be a number >= 0` },
        { status: 400 }
      );
    }
    if (!Number.isFinite(quantity) || quantity < 1) {
      return NextResponse.json(
        { error: `line_items[${i}].quantity must be a number >= 1` },
        { status: 400 }
      );
    }
    validated.push({
      ...(raw as ContractLineItem),
      product_id: productId,
      product_name: productName,
      sell_price: sellPrice,
      quantity,
      msrp: Number.isFinite(Number(raw.msrp)) ? Number(raw.msrp) : 0,
    });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, line_items, discounts, tax_rate, tax_exempt, tax_amount,
      doc_fee_amount, doc_fee_waived, deposit_paid, balance_due, total,
      contract_pdf_url, contract_pdf_archive_urls, qbo_estimate_id
    `)
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const oldItems: ContractLineItem[] = Array.isArray(contract.line_items)
    ? (contract.line_items as ContractLineItem[])
    : [];
  const discounts: ContractDiscount[] = Array.isArray(contract.discounts)
    ? (contract.discounts as ContractDiscount[])
    : [];

  // Spa-line cascade: if a spa line was removed (i.e. its product_id is gone
  // from the new array), strip any items whose linked_spa_product_id pointed
  // at that spa. This mirrors the in-cart removal cascade so post-sale edits
  // don't leave orphan site-prep lines (e.g. Crushed Granite) behind.
  const newProductIds = new Set(validated.map((it) => it.product_id));
  const removedSpaProductIds = new Set<string>();
  for (const old of oldItems) {
    if (!newProductIds.has(old.product_id)) {
      // It was removed. Check whether any old item referenced it via
      // linked_spa_product_id — if so, this was a spa.
      const wasSpa = oldItems.some(
        (o) => o.linked_spa_product_id === old.product_id
      );
      if (wasSpa) removedSpaProductIds.add(old.product_id);
    }
  }
  const newItems = removedSpaProductIds.size === 0
    ? validated
    : validated.filter((it) =>
        !it.linked_spa_product_id || !removedSpaProductIds.has(it.linked_spa_product_id)
      );

  const taxRate = Number(contract.tax_rate ?? 0);
  const taxExempt = Boolean(contract.tax_exempt);
  const docFeeAmount = Number(contract.doc_fee_amount ?? 0);
  const docFeeWaived = Boolean(contract.doc_fee_waived);
  const depositPaid = Number(contract.deposit_paid ?? 0);
  const previousTotal = Number(contract.total ?? 0);
  const previousBalanceDue = Number(contract.balance_due ?? 0);

  const newItemsTax = recomputeItemsTaxFlat(newItems, discounts, taxRate);
  const totals = recalcTotals({
    line_items: newItems,
    discounts,
    doc_fee_amount: docFeeAmount,
    doc_fee_waived: docFeeWaived,
    tax_rate: taxRate,
    tax_amount: newItemsTax,
    tax_exempt: taxExempt,
  });

  const newBalanceDue = Math.max(0, totals.total - depositPaid);

  const pdfArchive = archivePdfUrls(contract.contract_pdf_url, contract.contract_pdf_archive_urls);

  const { error: writeError } = await supabase
    .from("contracts")
    .update({
      line_items: newItems,
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

  // Compact diff for audit metadata. Key by product_id for matching, but the
  // displayed identity in the audit log is product_name.
  const oldByPid = new Map(oldItems.map((it) => [it.product_id, it]));
  const newByPid = new Map(newItems.map((it) => [it.product_id, it]));

  const added: DiffAdded[] = [];
  const removed: DiffRemoved[] = [];
  const changed: DiffChanged[] = [];

  for (const [pid, it] of newByPid) {
    if (!oldByPid.has(pid)) {
      added.push({
        product_name: it.product_name,
        sell_price: Number(it.sell_price ?? 0),
        quantity: Number(it.quantity ?? 0),
      });
    }
  }
  for (const [pid, it] of oldByPid) {
    if (!newByPid.has(pid)) {
      removed.push({
        product_name: it.product_name,
        sell_price: Number(it.sell_price ?? 0),
        quantity: Number(it.quantity ?? 0),
      });
    }
  }
  for (const [pid, oldIt] of oldByPid) {
    const newIt = newByPid.get(pid);
    if (!newIt) continue;
    const oldShell = normColor(oldIt.shell_color);
    const newShell = normColor(newIt.shell_color);
    const oldCab = normColor(oldIt.cabinet_color);
    const newCab = normColor(newIt.cabinet_color);
    const priceChanged = Number(oldIt.sell_price ?? 0) !== Number(newIt.sell_price ?? 0);
    const qtyChanged = Number(oldIt.quantity ?? 0) !== Number(newIt.quantity ?? 0);
    const shellChanged = oldShell !== newShell;
    const cabChanged = oldCab !== newCab;
    if (priceChanged || qtyChanged || shellChanged || cabChanged) {
      changed.push({
        product_name: newIt.product_name,
        from: {
          sell_price: Number(oldIt.sell_price ?? 0),
          quantity: Number(oldIt.quantity ?? 0),
          shell_color: oldShell,
          cabinet_color: oldCab,
        },
        to: {
          sell_price: Number(newIt.sell_price ?? 0),
          quantity: Number(newIt.quantity ?? 0),
          shell_color: newShell,
          cabinet_color: newCab,
        },
      });
    }
  }

  logAction({
    userId: user.id,
    action: "contract.line_items_updated",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      added,
      removed,
      changed,
      previous_total: previousTotal,
      new_total: totals.total,
      previous_balance_due: previousBalanceDue,
      new_balance_due: newBalanceDue,
      qbo_resync_required: true,
      pdf_archived: !!contract.contract_pdf_url,
      cascade_removed_spa_product_ids: Array.from(removedSpaProductIds),
    },
    req,
  });

  return NextResponse.json({
    subtotal: totals.subtotal,
    discount_total: totals.discount_total,
    tax_amount: totals.tax_amount,
    doc_fee_tax_amount: totals.doc_fee_tax_amount,
    total: totals.total,
    balance_due: newBalanceDue,
    pdf_archived: true,
    qbo_resync_required: true,
  });
}
