import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractContractFields(p: any) {
  const contract = Array.isArray(p.contract) ? p.contract[0] : p.contract;
  const customer = Array.isArray(contract?.customer) ? contract.customer[0] : contract?.customer;
  const show = Array.isArray(contract?.show) ? contract.show[0] : contract?.show;
  const location = Array.isArray(contract?.location) ? contract.location[0] : contract?.location;
  const lineItems = Array.isArray(contract?.line_items) ? contract.line_items : [];
  const productSummary = lineItems
    .map((li: { product_name: string; quantity?: number }) =>
      li.quantity && li.quantity > 1 ? `${li.product_name} (x${li.quantity})` : li.product_name
    )
    .join(", ");
  const salesLocation = show?.name ?? location?.name ?? "—";
  const isFullPayment = contract
    ? Math.abs((contract.deposit_paid ?? 0) - contract.total) < 0.01
    : false;
  return { contract, customer, salesLocation, productSummary, isFullPayment };
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

  const contractSelect = `
    id, contract_number, total, deposit_paid,
    line_items, financing,
    customer:customers(first_name, last_name),
    show:shows(name),
    location:locations(name)
  `;

  // ── All payments — include every status so nothing is silently dropped ──
  const { data: allPayments, error: paymentsError } = await supabase
    .from("payments")
    .select(`id, amount, method, card_brand, card_last4, processed_at, created_at, status, contract:contracts(${contractSelect})`)
    .not("status", "eq", "failed")
    .order("created_at", { ascending: true });

  if (paymentsError) return NextResponse.json({ error: paymentsError.message }, { status: 500 });

  // ── 4. At-show financing from contracts (GreenSky/WF deduct_from_balance entries) ──
  const { data: financedContracts, error: fcError } = await supabase
    .from("contracts")
    .select(`id, contract_number, total, deposit_paid, line_items, financing, created_at,
      customer:customers(first_name, last_name),
      show:shows(name),
      location:locations(name)
    `)
    .not("financing", "is", null)
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`);

  if (fcError) return NextResponse.json({ error: fcError.message }, { status: 500 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type ReportRow = {
    payment_id: string;
    date: string;
    customer_name: string;
    product_size: string;
    sales_location: string;
    status: string;
    amount: number;
    method_type: string;
    card_type: string | null;
    card_last4: string | null;
    contract_number: string;
    provider: string | null;
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

    const { customer, salesLocation, productSummary } = extractContractFields(p);
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
      date: effectiveDate,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
      product_size: productSummary || "—",
      sales_location: salesLocation,
      status: p.status ?? "completed",
      amount: p.amount,
      method_type: METHOD_LABEL[p.method] ?? p.method ?? "Unknown",
      card_type: p.card_brand ?? null,
      card_last4: p.card_last4 ?? null,
      contract_number: contract?.contract_number ?? "—",
      provider,
    });
  }

  // Map at-show financing from contracts JSONB array (GreenSky/WF legacy entries)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (financedContracts ?? []) as any[]) {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const show = Array.isArray(c.show) ? c.show[0] : c.show;
    const location = Array.isArray(c.location) ? c.location[0] : c.location;
    const salesLocation = show?.name ?? location?.name ?? "—";
    const lineItems = Array.isArray(c.line_items) ? c.line_items : [];
    const productSummary = lineItems
      .map((li: { product_name: string; quantity?: number }) =>
        li.quantity && li.quantity > 1 ? `${li.product_name} (x${li.quantity})` : li.product_name
      )
      .join(", ");

    const financingEntries = Array.isArray(c.financing) ? c.financing : [];
    for (const f of financingEntries) {
      if (f.deduct_from_balance === false) continue; // skip Foundation Finance
      if (!f.financed_amount || f.financed_amount <= 0) continue;
      // Skip if this contract already has a financing payment row (avoid double-counting)
      const alreadyRecorded = rows.some(
        (r) => r.method_type === "Financing" && r.contract_number === c.contract_number
      );
      if (alreadyRecorded) continue;

      rows.push({
        payment_id: `fin-${c.id}-${f.financer_name ?? "unknown"}`,
        date: f.applied_at ?? c.created_at,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
        product_size: productSummary || "—",
        sales_location: salesLocation,
        status: "completed",
        amount: f.financed_amount,
        method_type: "Financing",
        card_type: null,
        card_last4: null,
        contract_number: c.contract_number ?? "—",
        provider: f.financer_name ?? null,
      });
    }
  }

  // Sort all rows by date ascending
  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Apply search filter
  const filtered = search
    ? rows.filter((r) =>
        r.customer_name.toLowerCase().includes(search) ||
        r.contract_number.toLowerCase().includes(search) ||
        r.sales_location.toLowerCase().includes(search) ||
        r.product_size.toLowerCase().includes(search) ||
        (r.method_type ?? "").toLowerCase().includes(search) ||
        (r.provider ?? "").toLowerCase().includes(search)
      )
    : rows;

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);

  return NextResponse.json({ rows: filtered, total, count: filtered.length, dateFrom, dateTo });
}
