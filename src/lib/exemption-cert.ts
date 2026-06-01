// Server-side generation of the Texas Form 01-339 sales-tax exemption
// certificate. The cert is built from the contract/customer record and the
// signature the customer already gave during the sales-agreement flow — it is
// never uploaded by hand. Same pdf-lib pipeline as the client modal
// (ExemptionCertSignModal.tsx) and the retro backfill
// (scripts/backfill-exemption-cert.mjs); centralized here so the live Rx flow
// and the backfill share one implementation.
//
// IMPORTANT: generating + attaching the cert is SEPARATE from zeroing the tax.
// This module only attaches the cert document (tax_exempt_cert_url +
// tax_exempt_cert_received[_at]). Whether the tax actually gets exempted is
// decided by applyAutoExemptionForContract, which is gated on the customer's
// Rx. Never set tax_exempt / tax_amount here — that's how the cert-alone
// exemption bug happened in the first place.

import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import fs from "node:fs/promises";
import path from "node:path";

const TEMPLATE_RELATIVE_PATH = "public/forms/tx-01-339.pdf";

const SELLER = {
  name: "Atlas Spas and Swim Spas",
  street: "5511 Hwy 31 W",
  cityStateZip: "Tyler, TX 75709",
} as const;

// Position of the purchaser signature box on the Exemption Certification page
// (page 2). Verified against the template via scripts/inspect-tx-01-339.mjs.
const SIG_OVERLAY = { x: 78, y: 123, width: 195, height: 20 } as const;

// The template is a static asset that never changes — cache the bytes across
// invocations (mirrors the hoa-packet route's loader).
let cachedTemplate: Uint8Array | null = null;
async function loadTemplateBytes(): Promise<Uint8Array> {
  if (cachedTemplate) return cachedTemplate;
  const buf = await fs.readFile(path.join(process.cwd(), TEMPLATE_RELATIVE_PATH));
  cachedTemplate = new Uint8Array(buf);
  return cachedTemplate;
}

