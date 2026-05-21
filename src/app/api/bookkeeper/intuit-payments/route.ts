import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/bookkeeper/intuit-payments?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Replaces the manual CSV-from-Intuit-merchant-center workflow. Pulls every
// payment Salta has run through Intuit (we created the charges via the
// Intuit Payments API, so our `payments` table is the authoritative record
// of every transaction the merchant center would show), joined to contracts
// + customers for the human-readable detail.
//
// Returns the same row shape the legacy CSV parser produces
// (`IntuitTransaction`), so existing reconciliation logic stays compatible.
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const from = url.searchParams.get("from");
  const to = url.searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params required (YYYY-MM-DD)" }, { status: 400 });
  }

  // Inclusive end-of-day for the to bound.
  const fromIso = `${from}T00:00:00Z`;
  const toIso = `${to}T23:59:59Z`;

  const { data: payments, error } = await supabase
    .from("payments")
    .select(`
      id,
      contract_id,
      amount,
      surcharge_amount,
      method,
      status,
      intuit_charge_id,
      receipt_url,
      processed_at,
      created_at,
      card_brand,
      card_last4,
      contract:contracts (
        id,
        contract_number,
        customer:customers ( first_name, last_name, co_buyer_first_name, co_buyer_last_name )
      )
    `)
    .gte("processed_at", fromIso)
    .lte("processed_at", toIso)
    .not("intuit_charge_id", "is", null)
    .order("processed_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Shape that matches the existing intuit-parser.ts IntuitTransaction
  // interface so downstream reconciliation code stays compatible.
  type CustomerRow = {
    first_name?: string;
    last_name?: string;
    co_buyer_first_name?: string | null;
    co_buyer_last_name?: string | null;
  };
  const transactions = (payments ?? []).map((p) => {
    const contractAny = p.contract as
      | { id?: string; contract_number?: string; customer?: CustomerRow | CustomerRow[] | null }
      | { id?: string; contract_number?: string; customer?: CustomerRow | CustomerRow[] | null }[]
      | null
      | undefined;
    const contract = Array.isArray(contractAny) ? contractAny[0] : contractAny;
    const custAny = contract?.customer;
    const customer = Array.isArray(custAny) ? custAny[0] : custAny;
    // Bookkeeper-friendly: include co-buyer when present so Lori can identify
    // contracts by either spouse's name on the reconciliation report.
    const primaryName = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "";
    const coFirst = (customer?.co_buyer_first_name ?? "").trim();
    const coLast = (customer?.co_buyer_last_name ?? "").trim();
    const cardholderName = coFirst && coLast
      ? `${primaryName} & ${coFirst} ${coLast}`
      : primaryName;

    const amt = Number(p.amount ?? 0);
    const isRefund = p.status === "refunded";
    const signedAmount = isRefund ? -Math.abs(amt) : amt;

    return {
      transId: p.intuit_charge_id ?? p.id,
      date: p.processed_at ?? p.created_at,
      cardholderName,
      cardBrand: p.card_brand ?? null,
      cardLast4: p.card_last4 ?? null,
      creditDebit: p.method === "ach" ? "Debit" : "Credit",
      type: isRefund ? "Refund" : "Charge",
      batchId: "", // not stored — would require a future Intuit batch sync
      status: p.status,
      comment: contract?.contract_number ?? "",
      amount: signedAmount,
      fee: null, // not stored per-payment; can compute via rate card later
      contractNumber: contract?.contract_number ?? null,
      contractId: contract?.id ?? null,
      isRefund,
      surchargeAmount: Number(p.surcharge_amount ?? 0),
      receiptUrl: p.receipt_url ?? null,
      paymentId: p.id,
    };
  });

  const totals = transactions.reduce(
    (acc, t) => {
      if (t.isRefund) acc.refundsCount += 1;
      else acc.chargesCount += 1;
      acc.gross += t.amount;
      acc.surcharges += t.surchargeAmount;
      return acc;
    },
    { chargesCount: 0, refundsCount: 0, gross: 0, surcharges: 0 }
  );

  return NextResponse.json({
    rows: transactions,
    totals,
    dateRange: { from, to },
    count: transactions.length,
  });
}
