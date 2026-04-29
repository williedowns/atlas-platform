// POST /api/contracts/[id]/inhouse-application
// Fires the In-House Financing application packet to Robert Kennedy.
// Idempotent-ish: callers should fire-and-forget after sign; multiple invocations
// will resend (Resend log will show the dupes — fine for a low-volume edge case).

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildInhouseApplicationHtml } from "@/lib/email/inhouse-application-template";

const ROBERT_EMAIL = "robertk@atlasbuildingsystemsinc.com";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  // CRITICAL: this route emails ACH details + signed DL URLs to Robert Kennedy.
  // Must be authenticated — never expose to anonymous callers.
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, total, line_items, financing, signed_at, customer_id,
      customer:customers(first_name, last_name, email, phone, address, city, state, zip)
    `)
    .eq("id", id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  // Find the In-House financing entry — bail out if there isn't one
  const financingArr = Array.isArray((contract as any).financing) ? (contract as any).financing : [];
  const inhouse = financingArr.find((f: any) => f?.type === "in_house");
  if (!inhouse) {
    return NextResponse.json({ skipped: true, reason: "no in-house financing entry" });
  }

  // Pull most recent DLs (primary + secondary) for the customer
  async function pullDl(category: "drivers_license" | "drivers_license_secondary") {
    if (!(contract as any).customer_id) return { url: null as string | null, filename: null as string | null };
    const { data: row } = await supabase
      .from("customer_files")
      .select("id, filename, storage_path")
      .eq("customer_id", (contract as any).customer_id)
      .eq("category", category)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row) return { url: null, filename: null };
    const { data: signed } = await supabase.storage
      .from("customer-files")
      .createSignedUrl(row.storage_path, 60 * 60 * 24 * 7);
    return { url: signed?.signedUrl ?? null, filename: row.filename ?? null };
  }
  const primaryDl = await pullDl("drivers_license");
  const secondaryDl = await pullDl("drivers_license_secondary");

  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.atlasswimspas.com";
  const customer = Array.isArray((contract as any).customer) ? (contract as any).customer[0] : (contract as any).customer;

  // Primary borrower: prefer fields stored on the financing entry; fall back to
  // the spa contract customer (the entry only stores primary_* when different).
  const primaryFirst = inhouse.primary_buyer_first_name ?? customer?.first_name;
  const primaryLast = inhouse.primary_buyer_last_name ?? customer?.last_name;
  const primaryEmail = inhouse.primary_buyer_email ?? customer?.email;
  const primaryPhone = inhouse.primary_buyer_phone ?? customer?.phone;

  const html = buildInhouseApplicationHtml({
    contractNumber: (contract as any).contract_number,
    contractTotal: Number((contract as any).total ?? 0),
    contractUrl: `${portalUrl}/contracts/${id}`,
    customer: {
      first_name: primaryFirst,
      last_name: primaryLast,
      email: primaryEmail,
      phone: primaryPhone,
      address: customer?.address,
      city: customer?.city,
      state: customer?.state,
      zip: customer?.zip,
    },
    secondaryBuyer: (inhouse.secondary_buyer_email || inhouse.secondary_buyer_first_name)
      ? {
          first_name: inhouse.secondary_buyer_first_name,
          last_name: inhouse.secondary_buyer_last_name,
          email: inhouse.secondary_buyer_email,
        }
      : undefined,
    lineItems: Array.isArray((contract as any).line_items) ? (contract as any).line_items : [],
    financing: {
      plan_number: inhouse.plan_number,
      plan_description: inhouse.plan_description,
      financed_amount: Number(inhouse.financed_amount ?? 0),
      approval_number: inhouse.approval_number,
    },
    ach: {
      holder_name: inhouse.inhouse_ach_holder_name,
      routing: inhouse.inhouse_ach_routing,
      account: inhouse.inhouse_ach_account,
      bank: inhouse.inhouse_ach_bank,
    },
    driversLicenseSignedUrl: primaryDl.url,
    driversLicenseFilename: primaryDl.filename,
    secondaryDriversLicenseSignedUrl: secondaryDl.url,
    secondaryDriversLicenseFilename: secondaryDl.filename,
    signedAt: (contract as any).signed_at,
  });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[inhouse-application] RESEND_API_KEY not set — skipping send");
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  const fromEmail = process.env.INHOUSE_APP_FROM_EMAIL ?? "Atlas Spas <noreply@atlasswimspas.com>";

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: ROBERT_EMAIL,
      subject: `In-House Financing Application — ${(contract as any).contract_number} (${customer?.first_name ?? ""} ${customer?.last_name ?? ""})`.trim(),
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[inhouse-application] Resend error:", body);
    return NextResponse.json({ error: "Email send failed", details: body }, { status: 500 });
  }

  return NextResponse.json({
    sent: true,
    to: ROBERT_EMAIL,
    primary_dl_attached: !!primaryDl.url,
    secondary_dl_attached: !!secondaryDl.url,
  });
}