function formatCertDate(iso: string): string {
  const d = new Date(iso);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

// The customer signature is stored either as a public URL (signatures bucket)
// or, for some older contracts, inline as a data URL. Handle both so a data
// URL doesn't crash the Node fetch (which rejects data: URLs).
async function loadSignatureBytes(url: string): Promise<Uint8Array> {
  if (url.startsWith("data:")) {
    const base64 = url.split(",")[1] ?? "";
    if (!base64) throw new Error("Signature data URL is empty");
    return new Uint8Array(Buffer.from(base64, "base64"));
  }
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Signature fetch failed: ${resp.status}`);
  return new Uint8Array(await resp.arrayBuffer());
}

export interface CertFieldData {
  purchaserName: string;
  purchaserStreet: string;
  purchaserPhone: string;
  purchaserCityStateZip: string;
  signedDate: string; // mm/dd/yyyy
  title: string;
  signatureBytes: Uint8Array; // PNG
}

/** Fill Form 01-339 and embed the signature. Returns the merged, flattened
 *  single-page (Exemption Certification only) PDF bytes. Pure: no DB/network
 *  except loading the static template. */
export async function buildExemptionCertPdf(data: CertFieldData): Promise<Uint8Array> {
  const templateBytes = await loadTemplateBytes();
  const pdf = await PDFDocument.load(templateBytes);
  const form = pdf.getForm();

  form.getTextField("Exemption purchaser").setText(data.purchaserName);
  form.getTextField("Exemption purchaser street").setText(data.purchaserStreet);
  form.getTextField("Exemption purchaser phone").setText(data.purchaserPhone);
  form.getTextField("Exemption purchaser city").setText(data.purchaserCityStateZip);
  form.getTextField("Exempt seller").setText(SELLER.name);
  form.getTextField("Exempt seller street").setText(SELLER.street);
  form.getTextField("Exempt seller city").setText(SELLER.cityStateZip);
  form.getTextField("Exempt item description").setText("Hot tub or swim spa");
  form.getTextField("Exemption reason").setText("Hydrotherapy");
  form.getTextField("Exempt purchaser title").setText(data.title);
  form.getTextField("Exempt purchaser sig date").setText(data.signedDate);

  const sigImage = await pdf.embedPng(data.signatureBytes);
  // Page 2 (index 1) is the Exemption Certification.
  pdf.getPage(1).drawImage(sigImage, SIG_OVERLAY);

  // Flatten so the field values become page content (no post-sign editing),
  // then drop the unused Resale Certificate front page.
  form.flatten();
  pdf.removePage(0);

  return pdf.save();
}

export interface GenerateCertResult {
  contractId: string;
  contractNumber: string;
  generated: boolean;
  certUrl?: string;
  reason?: string;
}

interface CertCustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  has_prescription: boolean | null;
}

interface CertContractRow {
  id: string;
  contract_number: string;
  signed_at: string | null;
  customer_signature_url: string | null;
  tax_exempt_cert_url: string | null;
  // Venue jurisdiction — embedded relationships come back object-or-array.
  show: { state: string | null } | { state: string | null }[] | null;
  location: { state: string | null } | { state: string | null }[] | null;
  customer: CertCustomerRow | CertCustomerRow[] | null;
}

export interface GenerateCertOptions {
  // Overwrite an existing cert (e.g. when reconciling a bad upload such as a
  // driver's license sitting in the cert slot). Default false: skip if a cert
  // is already attached so the live flow never clobbers a real document.
  force?: boolean;
}

/** Generate the 01-339 from a signed contract's own data + the captured
 *  signature, upload it to the tax-certs bucket, and attach it to the
 *  contract. GATED on Texas jurisdiction: the cert is produced for every
 *  signed TX sale regardless of Rx (the cert is a prepared document; whether
 *  the tax actually gets exempted is a separate, Rx-gated decision). Does NOT
 *  zero the tax — that stays in applyAutoExemption (see module header). */
export async function generateAndAttachExemptionCert(
  supabase: SupabaseClient,
  contractId: string,
  opts: GenerateCertOptions = {},
): Promise<GenerateCertResult> {
  const { data: contract, error } = await supabase
    .from("contracts")
    .select(
      "id, contract_number, signed_at, customer_signature_url, tax_exempt_cert_url, show:shows(state), location:locations(state), customer:customers(id, first_name, last_name, phone, address, city, state, zip, has_prescription)",
    )
    .eq("id", contractId)
    .maybeSingle();

  if (error || !contract) {
    return { contractId, contractNumber: "", generated: false, reason: error?.message ?? "Contract not found" };
  }

  const c = contract as CertContractRow;
  const customer = Array.isArray(c.customer) ? c.customer[0] : c.customer;
  const show = Array.isArray(c.show) ? c.show[0] : c.show;
  const location = Array.isArray(c.location) ? c.location[0] : c.location;
  const contractNumber = c.contract_number;

  if (!customer) {
    return { contractId, contractNumber, generated: false, reason: "No customer on contract" };
  }
  // Texas gate: the 01-339 is a TEXAS exemption form, so only generate it for
  // sales whose tax jurisdiction is Texas. Mirror the tax route's venue rule
  // (src/app/api/tax/route.ts): show state takes priority, then location.
  // NOTE: cross-state destination sourcing (a TX show shipped to another
  // covered state) isn't reflected here — venue is the signal. Since the cert
  // never zeroes tax, an inapplicable TX cert is inert, not a miscalculation.
  const venueState = (show?.state ?? location?.state ?? "").toUpperCase();
  if (venueState !== "TX") {
    return { contractId, contractNumber, generated: false, reason: "Not a Texas sale" };
  }
  if (!c.customer_signature_url) {
    return { contractId, contractNumber, generated: false, reason: "No customer signature on contract" };
  }
  if (c.tax_exempt_cert_url && !opts.force) {
    return { contractId, contractNumber, generated: false, reason: "Cert already attached" };
  }

  let mergedBytes: Uint8Array;
  try {
    const signatureBytes = await loadSignatureBytes(c.customer_signature_url);
    const purchaserName = `${customer.first_name ?? ""} ${customer.last_name ?? ""}`.trim();
    const purchaserCityStateZip = `${customer.city ?? ""}, ${customer.state ?? ""} ${customer.zip ?? ""}`.trim();
    const signedDate = formatCertDate(c.signed_at ?? new Date().toISOString());
    mergedBytes = await buildExemptionCertPdf({
      purchaserName,
      purchaserStreet: customer.address ?? "",
      purchaserPhone: customer.phone ?? "",
      purchaserCityStateZip,
      signedDate,
      title: "Owner",
      signatureBytes,
    });
  } catch (e) {
    return { contractId, contractNumber, generated: false, reason: `Cert build failed: ${(e as Error).message}` };
  }

  const storagePath = `${c.id}/tx-01-339-${Date.now()}.pdf`;
  const { error: upErr } = await supabase.storage
    .from("tax-certs")
    .upload(storagePath, mergedBytes, { contentType: "application/pdf", upsert: false });
  if (upErr) {
    return { contractId, contractNumber, generated: false, reason: `Cert upload failed: ${upErr.message}` };
  }

  const { data: urlData } = supabase.storage.from("tax-certs").getPublicUrl(storagePath);
  const certUrl = urlData.publicUrl;

  const { error: updErr } = await supabase
    .from("contracts")
    .update({
      tax_exempt_cert_url: certUrl,
      tax_exempt_cert_received: true,
      tax_exempt_cert_received_at: new Date().toISOString(),
    })
    .eq("id", c.id);
  if (updErr) {
    return { contractId, contractNumber, generated: false, reason: `Contract update failed: ${updErr.message}` };
  }

  return { contractId, contractNumber, generated: true, certUrl };
}

/** Generate + attach the 01-339 for every one of a customer's signed,
 *  still-taxed contracts that doesn't already have a cert. Each contract is
 *  TX-gated inside generateAndAttachExemptionCert. Signing is the primary
 *  trigger now; this is a safety net (e.g. right after an Rx upload, or for a
 *  contract whose signing-time generation didn't run). Scope (tax_amount > 0,
 *  signed, no cert yet) matches the taxed-sale case; already-zeroed bad-data
 *  contracts are handled by the backfill, not here. One row per contract. */
export async function generateExemptionCertsForCustomer(
  supabase: SupabaseClient,
  customerId: string,
  opts: GenerateCertOptions = {},
): Promise<GenerateCertResult[]> {
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("id")
    .eq("customer_id", customerId)
    .not("signed_at", "is", null)
    .not("customer_signature_url", "is", null)
    .is("tax_exempt_cert_url", null)
    .gt("tax_amount", 0);
  if (error || !contracts) return [];
  const results: GenerateCertResult[] = [];
  for (const c of contracts as { id: string }[]) {
    results.push(await generateAndAttachExemptionCert(supabase, c.id, opts));
  }
  return results;
}
