import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/utils";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract } = await supabase
    .from("contracts")
    .select("*, customer:customers(*), location:locations(*), show:shows(name, venue_name), sales_rep:profiles(full_name)")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isQuote = contract.status === "quote";
  const docTitle = isQuote ? "QUOTE" : "SALES AGREEMENT";

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = 216; // letter width in mm
  let y = 0;

  // ─── Header bar ───────────────────────────────────────────────────────────
  doc.setFillColor(1, 15, 33); // #010F21
  doc.rect(0, 0, W, 30, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ATLAS SPAS", 14, 13);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("& Swim Spas", 14, 20);

  // Doc type right side
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(docTitle, W - 14, 13, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(contract.contract_number, W - 14, 20, { align: "right" });
  doc.text(formatDate(contract.created_at), W - 14, 26, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y = 38;

  // ─── Customer + Location side by side ────────────────────────────────────
  const c = contract.customer ?? {};
  const midX = W / 2 + 2;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("CUSTOMER", 14, y);
  doc.text("SHOW / LOCATION", midX, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  const customerLines = [
    `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim(),
    c.email ?? "",
    c.phone ?? "",
    c.address ? `${c.address}` : "",
    c.city ? `${c.city}, ${c.state} ${c.zip}` : "",
  ].filter(Boolean);

  const locationLines = [
    contract.show?.name ?? contract.location?.name ?? "",
    contract.show?.venue_name ?? "",
    contract.sales_rep?.full_name ? `Rep: ${contract.sales_rep.full_name}` : "",
  ].filter(Boolean);

  const maxRows = Math.max(customerLines.length, locationLines.length);
  for (let i = 0; i < maxRows; i++) {
    const lSize = i === 0 ? 10 : 9;
    const lBold = i === 0 ? "bold" : "normal";
    doc.setFontSize(lSize);
    doc.setFont("helvetica", lBold);
    if (customerLines[i]) doc.text(customerLines[i], 14, y);
    if (locationLines[i]) doc.text(locationLines[i], midX, y);
    y += i === 0 ? 5.5 : 5;
  }
  y += 3;

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(0, 146, 156); // teal
  doc.setLineWidth(0.5);
  doc.line(14, y, W - 14, y);
  y += 6;

  // ─── Products table ───────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text("PRODUCT", 14, y);
  doc.text("SERIAL #", 120, y);
  doc.text("PRICE", W - 14, y, { align: "right" });
  y += 1;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, y + 1, W - 14, y + 1);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);

  const lineItems = Array.isArray(contract.line_items) ? contract.line_items : [];
  for (const item of lineItems) {
    if (y > 220) { doc.addPage(); y = 20; }
    const name = String(item.product_name ?? "");
    // Truncate long names
    const displayName = name.length > 55 ? name.substring(0, 52) + "…" : name;
    doc.text(displayName, 14, y);
    doc.text(String(item.serial_number ?? ""), 120, y);
    if (item.waived) {
      doc.setTextColor(0, 150, 80);
      doc.text("FREE", W - 14, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
    } else {
      doc.text(formatCurrency(item.sell_price * (item.quantity ?? 1)), W - 14, y, { align: "right" });
    }
    y += 6;
  }

  // Discounts
  const discounts = Array.isArray(contract.discounts) ? contract.discounts : [];
  if (discounts.length > 0) {
    y += 2;
    doc.setFontSize(9);
    for (const d of discounts) {
      doc.setTextColor(180, 0, 0);
      doc.text(String(d.label ?? "Discount"), 14, y);
      doc.text(`−${formatCurrency(d.amount)}`, W - 14, y, { align: "right" });
      doc.setTextColor(0, 0, 0);
      y += 5;
    }
  }
  y += 4;

  // ─── Financial summary ────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(W / 2 - 5, y, W - 14, y);
  y += 5;

  const col1 = W / 2 - 5;
  function row(label: string, value: string, bold = false, color?: [number, number, number]) {
    if (y > 245) { doc.addPage(); y = 20; }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(bold ? 10 : 9);
    if (color) doc.setTextColor(...color);
    doc.text(label, col1, y);
    doc.text(value, W - 14, y, { align: "right" });
    if (color) doc.setTextColor(0, 0, 0);
    y += bold ? 6.5 : 5.5;
  }

  row("Sub Total", formatCurrency(contract.subtotal));
  if (contract.discount_total > 0) row("Discounts", `−${formatCurrency(contract.discount_total)}`, false, [180, 0, 0]);
  row(`Tax (${((contract.tax_rate ?? 0) * 100).toFixed(2)}%)`, formatCurrency(contract.tax_amount));
  if (contract.surcharge_amount > 0) row("CC Surcharge", formatCurrency(contract.surcharge_amount));

  // Total divider
  doc.setDrawColor(1, 15, 33);
  doc.setLineWidth(0.5);
  doc.line(col1, y - 2, W - 14, y - 2);

  row("TOTAL", formatCurrency(contract.total), true);

  // Financing breakdown
  const financing = Array.isArray(contract.financing) ? contract.financing : [];
  for (const f of financing) {
    const isFoundation = f.deduct_from_balance === false;
    const label = isFoundation
      ? `${f.financer_name ?? "Foundation"} (carries to balance)`
      : `${f.financer_name ?? "Financing"} (financed at sale)`;
    row(label, isFoundation ? formatCurrency(f.financed_amount) : `−${formatCurrency(f.financed_amount)}`, false, isFoundation ? [180, 120, 0] : [0, 100, 120]);
  }

  // Down payment
  if (contract.deposit_paid > 0) {
    row("Down Payment Received", `−${formatCurrency(contract.deposit_paid)}`);
  } else if (contract.deposit_amount > 0 && isQuote) {
    row("Estimated Down Payment", `−${formatCurrency(contract.deposit_amount)}`, false, [100, 100, 100]);
  }

  // Balance due
  doc.setDrawColor(180, 100, 0);
  doc.setLineWidth(0.3);
  doc.line(col1, y - 2, W - 14, y - 2);
  row("Balance Due at Delivery", formatCurrency(contract.balance_due), true, [160, 90, 0]);

  y += 4;

  // ─── Payment method ───────────────────────────────────────────────────────
  if (!isQuote) {
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, y, W - 14, y);
    y += 6;

    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("PAYMENT", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);

    const methodLabel = contract.payment_method
      ? contract.payment_method.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
      : "Not specified";
    doc.text(`Method: ${methodLabel}`, 14, y);
    y += 10;
  }

  // ─── Special Instructions / External Notes ───────────────────────────────
  // External notes only — internal `notes` are staff-only and never printed.
  const externalNotes = (contract.external_notes ?? "").toString().trim();
  if (externalNotes.length > 0) {
    if (y > 240) { doc.addPage(); y = 20; }
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(14, y, W - 14, y);
    y += 6;
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text("SPECIAL INSTRUCTIONS / NOTES", 14, y);
    y += 5;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    const noteLines = doc.splitTextToSize(externalNotes, W - 28);
    for (const line of noteLines) {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.text(line, 14, y);
      y += 4.5;
    }
    y += 4;
  }

  // ─── Signature ────────────────────────────────────────────────────────────
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(14, y, W - 14, y);
  y += 6;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 100, 100);
  doc.text(isQuote ? "ACKNOWLEDGEMENT" : "SIGNATURE", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(0, 0, 0);

  if (!isQuote && contract.signed_at) {
    doc.text(`Signed: ${c.first_name} ${c.last_name}   Date: ${formatDate(contract.signed_at)}`, 14, y);
  } else {
    // Signature lines for paper printing
    doc.text("Buyer:", 14, y + 5);
    doc.line(30, y + 5, 120, y + 5);
    doc.text("Date:", 130, y + 5);
    doc.line(142, y + 5, W - 14, y + 5);
    y += 14;
    doc.text("Seller:", 14, y);
    doc.line(32, y, 120, y);
    doc.text("Date:", 130, y);
    doc.line(142, y, W - 14, y);
    y += 14;
  }

  // ─── Terms snippet ────────────────────────────────────────────────────────
  y += 4;
  doc.setFontSize(7);
  doc.setTextColor(130, 130, 130);
  const terms = isQuote
    ? "This quote is valid for 30 days. Prices subject to change. No refunds after 30 days."
    : "All sales are final. No refunds. Balance is due at time of delivery. Please make checks payable to Atlas Spas & Swim Spas.";
  const termLines = doc.splitTextToSize(terms, W - 28);
  doc.text(termLines, 14, y);

  // ─── Footer ───────────────────────────────────────────────────────────────
  const pageCount = (doc.internal as any).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Atlas Spas & Swim Spas · www.atlasspas.com · ${docTitle} ${contract.contract_number} · Generated ${formatDate(new Date().toISOString())}`,
      W / 2,
      277,
      { align: "center" }
    );
  }

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const filename = isQuote
    ? `Quote-${contract.contract_number}.pdf`
    : `Contract-${contract.contract_number}.pdf`;

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
