import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { refundCharge } from "@/lib/payments/intuit";

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
    .single();

  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: contract } = await supabase
    .from("contracts")
    .select(
      "id, tax_refund_amount, tax_amount, contract_number, tax_rate, tax_rate_source, tax_rate_jurisdictions, tax_rate_effective_date, tax_rate_resolved_at"
    )
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  if (contract.tax_refund_amount != null) {
    return NextResponse.json({ error: "A tax refund has already been recorded for this contract" }, { status: 409 });
  }

  const body = await req.json();
  const amount = parseFloat(body.amount);
  const notes = (body.notes ?? "").trim();
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";

  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Amount must be greater than zero" }, { status: 400 });
  }

  // Audit defense: require a categorized reason on every refund. Matches the
  // CHECK constraint added in migration 099. Free-text notes remain
  // optional/supplementary; reason carries the audit weight.
  const ALLOWED_REASONS = new Set([
    "tx_hydrotherapy_rx",
    "ok_disabled_veteran",
    "resale_certificate",
    "corrected_rate",
    "customer_dispute",
    "other",
  ]);
  if (!ALLOWED_REASONS.has(reason)) {
    return NextResponse.json(
      {
        error:
          "Refund reason required. One of: tx_hydrotherapy_rx, ok_disabled_veteran, resale_certificate, corrected_rate, customer_dispute, other",
      },
      { status: 400 }
    );
  }

  // Find CC payments on this contract that have an Intuit charge ID
  const { data: ccPayments } = await supabase
    .from("payments")
    .select("intuit_charge_id, card_brand, card_last4, amount")
    .eq("contract_id", id)
    .eq("status", "completed")
    .not("intuit_charge_id", "is", null)
    .order("created_at", { ascending: true });

  const firstCcPayment = ccPayments?.[0] ?? null;
  let refundMethod = "manual";

  // If a card payment exists, process the actual refund through Intuit Payments
  if (firstCcPayment?.intuit_charge_id) {
    try {
      await refundCharge(firstCcPayment.intuit_charge_id, amount);
      refundMethod = "card_auto";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return NextResponse.json({ error: `Intuit refund failed: ${msg}` }, { status: 502 });
    }
  }

  const refundNotes = refundMethod === "card_auto"
    ? `Refunded to ${firstCcPayment!.card_brand} ····${firstCcPayment!.card_last4} via Intuit Payments${notes ? ` — ${notes}` : ""}`
    : notes || null;

  const { error: dbError } = await supabase
    .from("contracts")
    .update({
      tax_refund_amount: amount,
      tax_refund_issued_at: new Date().toISOString(),
      tax_refund_notes: refundNotes,
      tax_refund_issued_by: user.id,
      tax_refund_reason: reason,
    })
    .eq("id", id);

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

  // Audit-log enrichment: capture the original rate decision chain alongside
  // the refund event. State auditors asking "why did Atlas refund this tax?"
  // can pull this single log row and see:
  //   - refund event: amount, method, reason
  //   - original rate decision: source, jurisdictions, effective date, resolved at
  await logAction({
    userId: user.id,
    action: "contract.tax_refund_issued",
    entityType: "contract",
    entityId: id,
    metadata: {
      amount,
      method: refundMethod,
      reason,
      card_last4: firstCcPayment?.card_last4 ?? null,
      contract_number: contract.contract_number,
      // Original rate provenance — the chain back to the state DOR decision
      original_tax_rate: contract.tax_rate ?? null,
      original_tax_rate_source: contract.tax_rate_source ?? null,
      original_tax_rate_effective_date: contract.tax_rate_effective_date ?? null,
      original_tax_rate_jurisdictions: contract.tax_rate_jurisdictions ?? null,
      original_tax_rate_resolved_at: contract.tax_rate_resolved_at ?? null,
    },
    req,
  });

  return NextResponse.json({
    ok: true,
    amount,
    method: refundMethod,
    card_brand: firstCcPayment?.card_brand ?? null,
    card_last4: firstCcPayment?.card_last4 ?? null,
    issued_at: new Date().toISOString(),
    notes: refundNotes,
  });
}
