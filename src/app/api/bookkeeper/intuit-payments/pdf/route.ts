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
    .maybeSingle();
  if (!["admin", "manager", "bookkeeper"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const search = (searchParams.get("search") ?? "").trim().toLowerCase();
  if (!from || !to) {
    return NextResponse.json({ error: "from and to query params required (YYYY-MM-DD)" }, { status: 400 });
  }

  const fromIso = `${from}T00:00:00Z`;
  const toIso = `${to}T23:59:59Z`;

  // Pull every payment Salta has run through Intuit in the window, joined to
  // contract → show / location / line_items so we can group by show in the PDF.
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
      processed_at,
      created_at,
      card_brand,
      card_last4,
      contract:contracts (
        id,
        contract_number,
        line_items,
        customer:customers ( first_name, last_name, co_buyer_first_name, co_buyer_last_name ),
        show:shows ( name, venue_name ),
        location:locations ( name )
      )
    `)
    .gte("processed_at", fromIso)
    .lte("processed_at", toIso)
    .not("intuit_charge_id", "is", null)
    .order("processed_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  type PdfRow = {
    date: string;
    transId: string;
    cardholder: string;
    card: string;
    type: "Charge" | "Refund";
    status: string;
    contractNumber: string;
    productSummary: string;
    amount: number;
    isRefund: boolean;
    showOrLocation: string;
    venueName: string | null;
  };

  const allRows: PdfRow[] = (payments ?? []).map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const contractAny: any = p.contract;
    const contract = Array.isArray(contractAny) ? contractAny[0] : contractAny;
    const custAny = contract?.customer;
    const customer = Array.isArray(custAny) ? custAny[0] : custAny;
    const showAny = contract?.show;
    const show = Array.isArray(showAny) ? showAny[0] : showAny;
    const locAny = contract?.location;
    const location = Array.isArray(locAny) ? locAny[0] : locAny;
    const primary = customer
      ? `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim()
      : "";
    const coFirst = (customer?.co_buyer_first_name ?? "").trim();
    const coLast = (customer?.co_buyer_last_name ?? "").trim();
    const cardholder = coFirst && coLast
      ? `${primary} & ${coFirst} ${coLast}`
      : primary;
    const isRefund = p.status === "refunded";
    const amt = Number(p.amount ?? 0);
    const cardLabel =
      (p.card_brand ?? "") + (p.card_last4 ? ` ···${p.card_last4}` : "");
    // Show only the main product (line_items[0]) — add-ons and site-prep
    // are intentionally hidden so the column reads as a clean spa model name.
    const lineItems = Array.isArray(contract?.line_items) ? contract.line_items : [];
    const mainItem = lineItems[0] as { product_name?: string; quantity?: number } | undefined;
    const productSummary = mainItem?.product_name
      ? (mainItem.quantity && mainItem.quantity > 1
          ? `${mainItem.product_name} (x${mainItem.quantity})`
          : mainItem.product_name)
      : "";
    const showOrLocation = show?.name ?? location?.name ?? "Other";
    const venueName: string | null = show?.venue_name ? String(show.venue_name) : null;

    return {
      date: p.processed_at ?? p.created_at,
      transId: p.intuit_charge_id ?? p.id,
      cardholder: cardholder || "—",
      card: cardLabel || "—",
      type: isRefund ? "Refund" : "Charge",
      status: p.status,
      contractNumber: contract?.contract_number ?? "—",
      productSummary,
      amount: isRefund ? -Math.abs(amt) : amt,
      isRefund,
      showOrLocation,
      venueName,
    };
  });

  const filtered = search
    ? allRows.filter((r) =>
        r.transId.toLowerCase().includes(search) ||
        r.cardholder.toLowerCase().includes(search) ||
        r.card.toLowerCase().includes(search) ||
        r.contractNumber.toLowerCase().includes(search) ||
        r.showOrLocation.toLowerCase().includes(search)
      )
    : allRows;

  // Group rows by combined header ("Show Name - Venue Name" or fallbacks)
  function groupHeader(r: PdfRow): string {
    if (r.showOrLocation === "Other") return "Other";
    return r.venueName ? `${r.showOrLocation} - ${r.venueName}` : r.showOrLocation;
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
    .map(([showName, rows]) => ({
      showName,
      rows,
      chargesCount: rows.filter((r) => !r.isRefund).length,
      refundsCount: rows.filter((r) => r.isRefund).length,
      subtotal: rows.reduce((s, r) => s + r.amount, 0),
    }));

  const chargesCount = filtered.filter((r) => !r.isRefund).length;
  const refundsCount = filtered.filter((r) => r.isRefund).length;
  const gross = filtered.reduce((s, r) => s + r.amount, 0);

  // ── Build PDF — print-friendly: white background, dark text ──────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = 279;
  const PAGE_BOTTOM = 195;
  let y = 14;

  // Title
  doc.setTextColor(1, 15, 33);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ATLAS SPAS — INTUIT PAYMENTS BY SHOW", W / 2, y, { align: "center" });
  y += 6;

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const rangeLabel = from === to
    ? formatDate(from + "T12:00:00")
    : `${formatDate(from + "T12:00:00")} – ${formatDate(to + "T12:00:00")}`;
  doc.text(
    `Date Range: ${rangeLabel}   ·   ${chargesCount} charge${chargesCount !== 1 ? "s" : ""}   ·   ${refundsCount} refund${refundsCount !== 1 ? "s" : ""}   ·   Gross: ${formatCurrency(gross)}`,
    W / 2, y, { align: "center" }
  );
  y += 3;

  // Thin teal accent line
  doc.setDrawColor(0, 146, 156);
  doc.setLineWidth(0.6);
  doc.line(8, y, W - 8, y);
  doc.setLineWidth(0.2);
  y += 8;

  // Column layout (shared by all groups). align="right" makes the header
  // visually line up with right-aligned value cells.
  const cols: { label: string; x: number; w: number; align?: "right" }[] = [
    { label: "Date",        x: 8,   w: 22 },
    { label: "Trans ID",    x: 32,  w: 38 },
    { label: "Cardholder",  x: 72,  w: 40 },
    { label: "Product",     x: 114, w: 58 },
    { label: "Card",        x: 174, w: 24 },
    { label: "Contract #",  x: 200, w: 26 },
    { label: "Amount",      x: 228, w: 24, align: "right" },
    { label: "Status",      x: 254, w: 20 },
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
      `No Intuit transactions in this period${search ? ` matching "${search}"` : ""}.`,
      W / 2, y + 30, { align: "center" }
    );
  }

  let groupIdx = 0;
  for (const group of groups) {
    // Page-break check before rendering section header
    if (y > PAGE_BOTTOM - 30) {
      doc.addPage();
      y = 14;
    }

    // Section header band
    doc.setFillColor(232, 248, 249); // very light teal tint
    doc.rect(6, y - 5, W - 12, 10, "F");
    doc.setDrawColor(0, 146, 156);
    doc.setLineWidth(0.4);
    doc.line(6, y + 5, W - 6, y + 5);
    doc.setLineWidth(0.2);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(0, 102, 110);
    doc.text(group.showName, 9, y + 1);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(60, 60, 60);
    const summary = `${group.chargesCount} charge${group.chargesCount !== 1 ? "s" : ""}` +
      (group.refundsCount > 0 ? ` · ${group.refundsCount} refund${group.refundsCount !== 1 ? "s" : ""}` : "") +
      `   ·   Subtotal: ${formatCurrency(group.subtotal)}`;
    doc.text(summary, W - 9, y + 1, { align: "right" });

    y += 9;

    // Column header
    renderColumnHeader();

    // Rows
    let rowIdx = 0;
    for (const row of group.rows) {
      if (y > PAGE_BOTTOM) {
        doc.addPage();
        y = 14;
        // re-render section header on new page so reader knows which show
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(0, 102, 110);
        doc.text(`${group.showName} (cont.)`, 9, y);
        y += 5;
        renderColumnHeader();
      }

      if (row.isRefund) {
        doc.setFillColor(255, 240, 240);
        doc.rect(6, y - 4, W - 12, 6, "F");
      } else if (rowIdx % 2 === 0) {
        doc.setFillColor(250, 251, 252);
        doc.rect(6, y - 4, W - 12, 6, "F");
      }

      doc.setTextColor(row.isRefund ? 180 : 30, 30, 30);

      const amountLabel = row.isRefund
        ? `(${formatCurrency(Math.abs(row.amount))})`
        : formatCurrency(row.amount);

      doc.text(formatDate(row.date), cols[0].x, y);
      doc.text(truncate(doc, row.transId, cols[1].w - 2), cols[1].x, y);
      doc.text(truncate(doc, row.cardholder, cols[2].w - 2), cols[2].x, y);
      doc.text(truncate(doc, row.productSummary || "—", cols[3].w - 2), cols[3].x, y);
      doc.text(truncate(doc, row.card, cols[4].w - 2), cols[4].x, y);
      doc.text(truncate(doc, row.contractNumber, cols[5].w - 2), cols[5].x, y);
      doc.setFont("helvetica", "bold");
      doc.text(amountLabel, cols[6].x + cols[6].w, y, { align: "right" });
      doc.setFont("helvetica", "normal");
      doc.text(truncate(doc, row.status, cols[7].w - 2), cols[7].x, y);

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
    doc.text(`${group.showName} Subtotal — ${group.rows.length} transaction${group.rows.length !== 1 ? "s" : ""}`, cols[0].x, y);
    doc.text(formatCurrency(group.subtotal), cols[6].x + cols[6].w, y, { align: "right" });
    doc.setTextColor(30, 30, 30);
    y += 8;

    groupIdx++;
  }

  // ── Grand total ──
  if (groups.length > 0) {
    if (y > PAGE_BOTTOM - 10) {
      doc.addPage();
      y = 14;
    }
    doc.setDrawColor(1, 15, 33);
    doc.setLineWidth(0.5);
    doc.line(6, y, W - 6, y);
    doc.setLineWidth(0.2);
    y += 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(1, 15, 33);
    doc.text(`GRAND TOTAL — ${filtered.length} transaction${filtered.length !== 1 ? "s" : ""} across ${groups.length} show${groups.length !== 1 ? "s" : ""}`, cols[0].x, y);
    doc.text(formatCurrency(gross), cols[6].x + cols[6].w, y, { align: "right" });
  }

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Generated ${new Date().toLocaleString("en-US")} · Atlas Spas & Swim Spas`,
    W / 2, 205, { align: "center" }
  );

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `intuit-payments-by-show-${from}${to !== from ? `-to-${to}` : ""}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
