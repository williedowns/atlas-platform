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

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = 210;
  let y = 0;

  // ─── Header bar ───────────────────────────────────────────────────────────
  doc.setFillColor(0, 59, 113);
  doc.rect(0, 0, W, 28, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("ATLAS SPAS", 14, 12);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Sales Contract", 14, 20);

  // Contract number + date right-aligned
  doc.setFontSize(10);
  doc.text(contract.contract_number, W - 14, 12, { align: "right" });
  doc.text(formatDate(contract.created_at), W - 14, 20, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y = 36;

  // ─── Customer + Location ──────────────────────────────────────────────────
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("CUSTOMER", 14, y);
  doc.text("LOCATION / SHOW", W / 2 + 4, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  const c = contract.customer;
  doc.text(`${c.first_name} ${c.last_name}`, 14, y);
  doc.text(contract.show?.name ?? contract.location?.name ?? "", W / 2 + 4, y);
  y += 5;
  doc.text(c.email, 14, y);
  if (contract.show?.venue_name) doc.text(contract.show.venue_name, W / 2 + 4, y);
  y += 5;
  doc.text(c.phone, 14, y);
  y += 5;
  if (c.address) doc.text(`${c.address}, ${c.city}, ${c.state} ${c.zip}`, 14, y);
  y += 8;

  // ─── Divider ──────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, W - 14, y);
  y += 6;

  // ─── Line items ───────────────────────────────────────────────────────────
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PRODUCT", 14, y);
  doc.text("SERIAL #", 100, y);
  doc.text("PRICE", W - 14, y, { align: "right" });
  y += 5;
  doc.setFont("helvetica", "normal");

  const lineItems = Array.isArray(contract.line_items) ? contract.line_items : [];
  for (const item of lineItems) {
    doc.text(String(item.product_name ?? ""), 14, y);
    doc.text(String(item.serial_number ?? "—"), 100, y);
    doc.text(formatCurrency(item.sell_price * item.quantity), W - 14, y, { align: "right" });
    y += 6;
  }

  // Discounts
  const discounts = Array.isArray(contract.discounts) ? contract.discounts : [];
  for (const d of discounts) {
    doc.setTextColor(0, 120, 60);
    doc.text(String(d.label ?? "Discount"), 14, y);
    doc.text(`−${formatCurrency(d.amount)}`, W - 14, y, { align: "right" });
    doc.setTextColor(0, 0, 0);
    y += 6;
  }
  y += 4;

  // ─── Financial summary ────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(W / 2, y, W - 14, y);
  y += 5;

  function row(label: string, amount: number, bold = false) {
    if (bold) doc.setFont("helvetica", "bold");
    else doc.setFont("helvetica", "normal");
    doc.text(label, W / 2, y);
    doc.text(formatCurrency(amount), W - 14, y, { align: "right" });
    y += 6;
  }

  row("Subtotal", contract.subtotal);
  if (contract.discount_total > 0) row("Discounts", -contract.discount_total);
  row(`Tax (${((contract.tax_rate ?? 0) * 100).toFixed(2)}%)`, contract.tax_amount);
  if (contract.surcharge_amount > 0) row("CC Surcharge", contract.surcharge_amount);
  doc.setFont("helvetica", "bold");
  doc.setDrawColor(0, 59, 113);
  doc.line(W / 2, y - 2, W - 14, y - 2);
  row("TOTAL", contract.total, true);
  doc.setFont("helvetica", "normal");
  row("Deposit Paid", -contract.deposit_paid);
  doc.setTextColor(180, 100, 0);
  row("Balance Due at Delivery", contract.balance_due, true);
  doc.setTextColor(0, 0, 0);
  y += 6;

  // ─── Signature ────────────────────────────────────────────────────────────
  doc.setDrawColor(200, 200, 200);
  doc.line(14, y, W - 14, y);
  y += 6;
  doc.setFont("helvetica", "bold");
  doc.text("SIGNATURE", 14, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  if (contract.signed_at) {
    doc.text(
      `Signed by: ${c.first_name} ${c.last_name} on ${formatDate(contract.signed_at)}`,
      14,
      y
    );
  } else {
    doc.text("Awaiting signature", 14, y);
  }
  y += 5;

  // ─── Footer ───────────────────────────────────────────────────────────────
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(
    `Atlas Spas · This is your official purchase contract · Generated ${formatDate(new Date().toISOString())}`,
    W / 2,
    285,
    { align: "center" }
  );

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new Response(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Contract-${contract.contract_number}.pdf"`,
    },
  });
}
