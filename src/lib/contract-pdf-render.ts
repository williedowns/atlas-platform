/* eslint-disable @typescript-eslint/no-explicit-any -- contract + line_items
   are JSONB rows; this is the verbatim layout code from the single-contract
   route, which treats them as untyped. Typing them is a separate refactor. */
import { jsPDF } from "jspdf";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  TERMS_AND_CONDITIONS,
  REQUIRED_ACKNOWLEDGMENTS,
  BLEM_ACKNOWLEDGMENT,
  type AcknowledgmentsRecord,
  type AcknowledgmentClause,
} from "@/lib/contract-terms";
import fs from "node:fs/promises";
import path from "node:path";

export type ContractCcPayment = {
  amount: number;
  card_brand: string | null;
  card_last4: string | null;
};

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

/**
 * Renders one contract's pages into an existing jsPDF doc, starting on the
 * current page (caller owns the doc and any page break before this contract).
 * Footer page numbers are scoped to THIS contract's own page range so a
 * multi-contract document reads as a stack of self-contained agreements.
 *
 * Shared by /api/contracts/[id]/pdf (single) and
 * /api/shows/[id]/contracts-pdf (bulk) so both stay on one layout.
 */
export async function renderContractPages(
  doc: jsPDF,
  contract: any,
  ccPayments: ContractCcPayment[]
): Promise<void> {
  const firstPage = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
const isQuote = contract.status === "quote";
  const docTitle = isQuote ? "QUOTE" : "SALES AGREEMENT";
  const logoDataUrl = await getLogoDataUrl();

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

  // Compact mode: when the contract carries enough line items / optional
  // sections to risk pushing the signature onto a second page, shrink the
  // line-item row height and font so everything stays on one front page.
  // Trigger heuristic tuned against real show contracts that have produced
  // a "tiny orphan" page-2 in the past — eight or more line items, any blem
  // unit (each one renders a 60mm-tall details block on page 1), or a long
  // external-notes block all bias toward overflow.
  const externalNotesPreview = (contract.external_notes ?? "").toString();
  const blemLineCount = lineItems.filter((li: any) => li?.unit_type === "blem").length;
  const compactPage1 =
    lineItems.length >= 8 ||
    blemLineCount > 0 ||
    externalNotesPreview.length > 200;

  // Unit-type badge — every spa line item with a declared unit_type prints
  // a small colored tag adjacent to the product name AND a dedicated
  // detail sub-line beneath the colors. The detail line mirrors the paper
  // Sales Agreement's "☑ New In-Stock Model · Serial #NIXX · Location:
  // Henderson" so the printed contract has parity with the old paper form.
  type UnitTagSpec = { text: string; bg: [number, number, number]; fg: [number, number, number]; full: string };
  function getUnitTagSpec(unitType: string | undefined): UnitTagSpec | null {
    switch (unitType) {
      case "blem":
        return { text: "BLEM · AS-IS",         bg: [254, 226, 226], fg: RED,        full: "Blemish / As-Is Model" };
      case "floor_model":
        return { text: "FLOOR MODEL",          bg: [254, 243, 199], fg: AMBER,      full: "Floor Model" };
      case "factory_build":
        return { text: "ORDER FROM FACTORY",   bg: [254, 243, 199], fg: AMBER,      full: "New — Factory Build" };
      case "wet_model":
        return { text: "WET MODEL",            bg: [226, 232, 240], fg: SLATE_500,  full: "Wet Model" };
      case "stock":
        return { text: "IN STOCK",             bg: [220, 252, 231], fg: EMERALD,    full: "New — In-Stock Model" };
      default:
        return null;
    }
  }

  // Build the printed sub-line that mirrors the paper-form unit row.
  // Format: "☑ {Unit Type Label} · Serial #{NIXX or "Pending Factory"}"
  // The sale location lives in the contract header (Bill To / Location) so
  // the line-item sub-line doesn't repeat it.
  function buildUnitDetailText(item: any, spec: UnitTagSpec): string {
    const parts: string[] = [`☑ ${spec.full}`];
    const serial = String(item.serial_number ?? "").trim();
    if (serial) {
      parts.push(`Serial #${serial}`);
    } else if (item.unit_type === "factory_build") {
      parts.push("Serial # — Pending Factory");
    }
    return parts.join(" · ");
  }

  let altRow = false;
  for (const item of lineItems) {
    const colorParts = [item.shell_color, item.cabinet_color && `${item.cabinet_color} cabinet`].filter(Boolean) as string[];
    const colorText = colorParts.join(" · ");
    const tagSpec = getUnitTagSpec(item.unit_type);
    const hasUnitDetail = !!tagSpec;
    // Row height grows by ~3.5mm for each sub-line we render under the
    // product name. The two sub-lines available are (a) shell/cabinet
    // colors and (b) the paper-form-style unit detail line — independently
    // present based on data.
    const subLineCount = (colorText ? 1 : 0) + (hasUnitDetail ? 1 : 0);
    const baseH = compactPage1 ? 5.4 : 6.5;
    const subLineH = compactPage1 ? 3   : 3.5;
    const rowH = baseH + subLineCount * subLineH;
    if (y > 240) {
      doc.addPage();
      y = M;
    }
    if (altRow) {
      doc.setFillColor(252, 252, 253);
      doc.rect(M, y - 4, W - M * 2, rowH, "F");
    }
    altRow = !altRow;

    const name = String(item.product_name ?? "");
    const qty = item.quantity ?? 1;
    const lineTotal = (item.sell_price ?? 0) * qty;
    // Reserve space for the unit-type tag when present so the product name
    // doesn't collide with it. Longer tags (ORDER FROM FACTORY) need more
    // headroom than BLEM, so pad the displayName max length further down.
    let nameMax = 50;
    if (tagSpec) nameMax = tagSpec.text.length > 14 ? 28 : 36;
    const displayName = name.length > nameMax ? name.substring(0, nameMax - 3) + "…" : name;

    const bodyFontSize = compactPage1 ? 9 : 10;
    doc.setTextColor(...SLATE_900);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(bodyFontSize);
    doc.text(displayName, colProduct + 1, y);
    if (tagSpec) {
      // Small colored pill adjacent to product name so the unit type is
      // visually obvious from across the room when the rep hands over the
      // printed contract.
      const nameW = doc.getTextWidth(displayName);
      const tagX = colProduct + 1 + nameW + 2;
      const tagY = y - 3.2;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(6.5);
      const tagW = doc.getTextWidth(tagSpec.text) + 3;
      doc.setFillColor(...tagSpec.bg);
      doc.setDrawColor(...tagSpec.fg);
      doc.setLineWidth(0.2);
      doc.roundedRect(tagX, tagY, tagW, 4, 0.6, 0.6, "FD");
      doc.setTextColor(...tagSpec.fg);
      doc.text(tagSpec.text, tagX + 1.5, tagY + 2.8);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(bodyFontSize);
    }
    doc.setFontSize(compactPage1 ? 8.5 : 9);
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

    // Sub-line 1: shell / cabinet colors (when present).
    let subY = y + subLineH;
    if (colorText) {
      doc.setFontSize(compactPage1 ? 7 : 8);
      doc.setTextColor(...SLATE_500);
      doc.setFont("helvetica", "normal");
      const displayColor = colorText.length > 55 ? colorText.substring(0, 52) + "…" : colorText;
      doc.text(displayColor, colProduct + 1, subY);
      subY += subLineH;
    }
    // Sub-line 2: paper-form-style unit detail row (when unit_type set).
    // Printed slightly darker than the color line so the data customers
    // care about (serial + location) is easy to read.
    if (hasUnitDetail) {
      doc.setFontSize(compactPage1 ? 7 : 8);
      doc.setTextColor(...tagSpec!.fg);
      doc.setFont("helvetica", "bold");
      const detailText = buildUnitDetailText(item, tagSpec!);
      const displayDetail = detailText.length > 95 ? detailText.substring(0, 92) + "…" : detailText;
      doc.text(displayDetail, colProduct + 1, subY);
    }

    doc.setFontSize(10);
    y += rowH;
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
    // Compact mode shaves the body font from 10pt → 9pt on non-bold rows so
    // the totals card claws back vertical space without losing the bold
    // TOTAL emphasis at the bottom.
    const baseSize = opts?.size ?? (compactPage1 && !opts?.bold ? 9 : 10);
    doc.setFontSize(baseSize);
    doc.setTextColor(...(opts?.color ?? SLATE_900));
    doc.text(label, totalsLeft, y);
    doc.text(value, totalsRight, y, { align: "right" });
    y += opts?.bold ? (compactPage1 ? 6 : 7) : (compactPage1 ? 4.5 : 5.5);
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
    // Combined fee+tax on a single line per Willie's call — matches the
    // Step 5 Review screen the rep sees while building the contract so the
    // printed agreement doesn't introduce a separate row the customer never
    // saw at sale time. Data is still persisted in doc_fee_amount and
    // doc_fee_tax_amount columns separately for the bookkeeper tax report.
    totalsRow("Document Fee", formatCurrency(docFeeAmount + docFeeTax));
  }
  const totalAdjustment = Number(contract.total_adjustment_amount ?? 0);
  if (totalAdjustment !== 0) {
    const sign = totalAdjustment < 0 ? "-" : "+";
    totalsRow("Adjustment", `${sign}${formatCurrency(Math.abs(totalAdjustment))}`, {
      color: totalAdjustment < 0 ? RED : EMERALD,
    });
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
    // Finance plan number is the lender-issued plan identifier (e.g. Wells
    // Fargo plan code, GreenSky plan code, Foundation tier number). Rendered
    // as an indented sub-line under the financer label regardless of the
    // financing company so the agreement clearly states which plan the
    // customer is being enrolled into.
    const planNumber = (f.plan_number ?? "").toString().trim();
    if (planNumber.length > 0) {
      totalsRow(`  Plan #${planNumber}`, "", { color: SLATE_500, size: 9 });
    }
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

  // ─── Blem Details ────────────────────────────────────────────────────────
  // Render a dedicated block per blem line item with the description and up
  // to 4 thumbnail photos. PDF stays under typical email-deliverable size
  // because we cap thumbnails. The portal has the full photo set.
  const blemItems = lineItems.filter((li: any) => li?.unit_type === "blem");
  if (blemItems.length > 0) {
    // Always start the block on a fresh "shelf" — page break if tight.
    if (y > 220) { doc.addPage(); y = M; }
    // Heading band
    doc.setFillColor(254, 226, 226); // red-100
    doc.setDrawColor(...RED);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, W - M * 2, 8, 1.5, 1.5, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...RED);
    doc.text("⚠  BLEMISHED ITEMS — SOLD AS-IS", M + 3, y + 5.3);
    y += 12;

    for (const item of blemItems as any[]) {
      // Estimate block height up front so we can page-break cleanly.
      const description = String(item.blem_description ?? "").trim();
      const photoUrls: string[] = Array.isArray(item.blem_photo_urls) ? item.blem_photo_urls : [];
      const visiblePhotos = photoUrls.slice(0, 4);
      const overflow = Math.max(0, photoUrls.length - visiblePhotos.length);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const descLines = description ? doc.splitTextToSize(description, W - M * 2 - 4) : [];
      const descH = descLines.length * 3.8;
      const photoH = visiblePhotos.length > 0 ? 32 : 0; // 30mm thumb + label space
      const blockH = 6 + descH + 4 + photoH + 4;
      if (y + blockH > 270) { doc.addPage(); y = M; }

      // Label line: product + serial
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(...NAVY);
      const labelText = `${item.product_name ?? ""}${item.serial_number ? `  ·  Serial ${item.serial_number}` : ""}`;
      doc.text(labelText, M + 2, y + 4);
      y += 6;

      // Description
      if (descLines.length > 0) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(...SLATE_900);
        for (const ln of descLines) {
          doc.text(ln, M + 2, y);
          y += 3.8;
        }
        y += 1;
      }

      // Up to 4 thumbnail photos in a row. Each photo is fetched, base64-
      // encoded, and embedded. Fetch errors silently skip (matches signature
      // embed fallback).
      if (visiblePhotos.length > 0) {
        const thumbW = 26;
        const thumbH = 26;
        const gap = 4;
        let tx = M + 2;
        const ty = y;
        for (const url of visiblePhotos) {
          if (tx + thumbW > W - M) break; // safety
          try {
            const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
            if (res.ok) {
              const ct = res.headers.get("content-type") ?? "image/jpeg";
              const buf = Buffer.from(await res.arrayBuffer());
              const fmt = ct.includes("png") ? "PNG" : ct.includes("webp") ? "WEBP" : "JPEG";
              const dataUrl = `data:${ct};base64,${buf.toString("base64")}`;
              try {
                doc.addImage(dataUrl, fmt, tx, ty, thumbW, thumbH);
              } catch {/* unsupported format — show placeholder */
                doc.setDrawColor(...SLATE_300);
                doc.setLineWidth(0.2);
                doc.rect(tx, ty, thumbW, thumbH);
              }
            } else {
              doc.setDrawColor(...SLATE_300);
              doc.setLineWidth(0.2);
              doc.rect(tx, ty, thumbW, thumbH);
            }
          } catch {
            doc.setDrawColor(...SLATE_300);
            doc.setLineWidth(0.2);
            doc.rect(tx, ty, thumbW, thumbH);
          }
          tx += thumbW + gap;
        }
        if (overflow > 0) {
          doc.setFont("helvetica", "italic");
          doc.setFontSize(7.5);
          doc.setTextColor(...SLATE_500);
          doc.text(`+ ${overflow} more photo${overflow === 1 ? "" : "s"} in customer portal`, tx, ty + thumbH / 2);
        }
        y = ty + thumbH + 3;
      }

      // Section divider between blem items
      doc.setDrawColor(...SLATE_300);
      doc.setLineWidth(0.15);
      doc.line(M, y, W - M, y);
      y += 4;
    }
    y += 2;
  }

  // ─── Signature ───────────────────────────────────────────────────────────
  // Signature block is ~30mm tall (signature image + name + date lines). In
  // compact mode the rest of page 1 was already squeezed to leave room here,
  // so we extend the break threshold an extra 8mm before giving up and
  // starting a new page — that's what kept the "tiny orphan page" appearing
  // on dense show contracts.
  const sigBreakThreshold = compactPage1 ? 248 : 235;
  if (y > sigBreakThreshold) { doc.addPage(); y = M; }
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

  // Include the blem acknowledgment only when the contract has blem line
  // items — keeps legacy non-blem contracts visually identical to before.
  const ackList: AcknowledgmentClause[] = blemItems.length > 0
    ? [...REQUIRED_ACKNOWLEDGMENTS, BLEM_ACKNOWLEDGMENT]
    : REQUIRED_ACKNOWLEDGMENTS;

  for (const a of ackList) {
    const inkUrl = (acks as Record<string, unknown>)[`${a.key}_initials_url`] as string | undefined;
    const isChecked = !isQuote && !!(acks as Record<string, unknown>)[a.key];
    // Wrap the label too — "Texas Prescription — 30-Day Deadline" is wide
    // enough at 8.5pt bold that some renderers nudged it past the box edge.
    // Set each font BEFORE splitTextToSize so jsPDF measures with the same
    // metrics it will render with — otherwise the body can be split using
    // leftover (bold) state from the previous block and overflow the box.
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    const labelLines = doc.splitTextToSize(a.label, ackBodyMaxW);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
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

    // Resolve ink URL to a data URL. Mirrors the signature block above:
    // inline data: URLs come from the Step 7 (in-person) flow, https URLs
    // come from the remote /sign/[token] flow which uploads to Storage
    // first. Without this fetch, remote-signed contracts fell back to
    // typed initials even when real ink was on file.
    let inkDataUrl: string | null = null;
    if (inkUrl?.startsWith("data:image/")) {
      inkDataUrl = inkUrl;
    } else if (inkUrl?.startsWith("http")) {
      try {
        const res = await fetch(inkUrl, { signal: AbortSignal.timeout(5000) });
        if (res.ok) {
          const buf = Buffer.from(await res.arrayBuffer());
          inkDataUrl = `data:image/png;base64,${buf.toString("base64")}`;
        }
      } catch {/* network/timeout — fall through to text-only */}
    }

    if (inkDataUrl) {
      // Embed the actual ink. Pad inside the box so the strokes don't
      // touch the border.
      try {
        doc.addImage(inkDataUrl, "PNG", boxLeft + 1.5, y + 4, boxW - 3, boxH - 6);
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
  const lastPage = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
  const pageTotal = lastPage - firstPage + 1;
  for (let i = firstPage; i <= lastPage; i++) {
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
    doc.text(`Page ${i - firstPage + 1} of ${pageTotal}`, W - M, H - 7, { align: "right" });
    doc.setFontSize(6.5);
    doc.text(
      `${docTitle} ${contract.contract_number} · Generated ${formatDate(new Date().toISOString())}`,
      M, H - 3.5
    );
  }
}
