import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
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

  // Delegate to the main route to get rows (reuse logic)
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date().toISOString().split("T")[0];
  const dateTo = searchParams.get("dateTo") ?? new Date().toISOString().split("T")[0];
  const search = searchParams.get("search") ?? "";

  const contractSelect = `
    id, contract_number, total, deposit_paid,
    line_items,
    customer:customers(first_name, last_name),
    show:shows(name),
    location:locations(name)
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractFields(p: any) {
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
    const isFullPayment = contract ? Math.abs((contract.deposit_paid ?? 0) - contract.total) < 0.01 : false;
    return { contract, customer, salesLocation, productSummary, isFullPayment };
  }

  type PdfRow = {
    date: string;
    customer_name: string;
    product_size: string;
    sales_location: string;
    payment_type: string;
    amount: number;
    method_type: string;
    card_type: string | null;
    card_last4: string | null;
    contract_number: string;
    provider: string | null;
    is_refund: boolean;
  };

  const rows: PdfRow[] = [];

  const METHOD_LABEL: Record<string, string> = {
    credit_card: "Credit Card",
    debit_card:  "Debit Card",
    ach:         "ACH",
    financing:   "Financing",
    cash:        "Cash",
    check:       "Check",
  };

  // Single query for all non-failed payments — mirror the main route exactly
  // so the PDF always matches what Lori sees on screen.
  const { data: allPayments } = await supabase
    .from("payments")
    .select(`id, amount, method, card_brand, card_last4, processed_at, created_at, status, contract:contracts(${contractSelect})`)
    .not("status", "eq", "failed")
    .order("created_at", { ascending: true });

  const fromTs = `${dateFrom}T00:00:00`;
  const toTs   = `${dateTo}T23:59:59`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (allPayments ?? []) as any[]) {
    const effectiveDate: string = p.processed_at ?? p.created_at;
    if (!effectiveDate || effectiveDate < fromTs || effectiveDate > toTs) continue;

    const { customer, salesLocation, productSummary, isFullPayment } = extractFields(p);
    const contract = Array.isArray(p.contract) ? p.contract[0] : p.contract;

    let provider: string | null = null;
    if (p.method === "financing") {
      const finEntries = Array.isArray(contract?.financing) ? contract.financing : [];
      const match = finEntries.find((f: { deduct_from_balance?: boolean; financer_name?: string }) =>
        f.deduct_from_balance !== false && f.financer_name
      );
      provider = match?.financer_name ?? null;
    }

    rows.push({
      date: effectiveDate,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
      product_size: productSummary || "—",
      sales_location: salesLocation,
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

  // At-show financing from contracts JSONB
  const { data: financedContracts } = await supabase
    .from("contracts")
    .select(`id, contract_number, total, deposit_paid, line_items, financing, created_at,
      customer:customers(first_name, last_name),
      show:shows(name),
      location:locations(name)
    `)
    .not("financing", "is", null)
    .gte("created_at", `${dateFrom}T00:00:00`)
    .lte("created_at", `${dateTo}T23:59:59`);

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
      if (f.deduct_from_balance === false) continue;
      if (!f.financed_amount || f.financed_amount <= 0) continue;
      const alreadyRecorded = rows.some(
        (r) => r.method_type === "Financing" && r.contract_number === c.contract_number
      );
      if (alreadyRecorded) continue;
      rows.push({
        date: f.applied_at ?? c.created_at,
        customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
        product_size: productSummary || "—",
        sales_location: salesLocation,
        payment_type: "Financing",
        amount: f.financed_amount,
        method_type: "Financing",
        card_type: null,
        card_last4: null,
        contract_number: c.contract_number ?? "—",
        provider: f.financer_name ?? f.provider ?? "Financing",
        is_refund: false,
      });
    }
  }

  // ── Tax refunds issued within date range ──
  const { data: taxRefundsPdf } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, tax_refund_amount, tax_refund_issued_at, tax_refund_notes,
      line_items,
      customer:customers(first_name, last_name),
      show:shows(name),
      location:locations(name)
    `)
    .not("tax_refund_amount", "is", null)
    .gte("tax_refund_issued_at", `${dateFrom}T00:00:00`)
    .lte("tax_refund_issued_at", `${dateTo}T23:59:59`);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (taxRefundsPdf ?? []) as any[]) {
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
    rows.push({
      date: c.tax_refund_issued_at,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
      product_size: productSummary || "—",
      sales_location: salesLocation,
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

  rows.sort((a, b) => a.date.localeCompare(b.date));

  const searchLower = search.toLowerCase().trim();
  const filtered = searchLower
    ? rows.filter((r) =>
        r.customer_name.toLowerCase().includes(searchLower) ||
        r.contract_number.toLowerCase().includes(searchLower) ||
        r.sales_location.toLowerCase().includes(searchLower) ||
        r.product_size.toLowerCase().includes(searchLower) ||
        (r.method_type ?? "").toLowerCase().includes(searchLower)
      )
    : rows;

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);

  // ── Build PDF ────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = 279;
  let y = 0;

  // Header bar
  doc.setFillColor(1, 15, 33);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ATLAS SPAS — DEPOSIT RECONCILIATION", W / 2, 11, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const rangeLabel = dateFrom === dateTo
    ? formatDate(dateFrom + "T12:00:00")
    : `${formatDate(dateFrom + "T12:00:00")} – ${formatDate(dateTo + "T12:00:00")}`;
  doc.text(`Date Range: ${rangeLabel}   ·   ${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}   ·   Total: ${formatCurrency(total)}`, W / 2, 19, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 32;

  // Column layout — now includes Method column instead of Card Type only
  const cols = [
    { label: "Date",             x: 8,   w: 26 },
    { label: "Customer",         x: 36,  w: 40 },
    { label: "Product / Size",   x: 78,  w: 58 },
    { label: "Location",         x: 138, w: 38 },
    { label: "Type",             x: 178, w: 26 },
    { label: "Amount",           x: 206, w: 26 },
    { label: "Method",           x: 234, w: 42 },
  ];

  // Column headers
  doc.setFillColor(240, 242, 244);
  doc.rect(6, y - 5, W - 12, 9, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  cols.forEach((col) => doc.text(col.label, col.x, y));
  y += 5;

  doc.setDrawColor(200, 200, 200);
  doc.line(6, y, W - 6, y);
  y += 4;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let rowIdx = 0;

  const truncate = (doc: jsPDF, str: string, maxW: number) => {
    if (doc.getTextWidth(str) <= maxW) return str;
    while (str.length > 1 && doc.getTextWidth(str + "…") > maxW) str = str.slice(0, -1);
    return str + "…";
  };

  for (const row of filtered) {
    if (y > 188) {
      doc.addPage();
      y = 14;
      doc.setFillColor(240, 242, 244);
      doc.rect(6, y - 5, W - 12, 9, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(60, 60, 60);
      cols.forEach((col) => doc.text(col.label, col.x, y));
      y += 5;
      doc.line(6, y, W - 6, y);
      y += 4;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
    }

    if (row.is_refund) {
      doc.setFillColor(255, 240, 240);
      doc.rect(6, y - 4, W - 12, 7, "F");
    } else if (rowIdx % 2 === 0) {
      doc.setFillColor(250, 251, 252);
      doc.rect(6, y - 4, W - 12, 7, "F");
    }

    if (row.is_refund) {
      doc.setTextColor(180, 30, 30);
    } else {
      doc.setTextColor(30, 30, 30);
    }

    let methodLabel = row.method_type;
    if (row.card_last4) methodLabel += ` ···${row.card_last4}`;
    else if (row.provider && (row.method_type === "Financing" || row.is_refund)) methodLabel = row.provider;

    const amountLabel = row.is_refund
      ? `(${formatCurrency(Math.abs(row.amount))})`
      : formatCurrency(row.amount);

    doc.text(formatDate(row.date), cols[0].x, y);
    doc.text(truncate(doc, row.customer_name, cols[1].w - 2), cols[1].x, y);
    doc.text(truncate(doc, row.product_size, cols[2].w - 2), cols[2].x, y);
    doc.text(truncate(doc, row.sales_location, cols[3].w - 2), cols[3].x, y);
    doc.text(truncate(doc, row.payment_type, cols[4].w - 2), cols[4].x, y);
    doc.setFont("helvetica", "bold");
    doc.text(amountLabel, cols[5].x + cols[5].w, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(truncate(doc, methodLabel, cols[6].w - 2), cols[6].x, y);
    doc.setTextColor(30, 30, 30);

    y += 7;
    rowIdx++;
  }

  // Total rows
  y += 2;
  doc.setDrawColor(1, 15, 33);
  doc.line(6, y, W - 6, y);
  y += 5;

  const grossTotal = filtered.filter(r => !r.is_refund).reduce((s, r) => s + r.amount, 0);
  const refundsTotal = filtered.filter(r => r.is_refund).reduce((s, r) => s + Math.abs(r.amount), 0);
  const hasRefunds = refundsTotal > 0;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(1, 15, 33);

  if (hasRefunds) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(80, 80, 80);
    doc.text(`Gross — ${filtered.filter(r => !r.is_refund).length} Payment${filtered.filter(r => !r.is_refund).length !== 1 ? "s" : ""}`, cols[0].x, y);
    doc.text(formatCurrency(grossTotal), cols[5].x + cols[5].w, y, { align: "right" });
    y += 5;
    doc.setTextColor(180, 30, 30);
    doc.text(`Tax Refunds (${filtered.filter(r => r.is_refund).length})`, cols[0].x, y);
    doc.text(`(${formatCurrency(refundsTotal)})`, cols[5].x + cols[5].w, y, { align: "right" });
    y += 2;
    doc.setDrawColor(180, 30, 30);
    doc.line(6, y, W - 6, y);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(1, 15, 33);
  }

  doc.text(`${hasRefunds ? "NET TOTAL" : `TOTAL — ${filtered.length} Transaction${filtered.length !== 1 ? "s" : ""}`}`, cols[0].x, y);
  doc.text(formatCurrency(total), cols[5].x + cols[5].w, y, { align: "right" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${new Date().toLocaleString("en-US")} · Atlas Spas & Swim Spas`, W / 2, 205, { align: "center" });

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `deposit-reconciliation-${dateFrom}${dateTo !== dateFrom ? `-to-${dateTo}` : ""}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
