import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import type { ContractFinancing, FinancingType } from "@/types";

interface AddFinancingBody {
  type?: FinancingType;
  financer_name?: string;
  financed_amount?: number;
  approval_number?: string;
  plan_number?: string;
  plan_description?: string;
  term_months?: number;
  apr?: number;
  external_application_id?: string;
  notes?: string;
  deduct_from_balance?: boolean;

  // Optional primary borrower override (if different from contract customer).
  primary_buyer_first_name?: string;
  primary_buyer_last_name?: string;
  primary_buyer_email?: string;
  primary_buyer_phone?: string;
}

// POST /api/contracts/[id]/financing
// Adds a NEW financing entry to an existing contract. Used for the
// balance-to-financing conversion flow — Willie 2026-05-20: customer had
// a $9k balance set up to pay by check, calls today to cancel, sales rep
// saves the deal by switching to financing.
//
// Rules:
//   - Admin/manager only.
//   - financed_amount must not exceed current balance_due (hard guard).
//   - deduct_from_balance defaults to true (this is replacing cash balance).
//   - Recalculates balance_due to reflect the new financing entry.
//   - Archives current contract_pdf_url to contract_pdf_archive_urls[]
//     so the original signed PDF is preserved.
//   - Sets contract_pdf_url to null (forces regen on next view/print).
//   - Writes audit_logs row.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json(
      { error: "Only admin or manager can add financing to an existing contract." },
      { status: 403 }
    );
  }

  const body = (await req.json().catch(() => ({}))) as AddFinancingBody;

  const financedAmount = Number(body.financed_amount);
  if (!Number.isFinite(financedAmount) || financedAmount <= 0) {
    return NextResponse.json(
      { error: "financed_amount is required and must be a positive number" },
      { status: 400 }
    );
  }

  const financerName = typeof body.financer_name === "string" ? body.financer_name.trim() : "";
  if (financerName.length === 0) {
    return NextResponse.json(
      { error: "financer_name is required (e.g. Wells Fargo, Synchrony, Foundation, Lyon, GreenSky, In-house)" },
      { status: 400 }
    );
  }

  const type: FinancingType = body.type === "in_house" || body.type === "third_party" ? body.type : "third_party";
  const deductFromBalance = body.deduct_from_balance !== false; // default true

  const { data: contract } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, total, deposit_paid, balance_due, financing,
      contract_pdf_url, contract_pdf_archive_urls
    `)
    .eq("id", id)
    .maybeSingle();
  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const total = Number(contract.total ?? 0);
  const depositPaid = Number(contract.deposit_paid ?? 0);
  const existingFinancing: ContractFinancing[] = Array.isArray(contract.financing)
    ? (contract.financing as ContractFinancing[])
    : [];
  const existingDeducting = existingFinancing.reduce((sum, f) => {
    if ((f as { deduct_from_balance?: boolean }).deduct_from_balance !== false) {
      return sum + Number(f.financed_amount ?? 0);
    }
    return sum;
  }, 0);
  const currentBalance = total - depositPaid - existingDeducting;

  // Hard guard: don't allow the new entry's financed_amount to exceed current balance.
  if (deductFromBalance && financedAmount > currentBalance + 0.01) {
    return NextResponse.json(
      {
        error: `Cannot finance $${financedAmount.toFixed(2)} — current balance is $${currentBalance.toFixed(2)}.`,
        code: "exceeds_balance_due",
        details: {
          total,
          deposit_paid: depositPaid,
          financed_deducting_existing: existingDeducting,
          current_balance: currentBalance,
          requested_financed_amount: financedAmount,
        },
      },
      { status: 400 }
    );
  }

  // Build the new entry.
  const nowIso = new Date().toISOString();
  const newEntry: ContractFinancing & {
    funding_status: string;
    added_at: string;
    added_by: string;
    term_months?: number;
    apr?: number;
    external_application_id?: string;
    lifecycle_notes?: string;
  } = {
    type,
    financer_name: financerName,
    financed_amount: financedAmount,
    deduct_from_balance: deductFromBalance,
    approval_number: body.approval_number,
    plan_number: body.plan_number,
    plan_description: body.plan_description,
    funding_status: "awaiting_customer_accept",
    added_at: nowIso,
    added_by: user.id,
  };
  if (typeof body.term_months === "number") newEntry.term_months = body.term_months;
  if (typeof body.apr === "number") newEntry.apr = body.apr;
  if (typeof body.external_application_id === "string") {
    newEntry.external_application_id = body.external_application_id;
  }
  if (typeof body.notes === "string" && body.notes.trim()) {
    newEntry.lifecycle_notes = body.notes.trim();
  }
  if (body.primary_buyer_first_name) newEntry.primary_buyer_first_name = body.primary_buyer_first_name;
  if (body.primary_buyer_last_name) newEntry.primary_buyer_last_name = body.primary_buyer_last_name;
  if (body.primary_buyer_email) newEntry.primary_buyer_email = body.primary_buyer_email;
  if (body.primary_buyer_phone) newEntry.primary_buyer_phone = body.primary_buyer_phone;

  const nextFinancing = [...existingFinancing, newEntry];
  const newBalanceDue = deductFromBalance
    ? Math.max(0, currentBalance - financedAmount)
    : currentBalance;

  // Archive the prior contract_pdf_url before regen.
  const priorArchive: string[] = Array.isArray(contract.contract_pdf_archive_urls)
    ? contract.contract_pdf_archive_urls
    : [];
  const nextArchive = contract.contract_pdf_url
    ? [contract.contract_pdf_url, ...priorArchive]
    : priorArchive;

  const { error: writeError } = await supabase
    .from("contracts")
    .update({
      financing: nextFinancing,
      balance_due: newBalanceDue,
      contract_pdf_url: null,
      contract_pdf_archive_urls: nextArchive,
    })
    .eq("id", id);

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 });

  logAction({
    userId: user.id,
    action: "contract.financing_added",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      financer_name: financerName,
      financed_amount: financedAmount,
      type,
      deduct_from_balance: deductFromBalance,
      previous_balance_due: currentBalance,
      new_balance_due: newBalanceDue,
      term_months: body.term_months ?? null,
      apr: body.apr ?? null,
      approval_number: body.approval_number ?? null,
      external_application_id: body.external_application_id ?? null,
      pdf_archived: !!contract.contract_pdf_url,
    },
    req,
  });

  return NextResponse.json({
    entry: newEntry,
    balance_due: newBalanceDue,
    financing_index: nextFinancing.length - 1,
    pdf_archived: !!contract.contract_pdf_url,
  });
}
