import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { queryQBOPayments } from "@/lib/qbo/client";

// GET /api/qbo/reports/payments?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// Returns QBO Payment entities for the date range, used to join against
// Salta's own payments table on the /bookkeeper/intuit-payments page so
// the bookkeeper can confirm each Intuit charge landed in QBO accounting.
//
// Joins are done on the page: for each Salta payment, find a QBO Payment
// whose LinkedTxn includes contract's qbo_deposit_invoice_id or
// qbo_final_invoice_id.
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

  try {
    const payments = await queryQBOPayments(from, to);

    // Build a lookup by LinkedTxn TxnId (invoice id) so the page can join
    // quickly without re-scanning the array per row.
    const byInvoiceId: Record<string, { qbo_payment_id: string; total: number; txn_date: string; customer_name: string | null }[]> = {};
    for (const p of payments) {
      const customerName = p.CustomerRef?.name ?? null;
      const baseEntry = {
        qbo_payment_id: p.Id,
        total: Number(p.TotalAmt ?? 0),
        txn_date: p.TxnDate,
        customer_name: customerName,
      };
      for (const line of p.Line ?? []) {
        for (const linked of line.LinkedTxn ?? []) {
          if (linked.TxnType === "Invoice" && linked.TxnId) {
            if (!byInvoiceId[linked.TxnId]) byInvoiceId[linked.TxnId] = [];
            byInvoiceId[linked.TxnId].push(baseEntry);
          }
        }
      }
    }

    return NextResponse.json({
      payments,
      byInvoiceId,
      count: payments.length,
      dateRange: { from, to },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
