// POST /api/contracts/[id]/hoa-packet
// Emails the Fair Housing Legal Compliance Memorandum to the customer when
// their contract is flagged needs_hoa. Idempotent-ish — safe to invoke
// repeatedly (will just resend); short-circuits when needs_hoa is false or
// when the customer has no email.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildHoaPacketHtml } from "@/lib/email/hoa-packet-template";
import fs from "node:fs/promises";
import path from "node:path";

const HOA_PDF_FILENAME = "Fair Housing Legal Compliance Memorandum.pdf";
const HOA_PDF_RELATIVE_PATH = "public/legal/fair_housing_legal_compliance_memorandum.pdf";

let CACHED_PDF_BASE64: string | null = null;
async function loadHoaPacketBase64(): Promise<string> {
  if (CACHED_PDF_BASE64) return CACHED_PDF_BASE64;
  const buf = await fs.readFile(path.join(process.cwd(), HOA_PDF_RELATIVE_PATH));
  CACHED_PDF_BASE64 = buf.toString("base64");
  return CACHED_PDF_BASE64;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // CRITICAL: this route emails the customer (and attaches a PDF). Must be
  // authenticated to prevent anonymous spam / enumeration.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, needs_hoa, hoa_status,
      customer:customers(first_name, last_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  if (!(contract as any).needs_hoa) {
    return NextResponse.json({ skipped: true, reason: "needs_hoa is false" });
  }

  const customer = Array.isArray((contract as any).customer)
    ? (contract as any).customer[0]
    : (contract as any).customer;
  if (!customer?.email) {
    return NextResponse.json({ skipped: true, reason: "customer has no email on file" });
  }

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[hoa-packet] RESEND_API_KEY not set — skipping send");
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  let pdfBase64: string;
  try {
    pdfBase64 = await loadHoaPacketBase64();
  } catch (e) {
    console.error("[hoa-packet] Couldn't read PDF asset:", e);
    return NextResponse.json({ error: "HOA packet PDF missing on server" }, { status: 500 });
  }

  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.atlasswimspas.com";
  const customerPortalUrl = `${portalUrl}/portal`;
  const fromEmail = process.env.HOA_PACKET_FROM_EMAIL ?? "Atlas Spas <welcome@atlasswimspas.com>";

  const html = buildHoaPacketHtml({
    customerFirstName: customer.first_name,
    contractNumber: (contract as any).contract_number,
    customerPortalUrl,
  });

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: customer.email,
      subject: `HOA Approval Packet — ${(contract as any).contract_number}`,
      html,
      attachments: [
        {
          filename: HOA_PDF_FILENAME,
          content: pdfBase64,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[hoa-packet] Resend error:", body);
    return NextResponse.json({ error: "Email send failed", details: body }, { status: 500 });
  }

  return NextResponse.json({ sent: true, to: customer.email });
}
