import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Format buyer name as "First Last" or "First Last & CoFirst CoLast"
// when both co-buyer fields are present. Used across all bookkeeper reports.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatBuyerName(customer: any): string {
  if (!customer) return "—";
  const primary = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  const coFirst = (customer.co_buyer_first_name ?? "").trim();
  const coLast = (customer.co_buyer_last_name ?? "").trim();
  if (coFirst && coLast) return `${primary} & ${coFirst} ${coLast}`;
  return primary || "—";
}

// Bookkeeper reports show only the main product (line_items[0]) — convention
// matches lib/show-sales/contract-mapper.ts. Add-ons (HT Delivery, HT Steps,
// covers) and auto-added site-prep (linked_spa_product_id) are intentionally
// hidden so Lori can scan contracts by spa model.
function mainProductLabel(lineItems: Array<{ product_name?: string; quantity?: number }>): string {
  const primary = lineItems[0];
  if (!primary?.product_name) return "—";
  return primary.quantity && primary.quantity > 1
    ? `${primary.product_name} (x${primary.quantity})`
    : primary.product_name;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContractFields(p: any) {
  const contract = Array.isArray(p.contract) ? p.contract[0] : p.contract;
  const customer = Array.isArray(contract?.customer) ? contract.customer[0] : contract?.customer;
  const show = Array.isArray(contract?.show) ? contract.show[0] : contract?.show;
  const location = Array.isArray(contract?.location) ? contract.location[0] : contract?.location;
  const lineItems = Array.isArray(contract?.line_items) ? contract.line_items : [];
  const productSummary = mainProductLabel(lineItems);
  const salesLocation = show?.name ?? location?.name ?? "—";
  const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;
  const buyerName = formatBuyerName(customer);
  const isFullPayment = contract
    ? Math.abs((contract.deposit_paid ?? 0) - contract.total) < 0.01
    : false;
  return { contract, customer, salesLocation, venueName, buyerName, productSummary, isFullPayment };
}

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date().toISOString().split("T")[0];
  const dateTo = searchParams.get("dateTo") ?? new Date().toISOString().split("T")[0];
  const search = (searchParams.get("search") ?? "").toLowerCase().trim();
  const method = (searchParams.get("method") ?? "all").toLowerCase().trim();

  const contractSelect = `
    id, contract_number, total, deposit_paid,
    line_items, financing,
    customer:customers(first_name, last_name, co_buyer_first_name, co_buyer_last_name),
    show:shows(name, venue_name),
    location:locations(name)
  `;

  // ── All payments — include every status so nothing is silently dropped ──
  // !inner join + idempotency_key not null filter drops payments whose contract
  // is a historical XLSX backfill (those rows have NULL idempotency_key). Salta-
  // flow contracts always have idempotency_key set at insert time.
  const { data: allPayments, error: paymentsError } = await supabase
    .from("payments")
    .select(`id, amount, method, card_brand, card_last4, processed_at, created_at, status, contract:contracts!inner(${contractSelect})`)
    .not("status", "eq", "failed")
    .not("contract.idempotency_key", "is", null)
    .order("created_at", { ascending: true });

  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });

  // ── 4. At-show financing from contracts (GreenSky/WF deduct_from_balance entries) ──
  const { data: financedContracts, error: fcError } = await supabase
    .from("contracts")
    .select(`id, contract_number, total, deposit_paid, line_items, financing, created_at,
      customer:customers(first_name, last_name, co_buyer_first_name, co_buyer_last_name),
      show:shows(name, venue_name),
      location:locations(name)
    `)
    .not("financing", "is", null)
    .not("idempotency_key", "is", null)
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`);

  if (fcError) return NextResponse.json({ error: fcError.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ReportRow = {
    payment_id: string;
    contract_id: string;
    date: string;
    customer_name: string;
    product_size: string;
    sales_location: string;
    venue_name: string | null;
    payment_type: string;
    amount: number;
    method_type: string;
    card_type: string | null;
    card_last4: string | null;
    contract_number: string;
    provider: string | null;
    is_refund: boolean;
  };

  const METHOD_LABEL: Record<string, string> = {
    credit_card: "Credit Card",
    debit_card:  "Debit Card",
    ach:         "ACH",
    financing:   "Financing",
    cash:        "Cash",
    check:       "Check",
  };

  const rows: ReportRow[] = [];

  const fromTs = `${dateFrom}T00:00:00`;
  const toTs   = `${dateTo}T23:59:59`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (allPayments ?? []) as any[]) {
    // Use processed_at when set, fall back to created_at so payments with
    // null processed_at (e.g. some manual records) still appear
    const effectiveDate: string = p.processed_at ?? p.created_at;
    if (!effectiveDate || effectiveDate < fromTs || effectiveDate > toTs) continue;

    const { salesLocation, venueName, buyerName, productSummary, isFullPayment } = extractContractFields(p);
    const contract = Array.isArray(p.contract) ? p.contract[0] : p.contract;

    // For financing payments, pull provider from contract's financing JSONB array
    let provider: string | null = null;
    if (p.method === "financing") {
      const finEntries = Array.isArray(contract?.financing) ? contract.financing : [];
      const match = finEntries.find((f: { deduct_from_balance?: boolean; financer_name?: string }) =>
        f.deduct_from_balance !== false && f.financer_name
      );
      provider = match?.financer_name ?? null;
    }

    rows.push({
      payment_id: p.id,
      contract_id: contract?.id ?? "",
      date: effectiveDate,
      customer_name: buyerName,
      product_size: productSummary || "—",
      sales_location: salesLocation,
      venue_name: venueName,
      payment_type: isFullPayment ? "Paid in Full" : "Down Payment",
      amount: p.amount,
      method_type: METHOD_LABEL[p.method] ?? p.method ?? "Unknown",
      card_type: p.card_brand ?? null,
      card_last4: p.card_last4 ?? null,
      contract_number: contract?.contract_number ?? "—",
      provider,
      is_refund: false,
    });
  }

  // Map at-show financing from contracts JSONB array (GreenSky/WF legacy entries)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (financedContracts ?? []) as any[]) {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const show = Array.isArray(c.show) ? c.show[0] : c.show;
    const location = Array.isArray(c.location) ? c.location[0] : c.location;
    const salesLocation = show?.name ?? location?.name ?? "—";
    const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;
    const buyerName = formatBuyerName(customer);
    const lineItems = Array.isArray(c.line_items) ? c.line_items : [];
    const productSummary = mainProductLabel(lineItems);

    const financingEntries = Array.isArray(c.financing) ? c.financing : [];
    for (const f of financingEntries) {
      if (f.deduct_from_balance === false) continue; // skip Foundation Finance
      if (!f.financed_amount || f.financed_amount <= 0) continue;
      // Dedup against payments-table financing rows for the SAME financer only.
      // Split-financed contracts (e.g. Wells Fargo + GreenSky) need every financer
      // to land on the report — keying on contract_number alone dropped index 1+.
      const alreadyRecorded = rows.some(
        (r) => r.method_type === "Financing"
            && r.contract_number === c.contract_number
            && r.provider === f.financer_name
      );
      if (alreadyRecorded) continue;

      rows.push({
        payment_id: `fin-${c.id}-${f.financer_name ?? "unknown"}`,
        contract_id: c.id,
        date: f.applied_at ?? c.created_at,
        customer_name: buyerName,
        product_size: productSummary || "—",
        sales_location: salesLocation,
        venue_name: venueName,
        payment_type: "Financing",
        amount: f.financed_amount,
        method_type: "Financing",
        card_type: null,
        card_last4: null,
        contract_number: c.contract_number ?? "—",
        provider: f.financer_name ?? null,
        is_refund: false,
      });
    }
  }

  // ── Tax refunds issued within date range ──
  const { data: taxRefunds } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, tax_refund_amount, tax_refund_issued_at, tax_refund_notes,
      line_items,
      customer:customers(first_name, last_name, co_buyer_first_name, co_buyer_last_name),
      show:shows(name, venue_name),
      location:locations(name)
    `)
    .not("tax_refund_amount", "is", null)
    .not("idempotency_key", "is", null)
    .gte("tax_refund_issued_at", `${dateFrom}T00:00:00`)
    .lte("tax_refund_issued_at", `${dateTo}T23:59:59`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (taxRefunds ?? []) as any[]) {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const show = Array.isArray(c.show) ? c.show[0] : c.show;
    const location = Array.isArray(c.location) ? c.location[0] : c.location;
    const salesLocation = show?.name ?? location?.name ?? "—";
    const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;
    const buyerName = formatBuyerName(customer);
    const lineItems = Array.isArray(c.line_items) ? c.line_items : [];
    const productSummary = mainProductLabel(lineItems);
    rows.push({
      payment_id: `refund-${c.id}`,
      contract_id: c.id,
      date: c.tax_refund_issued_at,
      customer_name: buyerName,
      product_size: productSummary || "—",
      sales_location: salesLocation,
      venue_name: venueName,
      payment_type: "Tax Refund",
      amount: -(c.tax_refund_amount as number),
      method_type: "Tax Refund",
      card_type: null,
      card_last4: null,
      contract_number: c.contract_number ?? "—",
      provider: c.tax_refund_notes ?? null,
      is_refund: true,
    });
  }

  // Sort all rows by date ascending
  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Apply method filter (Lori wants per-payment-type reports)
  // method query: "all" (default) or one of credit_card | debit_card | ach | financing | cash | check
  const METHOD_LABEL_TO_KEY: Record<string, string> = {
    "Credit Card": "credit_card",
    "Debit Card":  "debit_card",
    "ACH":         "ach",
    "Financing":   "financing",
    "Cash":        "cash",
    "Check":       "check",
  };
  const methodFiltered = method && method !== "all"
    ? rows.filter((r) => (METHOD_LABEL_TO_KEY[r.method_type] ?? r.method_type.toLowerCase()) === method)
    : rows;

  // Apply search filter
  const filtered = search
    ? methodFiltered.filter((r) =>
        r.customer_name.toLowerCase().includes(search) ||
        r.contract_number.toLowerCase().includes(search) ||
        r.sales_location.toLowerCase().includes(search) ||
        r.product_size.toLowerCase().includes(search) ||
        (r.method_type ?? "").toLowerCase().includes(search) ||
        (r.provider ?? "").toLowerCase().includes(search) ||
        r.amount.toFixed(2).includes(search) ||
        r.amount.toString().includes(search)
      )
    : methodFiltered;

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);

  return NextResponse.json({ rows: filtered, total, count: filtered.length, dateFrom, dateTo });
}
