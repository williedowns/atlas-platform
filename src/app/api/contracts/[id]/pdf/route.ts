import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TERMS_AND_CONDITIONS,
  REQUIRED_ACKNOWLEDGMENTS,
  type AcknowledgmentsRecord,
} from "@/lib/contract-terms";
import fs from "node:fs/promises";
import path from "node:path";

// Cached logo bytes (read once per cold start)
let LOGO_DATA_URL: string | null = null;
async function getLogoDataUrl(): Promise<string | null> {
  if (LOGO_DATA_URL) return LOGO_DATA_URL;
  try {
    const buf = await fs.readFile(path.join(process.cwd(), "public", "logo.png"));
    LOGO_DATA_URL = `data:image/png;base64,${buf.toString("base64")}`;
    return LOGO_DATA_URL;
  } catch {
    return null;
  }
}

// Brand palette
const NAVY: [number, number, number] = [1, 15, 33];           // #010F21 — header band
const TEAL: [number, number, number] = [0, 146, 156];         // #00929C — accent
const SLATE_900: [number, number, number] = [15, 23, 42];     // body
const SLATE_500: [number, number, number] = [100, 116, 139];  // muted
const SLATE_300: [number, number, number] = [203, 213, 225];  // dividers
const SLATE_50: [number, number, number] = [248, 250, 252];   // backgrounds
const RED: [number, number, number] = [180, 35, 24];          // discounts
const AMBER: [number, number, number] = [180, 100, 0];        // balance-due
const EMERALD: [number, number, number] = [5, 122, 85];       // paid

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
    .select("*, customer:customers(*), location:locations(*), show:shows(name, venue_name), sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)")
    .eq("id", id)
    .single();

  if (!contract) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Completed CC charges — surfaced under "Deposit Paid" so the printed
  // agreement shows which card was actually run (e.g. "Visa ····4242").
  const { data: ccPaymentsData } = await supabase
    .from("payments")
    .select("amount, card_brand, card_last4")
    .eq("contract_id", id)
    .eq("status", "completed")
    .not("card_last4", "is", null)
    .order("created_at");
  const ccPayments: Array<{ amount: number; card_brand: string | null; card_last4: string | null }> = ccPaymentsData ?? [];

  const isQuote = contract.status === "quote";
  const docTitle = isQuote ? "QUOTE" : "SALES AGREEMENT";
  const logoDataUrl = await getLogoDataUrl();

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = 216; // letter width in mm
  const H = 279; // letter height in mm
  const M = 16;  // outer margin
  let y = 0;

  // ─── Header (printer-friendly) ───────────────────────────────────────────
  // Plain white background with the logo on the left and doc metadata on
  // the right, separated from the body by a single thin teal accent line.
  // The previous design used a full-bleed navy fill — pretty on screen but
  // burned through ink on every print.
  const headerH = 30;

  // Logo (PNG) — left side
  if (logoDataUrl) {
    // Logo is 480x187 → preserve aspect at ~22mm tall, ~56mm wide
    try { doc.addImage(logoDataUrl, "PNG", M, 5, 56, 22); } catch {/* fallback below */}
  }
  // Fallback wordmark if logo embed failed
  if (!logoDataUrl) {
    doc.setTextColor(...NAVY);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("ATLAS SPAS", M, 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...SLATE_500);
    doc.text("& Swim Spas", M, 23);
  }

  // Doc title + meta on right — dark text on white
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(docTitle, W - M, 14, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...SLATE_500);
  doc.text(contract.contract_number, W - M, 20, { align: "right" });
  doc.text(formatDate(contract.created_at), W - M, 25, { align: "right" });

  // Single thin teal divider — preserves the brand cue without ink-heavy fills
  doc.setDrawColor(...TEAL);
  doc.setLineWidth(0.6);
  doc.line(M, headerH, W - M, headerH);

  y = headerH + 10;

  // ─── Customer + Show metadata (two columns) ──────────────────────────────
  const c = contract.customer ?? {};
  const colW = (W - M * 2 - 6) / 2;
  const leftX = M;
  const rightX = M + colW + 6;

  function sectionLabel(label: string, x: number, atY: number) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_500);
    doc.text(label, x, atY);
  }
  function bodyLine(text: string, x: number, atY: number, opts?: { bold?: boolean; size?: number; color?: [number, number, number] }) {
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? SLATE_900));
    doc.text(text, x, atY);
  }

  sectionLabel("BILL TO", leftX, y);
  sectionLabel("LOCATION", rightX, y);
  y += 5;

  // Customer block
  const primaryName = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim();
  const coBuyerName = `${c.co_buyer_first_name ?? ""} ${c.co_buyer_last_name ?? ""}`.trim();
  const buyerHeader = coBuyerName ? `${primaryName} & ${coBuyerName}` : primaryName;
  const phones = [c.phone, c.secondary_phone].filter((p) => p && String(p).trim()).join(" · ");
  const customerLines = [
    [buyerHeader, { bold: true, size: 11 }],
    [c.email ?? "", { size: 9, color: SLATE_500 }],
    [phones, { size: 9, color: SLATE_500 }],
    [c.address ?? "", { size: 9, color: SLATE_500 }],
    [c.city ? `${c.city}, ${c.state ?? ""} ${c.zip ?? ""}`.trim() : "", { size: 9, color: SLATE_500 }],
  ].filter(([t]) => t) as Array<[string, { bold?: boolean; size?: number; color?: [number, number, number] }]>;

  // Location/Show block
  const showName = contract.show?.name ?? contract.location?.name ?? "";
  const venue = contract.show?.venue_name ?? "";
  const repName = contract.sales_rep?.full_name ?? "";
  const locationLines: Array<[string, { bold?: boolean; size?: number; color?: [number, number, number] }]> = [
    [showName, { bold: true, size: 11 }],
    ...(venue ? [[venue, { size: 9, color: SLATE_500 }] as [string, { size?: number; color?: [number, number, number] }]] : []),
    ...(repName ? [[`Sales Rep: ${repName}`, { size: 9, color: SLATE_500 }] as [string, { size?: number; color?: [number, number, number] }]] : []),
  ];

  const maxLines = Math.max(customerLines.length, locationLines.length);
  let blockY = y;
  for (let i = 0; i < maxLines; i++) {
    const lh = i === 0 ? 5.5 : 4.8;
    if (customerLines[i]) bodyLine(customerLines[i][0], leftX, blockY, customerLines[i][1]);
    if (locationLines[i]) bodyLine(locationLines[i][0], rightX, blockY, locationLines[i][1]);
    blockY += lh;
  }
  y = blockY + 4;

  // Divider
  doc.setDrawColor(...SLATE_300);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 7;

  // ─── Line items table ────────────────────────────────────────────────────
  // Clean table: shaded header band, item rows with proper padding.
  // Columns: Product (flex) | Serial # | Qty | Price (right)
  const colProduct = M;
  const colSerial = W - M - 60;
  const colQty = W - M - 30;
  const colPrice = W - M;

  // Header
  doc.setFillColor(...SLATE_50);
  doc.rect(M, y - 4, W - M * 2, 7, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(...SLATE_500);
  doc.text("PRODUCT", colProduct + 1, y + 0.5);
  doc.text("SERIAL #", colSerial, y + 0.5);
  doc.text("QTY", colQty, y + 0.5, { align: "center" });
  doc.text("PRICE", colPrice - 1, y + 0.5, { align: "right" });
  y += 7;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_900);

  const lineItems = Array.isArray(contract.line_items) ? contract.line_items : [];
  let altRow = false;
  for (const item of lineItems) {
    if (y > 240) {
      doc.addPage();
      y = M;
    }
    if (altRow) {
      doc.setFillColor(252, 252, 253);
      doc.rect(M, y - 4, W - M * 2, 6.5, "F");
    }
    altRow = !altRow;

    const name = String(item.product_name ?? "");
    const qty = item.quantity ?? 1;
    const lineTotal = (item.sell_price ?? 0) * qty;
    const displayName = name.length > 50 ? name.substring(0, 47) + "…" : name;

    doc.setTextColor(...SLATE_900);
    doc.setFont("helvetica", "normal");
    doc.text(displayName, colProduct + 1, y);
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    doc.text(String(item.serial_number ?? ""), colSerial, y);
    doc.text(String(qty), colQty, y, { align: "center" });

    if (item.waived) {
      doc.setTextColor(...EMERALD);
      doc.setFont("helvetica", "bold");
      doc.text("FREE", colPrice - 1, y, { align: "right" });
    } else {
      doc.setTextColor(...SLATE_900);
      doc.setFont("helvetica", "normal");
      doc.text(formatCurrency(lineTotal), colPrice - 1, y, { align: "right" });
    }
    doc.setFontSize(10);
    y += 6.5;
  }

  // Bottom rule
  doc.setDrawColor(...SLATE_300);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 7;

  // ─── Totals card (right-aligned) ────────────────────────────────────────
  // Discounts go HERE (not in the line-item table) to avoid duplication.
  const discounts = Array.isArray(contract.discounts) ? contract.discounts : [];
  const discountTotal = Number(contract.discount_total ?? 0);
  const totalsLeft = W / 2 + 10;
  const totalsRight = W - M;

  function totalsRow(label: string, value: string, opts?: { bold?: boolean; color?: [number, number, number]; size?: number }) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFont("helvetica", opts?.bold ? "bold" : "normal");
    doc.setFontSize(opts?.size ?? 10);
    doc.setTextColor(...(opts?.color ?? SLATE_900));
    doc.text(label, totalsLeft, y);
    doc.text(value, totalsRight, y, { align: "right" });
    y += opts?.bold ? 7 : 5.5;
  }

  // Subtotal here is the items-only subtotal — pull the doc fee back out of
  // the saved subtotal so the PDF reads the way the old paper Sales
  // Agreement did (Sub Total / Tax / Document Fee / Total).
  const docFeeAmount = Number(contract.doc_fee_amount ?? 0);
  const docFeeWaived = !!contract.doc_fee_waived;
  const docFeeTax = Number(contract.doc_fee_tax_amount ?? 0);
  const itemsSubtotal = Math.max(0, Number(contract.subtotal ?? 0) - (docFeeWaived ? 0 : docFeeAmount));
  totalsRow("Subtotal", formatCurrency(itemsSubtotal));

  // Discounts: show one line per discount entry (cleaner than a single sum).
  // Customer-facing labels — strip internal jargon like "Calculated to $X out-the-door"
  // (used by the show-discount calculator) and replace with a clean label.
  function customerDiscountLabel(raw: string, type?: string): string {
    const s = (raw ?? "").toString();
    if (s.toLowerCase().startsWith("calculated to")) return "Negotiated Discount";
    if (type === "show_special") return s || "Show Discount";
    if (type === "factory_rebate") return s || "Factory Rebate";
    if (type === "floor_model") return s || "Floor Model Discount";
    if (type === "military") return s || "Military Discount";
    if (type === "manager_override") return s || "Manager Discount";
    return (s || "Discount").slice(0, 38);
  }

  if (discounts.length > 0) {
    for (const d of discounts) {
      const label = customerDiscountLabel(d.label, d.type);
      totalsRow(label, `-${formatCurrency(d.amount ?? 0)}`, { color: RED });
    }
  } else if (discountTotal > 0) {
    totalsRow("Discount", `-${formatCurrency(discountTotal)}`, { color: RED });
  }

  // Show the running total after discounts so the customer can see what
  // they're actually paying for the goods before tax + doc fee stack on top.
  if (discountTotal > 0) {
    const afterDiscount = Math.max(0, itemsSubtotal - discountTotal);
    totalsRow("Subtotal after discount", formatCurrency(afterDiscount), { bold: true });
  }

  // contract.tax_amount is the items-only tax that /api/tax returned at the
  // POS — it's already $0 for tax_exempt customers. doc_fee_tax_amount is
  // persisted separately because it's always charged regardless of
  // tax_exempt and isn't refunded when the Rx arrives.
  const itemsTax = Number(contract.tax_amount ?? 0);
  if (itemsTax > 0) {
    totalsRow(`Tax (${((contract.tax_rate ?? 0) * 100).toFixed(2)}%)`, formatCurrency(itemsTax));
  } else if (contract.tax_exempt) {
    totalsRow("Tax — Exempt (Rx)", "$0.00", { color: SLATE_500 });
  }
  if (!docFeeWaived && docFeeAmount > 0) {
    totalsRow("Document Fee", formatCurrency(docFeeAmount));
    if (docFeeTax > 0) {
      totalsRow(`Doc Fee Tax (${((contract.tax_rate ?? 0) * 100).toFixed(2)}%)`, formatCurrency(docFeeTax));
    }
  }
  // Total divider (sits above the TOTAL row, not through it)
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.5);
  doc.line(totalsLeft, y - 3.5, totalsRight, y - 3.5);
  y += 1;

  totalsRow("TOTAL", formatCurrency(contract.total ?? 0), { bold: true, size: 12, color: NAVY });
  y += 3;

  // ─── Funding & Balance breakdown ────────────────────────────────────────
  const financing = Array.isArray(contract.financing) ? contract.financing : [];
  for (const f of financing) {
    if (!f || !f.financed_amount) continue;
    const isFoundation = f.deduct_from_balance === false;
    const label = isFoundation
      ? `${f.financer_name ?? "Foundation"} (carries to balance)`
      : `Financing — ${f.financer_name ?? "Lender"}`;
    totalsRow(label, `-${formatCurrency(f.financed_amount)}`, { color: TEAL });
  }

  const depositPaid = Number(contract.deposit_paid ?? 0);
  const depositAmount = Number(contract.deposit_amount ?? 0);
  if (depositPaid > 0) {
    totalsRow("Deposit Paid", `-${formatCurrency(depositPaid)}`, { color: EMERALD });
  } else if (depositAmount > 0 && isQuote) {
    totalsRow("Estimated Deposit", `-${formatCurrency(depositAmount)}`, { color: SLATE_500 });
  }

  // Card payment detail rows — show each charged card as a sub-line under
  // the deposit total so the printed agreement matches the receipt.
  for (const p of ccPayments) {
    const brand = (p.card_brand ?? "Card").toString();
    totalsRow(`  Paid by ${brand} ending in ${p.card_last4}`, formatCurrency(Number(p.amount ?? 0)), { color: SLATE_500, size: 9 });
  }

  // Balance Due banner
  const balanceDue = Number(contract.balance_due ?? 0);
  y += 2;
  doc.setFillColor(...(balanceDue > 0.01 ? [253, 244, 224] as [number, number, number] : [232, 245, 233] as [number, number, number]));
  doc.setDrawColor(...(balanceDue > 0.01 ? AMBER : EMERALD));
  doc.setLineWidth(0.4);
  doc.roundedRect(totalsLeft - 2, y - 4, totalsRight - totalsLeft + 4, 9, 1.5, 1.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...(balanceDue > 0.01 ? AMBER : EMERALD));
  doc.text(balanceDue > 0.01 ? "Balance Due at Delivery" : "Paid in Full", totalsLeft, y + 1.5);
  doc.text(formatCurrency(balanceDue), totalsRight - 1, y + 1.5, { align: "right" });
  y += 12;

  // ─── Estimated Delivery Timeframe ────────────────────────────────────────
  // Sales-rep estimated window (e.g. "2-4 weeks", "Mid-June"). Customer-
  // facing — also shown on the customer portal until a firm delivery date
  // is scheduled. Editable by admin/manager from the contract detail page.
  const deliveryTimeframe = (contract.delivery_timeframe ?? "").toString().trim();
  if (deliveryTimeframe.length > 0) {
    if (y > 250) { doc.addPage(); y = M; }
    doc.setFillColor(232, 245, 247); // soft teal tint
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.3);
    doc.roundedRect(totalsLeft - 2, y - 4, totalsRight - totalsLeft + 4, 9, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...TEAL);
    doc.text("Estimated Delivery", totalsLeft, y + 1.5);
    doc.setFont("helvetica", "bold");
    doc.text(deliveryTimeframe, totalsRight - 1, y + 1.5, { align: "right" });
    y += 12;
  }

  // ─── External notes (customer-facing) ────────────────────────────────────
  const externalNotes = (contract.external_notes ?? "").toString().trim();
  if (externalNotes.length > 0) {
    if (y > 235) { doc.addPage(); y = M; }
    sectionLabel("SPECIAL INSTRUCTIONS / NOTES", M, y);
    y += 5;
    doc.setFillColor(...SLATE_50);
    const noteLines = doc.splitTextToSize(externalNotes, W - M * 2 - 6);
    const noteH = noteLines.length * 4.5 + 6;
    doc.roundedRect(M, y - 2, W - M * 2, noteH, 1.5, 1.5, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_900);
    let ny = y + 3.5;
    for (const ln of noteLines) {
      if (ny > 260) { doc.addPage(); ny = M; }
      doc.text(ln, M + 3, ny);
      ny += 4.5;
    }
    y = ny + 4;
  }

  // ─── Signature ───────────────────────────────────────────────────────────
  if (y > 235) { doc.addPage(); y = M; }
  sectionLabel(isQuote ? "ACKNOWLEDGEMENT" : "SIGNATURE", M, y);
  y += 5;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...SLATE_900);

  if (!isQuote && contract.signed_at) {
    // Embed the actual signature image. Signatures uploaded to Supabase
    // Storage land here as a remote https:// URL (the normal path); the
    // storage-upload-failed fallback in Step7Sign/sign-token stores a
    // data:image/png base64 URL instead. Handle both so the PDF matches
    // the on-screen signature regardless of which path produced it.
    const sigUrl: string | undefined = contract.customer_signature_url;
    let sigDataUrl: string | null = null;
    if (sigUrl?.startsWith("data:image/")) {
      sigDataUrl = sigUrl;
    } else if (sigUrl?.startsWith("http")) {
      try {
        const res = await fetch(sigUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          sigDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
        }
      } catch {/* network/timeout — fall through to text-only */}
    }
    let sigEmbedded = false;
    if (sigDataUrl) {
      try {
        doc.addImage(sigDataUrl, "PNG", M, y, 70, 16);
        sigEmbedded = true;
        y += 18;
      } catch {/* ignore — fall through to text-only */}
    }
    const printedName = (contract.signature_metadata?.signed_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`).toString().trim();
    doc.setDrawColor(...SLATE_300);
    doc.setLineWidth(0.2);
    if (!sigEmbedded) {
      // Draw a signature line then label
      doc.line(M, y + 8, M + 80, y + 8);
      y += 12;
    } else {
      doc.line(M, y - 2, M + 80, y - 2);
    }
    doc.setFontSize(9);
    doc.setTextColor(...SLATE_500);
    doc.text(`Signed by ${printedName}`, M, y + 3);
    doc.text(`Date: ${formatDate(contract.signed_at)}`, M, y + 7.5);
    y += 12;
  } else {
    // Print-ready signature lines
    doc.setDrawColor(...SLATE_300);
    doc.setLineWidth(0.2);
    doc.text("Buyer:", M, y + 6);
    doc.line(M + 16, y + 6, M + 90, y + 6);
    doc.text("Date:", M + 100, y + 6);
    doc.line(M + 112, y + 6, W - M, y + 6);
    y += 14;
    doc.text("Seller:", M, y);
    doc.line(M + 16, y, M + 90, y);
    doc.text("Date:", M + 100, y);
    doc.line(M + 112, y, W - M, y);
    y += 14;
  }

  // ─── Terms & Conditions ─────────────────────────────────────────────────
  // Always start the legal block on a fresh page so the printed agreement
  // mirrors the legacy Atlas Sales Agreement (front: contract, back: terms).
  doc.addPage();
  y = M;

  sectionLabel("TERMS & CONDITIONS", M, y);
  y += 5;
  doc.setDrawColor(...SLATE_300);
  doc.setLineWidth(0.2);
  doc.line(M, y, W - M, y);
  y += 4;

  for (const section of TERMS_AND_CONDITIONS) {
    if (y > 270) { doc.addPage(); y = M; }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    doc.text(section.heading.toUpperCase(), M, y);
    y += 4;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...SLATE_900);
    for (let i = 0; i < section.clauses.length; i++) {
      const clause = section.clauses[i];
      const lines = doc.splitTextToSize(`${i + 1}. ${clause}`, W - M * 2 - 2);
      const blockH = lines.length * 3.6;
      if (y + blockH > 275) { doc.addPage(); y = M; }
      doc.text(lines, M + 2, y);
      y += blockH + 1.2;
    }
    y += 2;
  }

  // ─── Customer Acknowledgments — three required initials boxes ──────────
  if (y > 245) { doc.addPage(); y = M; }
  y += 2;
  sectionLabel("CUSTOMER ACKNOWLEDGMENTS", M, y);
  y += 5;

  // Pull persisted acknowledgments off signature_metadata (defaults to
  // empty for legacy contracts that pre-date this surface).
  const acks: AcknowledgmentsRecord =
    (contract.signature_metadata as { acknowledgments?: AcknowledgmentsRecord })?.acknowledgments ?? {};
  // Typed-initials fallback for legacy contracts that have a signature on
  // file but no per-clause ink yet — derive the initials from the signed
  // name so the box isn't blank.
  const fallbackInitials = (() => {
    const name = (contract.signature_metadata?.signed_name ?? `${c.first_name ?? ""} ${c.last_name ?? ""}`).toString().trim();
    if (!name) return "";
    return name
      .split(/\s+/)
      .map((part: string) => part[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4);
  })();
  const ackedAt = acks.acknowledged_at ? formatDate(acks.acknowledged_at) : "";

  // Initials box geometry — declared up here so the body text knows where
  // to stop wrapping. RIGHT_GAP is the breathing room between the wrapped
  // body text and the box border. 6mm still let "Atlas Spas & Swim" touch
  // the box on the Texas Prescription acknowledgment — bumped to 12mm so
  // every wrapped line has a clear gutter from the box border.
  const ackBoxW = 32;
  const ackBoxLeft = W - M - ackBoxW;
  const ackRightGap = 12;
  const ackBodyMaxW = ackBoxLeft - M - ackRightGap;

  for (const a of REQUIRED_ACKNOWLEDGMENTS) {
    const inkUrl = (acks as Record<string, unknown>)[`${a.key}_initials_url`] as string | undefined;
    const isChecked = !isQuote && !!acks[a.key];
    // Wrap the label too — "Texas Prescription — 30-Day Deadline" is wide
    // enough at 8.5pt bold that some renderers nudged it past the box edge.
    const labelLines = doc.splitTextToSize(a.label, ackBodyMaxW);
    const textLines = doc.splitTextToSize(a.text, ackBodyMaxW);
    const labelH = labelLines.length * 3.6;
    const textH = textLines.length * 3.4;
    // Block height needs to comfortably hold 18mm-tall ink so initials
    // render at a real legible size, never as a thumbnail. The +8 covers
    // top padding (3.5) + label-to-text gap (~2) + bottom padding (~2.5).
    const blockH = Math.max(22, labelH + textH + 8);
    if (y + blockH > 275) { doc.addPage(); y = M; }

    // Label (wrapped, navy bold)
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...NAVY);
    let ly = y + 3.5;
    for (const ln of labelLines) {
      doc.text(ln, M, ly);
      ly += 3.6;
    }

    // Body (wrapped, slate normal)
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE_900);
    ly += 1; // small breathing room between label and body
    for (const ln of textLines) {
      doc.text(ln, M, ly);
      ly += 3.4;
    }

    // Initials box (right side) — embed the actual hand-drawn ink when
    // present, fall back to the typed initials for legacy data, leave
    // empty for quotes so the rep can hand-collect on print.
    const boxW = ackBoxW;
    const boxH = blockH;
    const boxLeft = ackBoxLeft;
    doc.setDrawColor(...SLATE_500);
    doc.setLineWidth(0.4);
    doc.rect(boxLeft, y, boxW, boxH);
    doc.setFontSize(6.5);
    doc.setTextColor(...SLATE_500);
    doc.text("INITIALS", boxLeft + boxW / 2, y + 3, { align: "center" });

    if (inkUrl && inkUrl.startsWith("data:image/")) {
      // Embed the actual ink. Pad inside the box so the strokes don't
      // touch the border.
      try {
        doc.addImage(inkUrl, "PNG", boxLeft + 1.5, y + 4, boxW - 3, boxH - 6);
      } catch {
        // Fall through to typed initials if jsPDF rejects the image
        if (fallbackInitials) {
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.setTextColor(...NAVY);
          doc.text(fallbackInitials, boxLeft + boxW / 2, y + boxH - 3, { align: "center" });
        }
      }
    } else if (isChecked && fallbackInitials) {
      // Legacy contract acked via the prior checkbox flow — show typed
      // initials so the box isn't blank.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(...NAVY);
      doc.text(fallbackInitials, boxLeft + boxW / 2, y + boxH - 3, { align: "center" });
    }

    y += blockH + 2;
  }

  if (!isQuote && ackedAt) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    doc.text(`Initialed electronically on ${ackedAt}`, M, y + 2);
    y += 6;
  }

  // ─── Footer (every page) ────────────────────────────────────────────────
  const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    // Thin teal accent line
    doc.setDrawColor(...TEAL);
    doc.setLineWidth(0.4);
    doc.line(M, H - 12, W - M, H - 12);
    doc.setFontSize(7);
    doc.setTextColor(...SLATE_500);
    doc.setFont("helvetica", "normal");
    doc.text("Atlas Spas & Swim Spas", M, H - 7);
    doc.text("www.atlasspas.com", W / 2, H - 7, { align: "center" });
    doc.text(`Page ${i} of ${pageCount}`, W - M, H - 7, { align: "right" });
    doc.setFontSize(6.5);
    doc.text(
      `${docTitle} ${contract.contract_number} · Generated ${formatDate(new Date().toISOString())}`,
      M, H - 3.5
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
