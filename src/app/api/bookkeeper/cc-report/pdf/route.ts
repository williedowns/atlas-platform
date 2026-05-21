import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { jsPDF } from "jspdf";
import { formatCurrency } from "@/lib/utils";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
}

// "First Last" or "First Last & CoFirst CoLast" when both co-buyer fields set.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function formatBuyerName(customer: any): string {
  if (!customer) return "—";
  const primary = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
  const coFirst = (customer.co_buyer_first_name ?? "").trim();
  const coLast = (customer.co_buyer_last_name ?? "").trim();
  if (coFirst && coLast) return `${primary} & ${coFirst} ${coLast}`;
  return primary || "—";
}

// Bookkeeper view: only the main product (line_items[0]). Hides add-ons
// (HT Delivery / steps / cover) and auto-added site-prep so the column reads cleanly.
function mainProductLabel(lineItems: Array<{ product_name?: string; quantity?: number }>): string {
  const primary = lineItems[0];
  if (!primary?.product_name) return "—";
  return primary.quantity && primary.quantity > 1
    ? `${primary.product_name} (x${primary.quantity})`
    : primary.product_name;
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
    line_items,
    customer:customers(first_name, last_name, co_buyer_first_name, co_buyer_last_name),
    show:shows(name, venue_name),
    location:locations(name)
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function extractFields(p: any) {
    const contract = Array.isArray(p.contract) ? p.contract[0] : p.contract;
    const customer = Array.isArray(contract?.customer) ? contract.customer[0] : contract?.customer;
    const show = Array.isArray(contract?.show) ? contract.show[0] : contract?.show;
    const location = Array.isArray(contract?.location) ? contract.location[0] : contract?.location;
    const lineItems = Array.isArray(contract?.line_items) ? contract.line_items : [];
    const productSummary = mainProductLabel(lineItems);
    const salesLocation = show?.name ?? location?.name ?? "—";
    const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;
    const buyerName = formatBuyerName(customer);
    const isFullPayment = contract ? Math.abs((contract.deposit_paid ?? 0) - contract.total) < 0.01 : false;
    return { contract, customer, salesLocation, venueName, buyerName, productSummary, isFullPayment };
  }

  type PdfRow = {
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

  const rows: PdfRow[] = [];

  const METHOD_LABEL: Record<string, string> = {
    credit_card: "Credit Card",
    debit_card:  "Debit Card",
    ach:         "ACH",
    financing:   "Financing",
    cash:        "Cash",
    check:       "Check",
  };

  // Payments — !inner contract join + idempotency_key filter excludes historical XLSX-backfill
  const { data: allPayments } = await supabase
    .from("payments")
    .select(`id, amount, method, card_brand, card_last4, processed_at, created_at, status, contract:contracts!inner(${contractSelect})`)
    .not("status", "eq", "failed")
    .not("contract.idempotency_key", "is", null)
    .order("created_at", { ascending: true });

  const fromTs = `${dateFrom}T00:00:00`;
  const toTs   = `${dateTo}T23:59:59`;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (allPayments ?? []) as any[]) {
    const effectiveDate: string = p.processed_at ?? p.created_at;
    if (!effectiveDate || effectiveDate < fromTs || effectiveDate > toTs) continue;

    const { salesLocation, venueName, buyerName, productSummary, isFullPayment } = extractFields(p);
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

  // At-show financing from contracts JSONB
  const { data: financedContracts } = await supabase
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const c of (financedContracts ?? []) as any[]) {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const show = Array.isArray(c.show) ? c.show[0] : c.show;
    const location = Array.isArray(c.location) ? c.location[0] : c.location;
    const salesLocation = show?.name ?? location?.name ?? "—";
    const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;
    const lineItems = Array.isArray(c.line_items) ? c.line_items : [];
    const productSummary = mainProductLabel(lineItems);
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
        customer_name: formatBuyerName(customer),
        product_size: productSummary || "—",
        sales_location: salesLocation,
        venue_name: venueName,
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

  // Tax refunds issued within date range
  const { data: taxRefundsPdf } = await supabase
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
  for (const c of (taxRefundsPdf ?? []) as any[]) {
    const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
    const show = Array.isArray(c.show) ? c.show[0] : c.show;
    const location = Array.isArray(c.location) ? c.location[0] : c.location;
    const salesLocation = show?.name ?? location?.name ?? "—";
    const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;
    const lineItems = Array.isArray(c.line_items) ? c.line_items : [];
    const productSummary = mainProductLabel(lineItems);
    rows.push({
      date: c.tax_refund_issued_at,
      customer_name: formatBuyerName(customer),
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

  rows.sort((a, b) => a.date.localeCompare(b.date));

  // Method filter
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

  // Search filter
  const filtered = search
    ? methodFiltered.filter((r) =>
        r.customer_name.toLowerCase().includes(search) ||
        r.contract_number.toLowerCase().includes(search) ||
        r.sales_location.toLowerCase().includes(search) ||
        r.product_size.toLowerCase().includes(search) ||
        (r.method_type ?? "").toLowerCase().includes(search)
      )
    : methodFiltered;

  // Group by show header ("Show Name - Venue Name" or fallbacks)
  function groupHeader(r: PdfRow): string {
    if (r.sales_location && r.sales_location !== "—") {
      return r.venue_name ? `${r.sales_location} - ${r.venue_name}` : r.sales_location;
    }
    return "Other";
  }

  const groupMap = new Map<string, PdfRow[]>();
  for (const r of filtered) {
    const header = groupHeader(r);
    const arr = groupMap.get(header) ?? [];
    arr.push(r);
    groupMap.set(header, arr);
  }
  const groups = [...groupMap.entries()]
    .sort(([a], [b]) => {
      if (a === "Other") return 1;
      if (b === "Other") return -1;
      return a.localeCompare(b);
    })
    .map(([header, gRows]) => ({
      header,
      rows: gRows,
      chargesCount: gRows.filter((r) => !r.is_refund).length,
      refundsCount: gRows.filter((r) => r.is_refund).length,
      subtotal: gRows.reduce((s, r) => s + r.amount, 0),
    }));

  const total = filtered.reduce((sum, r) => sum + r.amount, 0);
  const grossTotal = filtered.filter((r) => !r.is_refund).reduce((s, r) => s + r.amount, 0);
  const refundsTotal = filtered.filter((r) => r.is_refund).reduce((s, r) => s + Math.abs(r.amount), 0);
  const hasRefunds = refundsTotal > 0;

  // ── Build PDF — print-friendly: white background, dark text ──────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = 279;
  const PAGE_BOTTOM = 195;
  let y = 14;

  // Title
  doc.setTextColor(1, 15, 33);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const titleSuffix = method && method !== "all" ? ` — ${METHOD_LABEL[method] ?? method.toUpperCase()} ONLY` : "";
  doc.text(`ATLAS SPAS — DEPOSIT RECONCILIATION${titleSuffix}`, W / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const rangeLabel = dateFrom === dateTo
    ? formatDate(dateFrom + "T12:00:00")
    : `${formatDate(dateFrom + "T12:00:00")} – ${formatDate(dateTo + "T12:00:00")}`;
  doc.text(
    `Date Range: ${rangeLabel}   ·   ${filtered.length} transaction${filtered.length !== 1 ? "s" : ""}   ·   ${hasRefunds ? "Net" : "Total"}: ${formatCurrency(total)}`,
    W / 2, y, { align: "center" }
  );
  y += 3;

  // Thin teal accent line under title
  doc.setDrawColor(0, 146, 156);
  doc.setLineWidth(0.6);
  doc.line(8, y, W - 8, y);
  doc.setLineWidth(0.2);
  y += 8;

  // Column layout. align="right" makes the header text right-end at col.x + col.w,
  // so it visually lines up with right-aligned value cells (e.g. Amount).
  const cols: { label: string; x: number; w: number; align?: "right" }[] = [
    { label: "Date",             x: 8,   w: 22 },
    { label: "Customer",         x: 30,  w: 42 },
    { label: "Product / Size",   x: 74,  w: 58 },
    { label: "Type",             x: 134, w: 26 },
    { label: "Method",           x: 162, w: 36 },
    { label: "Contract #",       x: 200, w: 28 },
    { label: "Amount",           x: 228, w: 24, align: "right" },
  ];

  const truncate = (d: jsPDF, str: string, maxW: number) => {
    if (d.getTextWidth(str) <= maxW) return str;
    while (str.length > 1 && d.getTextWidth(str + "…") > maxW) str = str.slice(0, -1);
    return str + "…";
  };

  const renderColumnHeader = () => {
    doc.setFillColor(240, 242, 244);
    doc.rect(6, y - 5, W - 12, 8, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(60, 60, 60);
    cols.forEach((col) => {
      if (col.align === "right") {
        doc.text(col.label, col.x + col.w, y, { align: "right" });
      } else {
        doc.text(col.label, col.x, y);
      }
    });
    y += 4;
    doc.setDrawColor(200, 200, 200);
    doc.line(6, y, W - 6, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(30, 30, 30);
  };

  // Empty-state
  if (groups.length === 0) {
    doc.setFontSize(11);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `No transactions in this period${method !== "all" ? ` for ${METHOD_LABEL[method] ?? method}` : ""}${search ? ` matching "${search}"` : ""}.`,
      W / 2, y + 30, { align: "center" }
    );
  }

  for (const group of groups) {
    if (y > PAGE_BOTTOM - 30) {
      doc.addPage();
      y = 14;
    }

    // Section header band
    doc.setFillColor(232, 248, 249);
    doc.rect(6, y - 5, W - 12, 10, "F");
    doc.setDrawColor(0, 146, 156);
    doc.setLineWidth(0.4);
    doc.line(6, y + 5, W - 6, y + 5);
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 110);
    doc.text(group.header, 9, y + 1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const summary = `${group.chargesCount} charge${group.chargesCount !== 1 ? "s" : ""}` +
      (group.refundsCount > 0 ? ` · ${group.refundsCount} refund${group.refundsCount !== 1 ? "s" : ""}` : "") +
      `   ·   Subtotal: ${formatCurrency(group.subtotal)}`;
    doc.text(summary, W - 9, y + 1, { align: "right" });

    y += 9;
    renderColumnHeader();

    let rowIdx = 0;
    for (const row of group.rows) {
      if (y > PAGE_BOTTOM) {
        doc.addPage();
        y = 14;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 102, 110);
        doc.text(`${group.header} (cont.)`, 9, y);
        y += 5;
        renderColumnHeader();
      }

      if (row.is_refund) {
        doc.setFillColor(255, 240, 240);
        doc.rect(6, y - 4, W - 12, 6, "F");
      } else if (rowIdx % 2 === 0) {
        doc.setFillColor(250, 251, 252);
        doc.rect(6, y - 4, W - 12, 6, "F");
      }

      doc.setTextColor(row.is_refund ? 180 : 30, 30, 30);

      let methodLabel = row.method_type;
      if (row.card_last4) methodLabel += ` ···${row.card_last4}`;
      else if (row.provider && (row.method_type === "Financing" || row.is_refund)) methodLabel = row.provider;

      const amountLabel = row.is_refund
        ? `(${formatCurrency(Math.abs(row.amount))})`
        : formatCurrency(row.amount);

      doc.text(formatDate(row.date), cols[0].x, y);
      doc.text(truncate(doc, row.customer_name, cols[1].w - 2), cols[1].x, y);
      doc.text(truncate(doc, row.product_size, cols[2].w - 2), cols[2].x, y);
      doc.text(truncate(doc, row.payment_type, cols[3].w - 2), cols[3].x, y);
      doc.text(truncate(doc, methodLabel, cols[4].w - 2), cols[4].x, y);
      doc.text(truncate(doc, row.contract_number, cols[5].w - 2), cols[5].x, y);
      doc.setFont("helvetica", "bold");
      doc.text(amountLabel, cols[6].x + cols[6].w, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.setTextColor(30, 30, 30);

      y += 6;
      rowIdx++;
    }

    // Group subtotal row
    y += 1;
    doc.setDrawColor(150, 150, 150);
    doc.line(6, y, W - 6, y);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0, 102, 110);
    doc.text(`${group.header} Subtotal — ${group.rows.length} transaction${group.rows.length !== 1 ? "s" : ""}`, cols[0].x, y);
    doc.text(formatCurrency(group.subtotal), cols[6].x + cols[6].w, y, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 8;
  }

  // ── Grand total ──
  if (groups.length > 0) {
    if (y > PAGE_BOTTOM - 18) {
      doc.addPage();
      y = 14;
    }
    doc.setDrawColor(1, 15, 33);
    doc.setLineWidth(0.5);
    doc.line(6, y, W - 6, y);
    doc.setLineWidth(0.2);
    y += 5;

    if (hasRefunds) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(80, 80, 80);
      const grossCount = filtered.filter((r) => !r.is_refund).length;
      doc.text(`Gross — ${grossCount} Payment${grossCount !== 1 ? "s" : ""}`, cols[0].x, y);
      doc.text(formatCurrency(grossTotal), cols[6].x + cols[6].w, y, { align: "right" });
      y += 5;
      doc.setTextColor(180, 30, 30);
      const refundCount = filtered.filter((r) => r.is_refund).length;
      doc.text(`Tax Refunds (${refundCount})`, cols[0].x, y);
      doc.text(`(${formatCurrency(refundsTotal)})`, cols[6].x + cols[6].w, y, { align: "right" });
      y += 2;
      doc.setDrawColor(180, 30, 30);
      doc.line(6, y, W - 6, y);
      y += 5;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(1, 15, 33);
    doc.text(
      `${hasRefunds ? "NET TOTAL" : `GRAND TOTAL — ${filtered.length} transaction${filtered.length !== 1 ? "s" : ""} across ${groups.length} show${groups.length !== 1 ? "s" : ""}`}`,
      cols[0].x, y
    );
    doc.text(formatCurrency(total), cols[6].x + cols[6].w, y, { align: "right" });
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${new Date().toLocaleString("en-US")} · Atlas Spas & Swim Spas`, W / 2, 205, { align: "center" });

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const methodTag = method && method !== "all" ? `-${method}` : "";
  const filename = `deposit-reconciliation${methodTag}-${dateFrom}${dateTo !== dateFrom ? `-to-${dateTo}` : ""}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
