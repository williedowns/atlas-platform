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

  // Re-use the same query logic from the main route
  const { searchParams } = new URL(req.url);
  const dateFrom = searchParams.get("dateFrom") ?? new Date().toISOString().split("T")[0];
  const dateTo = searchParams.get("dateTo") ?? new Date().toISOString().split("T")[0];
  const search = (searchParams.get("search") ?? "").toLowerCase().trim();

  const { data: payments } = await supabase
    .from("payments")
    .select(`
      id, amount, method, card_brand, card_last4, processed_at, status,
      contract:contracts(
        id, contract_number, total, deposit_paid, line_items,
        customer:customers(first_name, last_name),
        show:shows(name),
        location:locations(name)
      )
    `)
    .in("method", ["credit_card", "debit_card"])
    .eq("status", "completed")
    .gte("processed_at", `${dateFrom}T00:00:00`)
    .lte("processed_at", `${dateTo}T23:59:59`)
    .order("processed_at", { ascending: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows = (payments ?? []).map((p: any) => {
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

    return {
      date: p.processed_at,
      customer_name: customer ? `${customer.first_name} ${customer.last_name}` : "—",
      product_size: productSummary || "—",
      sales_location: show?.name ?? location?.name ?? "—",
      payment_type: Math.abs((contract?.deposit_paid ?? 0) - (contract?.total ?? 0)) < 0.01 ? "Paid in Full" : "Down Payment",
      amount: p.amount,
      card_type: p.card_brand ?? (p.method === "debit_card" ? "Debit" : "Credit"),
      card_last4: p.card_last4 ?? null,
      contract_number: contract?.contract_number ?? "—",
    };
  });

  if (search) {
    rows = rows.filter((r) =>
      r.customer_name.toLowerCase().includes(search) ||
      r.contract_number.toLowerCase().includes(search) ||
      r.sales_location.toLowerCase().includes(search) ||
      r.product_size.toLowerCase().includes(search)
    );
  }

  const total = rows.reduce((sum, r) => sum + r.amount, 0);

  // ── Build PDF ─────────────────────────────────────────────────────────────
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const W = 279; // landscape letter width
  let y = 0;

  // Header bar
  doc.setFillColor(1, 15, 33);
  doc.rect(0, 0, W, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("ATLAS SPAS — CREDIT CARD REPORTING FORM", W / 2, 11, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const rangeLabel = dateFrom === dateTo
    ? formatDate(dateFrom + "T12:00:00")
    : `${formatDate(dateFrom + "T12:00:00")} – ${formatDate(dateTo + "T12:00:00")}`;
  doc.text(`Date Range: ${rangeLabel}   ·   ${rows.length} transaction${rows.length !== 1 ? "s" : ""}   ·   Total: ${formatCurrency(total)}`, W / 2, 19, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y = 32;

  // Column layout
  const cols = [
    { label: "Date of Transaction", x: 8,   w: 28 },
    { label: "Customer Name",       x: 38,  w: 40 },
    { label: "Product / Size",      x: 80,  w: 65 },
    { label: "Sales Location",      x: 147, w: 42 },
    { label: "Down Pmt / Paid Full",x: 191, w: 28 },
    { label: "Amount",              x: 221, w: 25 },
    { label: "Card Type",           x: 248, w: 28 },
  ];

  // Column headers
  doc.setFillColor(240, 242, 244);
  doc.rect(6, y - 5, W - 12, 9, "F");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(60, 60, 60);
  cols.forEach((col) => doc.text(col.label, col.x, y));
  y += 5;

  // Divider
  doc.setDrawColor(200, 200, 200);
  doc.line(6, y, W - 6, y);
  y += 4;

  // Rows
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  let rowIdx = 0;
  for (const row of rows) {
    if (y > 188) {
      doc.addPage();
      y = 14;
      // Repeat header on new page
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

    // Alternating row shading
    if (rowIdx % 2 === 0) {
      doc.setFillColor(250, 251, 252);
      doc.rect(6, y - 4, W - 12, 7, "F");
    }

    doc.setTextColor(30, 30, 30);
    const cardLabel = row.card_type
      ? (row.card_last4 ? `${row.card_type} ···${row.card_last4}` : row.card_type)
      : "—";

    const truncate = (str: string, maxW: number) => {
      if (doc.getTextWidth(str) <= maxW) return str;
      while (str.length > 1 && doc.getTextWidth(str + "…") > maxW) str = str.slice(0, -1);
      return str + "…";
    };

    doc.text(formatDate(row.date), cols[0].x, y);
    doc.text(truncate(row.customer_name, cols[1].w - 2), cols[1].x, y);
    doc.text(truncate(row.product_size, cols[2].w - 2), cols[2].x, y);
    doc.text(truncate(row.sales_location, cols[3].w - 2), cols[3].x, y);
    doc.text(row.payment_type, cols[4].x, y);
    doc.setFont("helvetica", "bold");
    doc.text(formatCurrency(row.amount), cols[5].x + cols[5].w, y, { align: "right" });
    doc.setFont("helvetica", "normal");
    doc.text(cardLabel, cols[6].x, y);

    y += 7;
    rowIdx++;
  }

  // Total row
  y += 2;
  doc.setDrawColor(1, 15, 33);
  doc.line(6, y, W - 6, y);
  y += 5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(1, 15, 33);
  doc.text(`TOTAL — ${rows.length} Transaction${rows.length !== 1 ? "s" : ""}`, cols[0].x, y);
  doc.text(formatCurrency(total), cols[5].x + cols[5].w, y, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${new Date().toLocaleString("en-US")} · Atlas Spas & Swim Spas`, W / 2, 205, { align: "center" });

  const buffer = Buffer.from(doc.output("arraybuffer"));
  const filename = `cc-report-${dateFrom}${dateTo !== dateFrom ? `-to-${dateTo}` : ""}.pdf`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
