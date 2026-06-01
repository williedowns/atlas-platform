import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";
import { buildSigningLinkEmailHtml } from "@/lib/email/signing-link-template";

const TOKEN_TTL_DAYS = 7;

// Generates (or rotates) a single-use signing token for a quote contract
// and emails the customer a link to /sign/[token]. Used when the customer
// left mid-flow without finishing the in-person Step 7 signing — for
// example, walking out of the show after paying by check.
//
// Returns the URL in the response body so the rep can copy/paste it to
// SMS as a backup if the email bounces.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, status, total, line_items,
      customer:customers(first_name, last_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }
  if (contract.status !== "quote") {
    return NextResponse.json(
      { error: `Cannot send for signature — contract is already in '${contract.status}' status.` },
      { status: 400 }
    );
  }

  const customerRel = contract.customer as
    | { first_name?: string | null; last_name?: string | null; email?: string | null }
    | { first_name?: string | null; last_name?: string | null; email?: string | null }[]
    | null;
  const customer = Array.isArray(customerRel) ? customerRel[0] : customerRel;

  if (!customer?.email) {
    return NextResponse.json(
      { error: "Customer has no email on file. Add an email to the customer record first." },
      { status: 400 }
    );
  }

  const token = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const sentAt = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("contracts")
    .update({
      signing_token: token,
      signing_token_expires_at: expiresAt,
      signing_token_sent_at: sentAt,
    })
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://getsalta.com";
  const signingUrl = `${appUrl}/sign/${token}`;

  // Look up the rep's display name for the greeting line.
  const { data: repProfile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .maybeSingle();
  const salesRepName =
    [repProfile?.first_name, repProfile?.last_name].filter(Boolean).join(" ") || "Your Atlas rep";

  const lineItems = Array.isArray(contract.line_items) ? (contract.line_items as Array<{ product_name?: string; waived?: boolean }>) : [];
  const productNames = lineItems
    .filter((i) => !i.waived && typeof i.product_name === "string")
    .map((i) => i.product_name as string);

  const html = buildSigningLinkEmailHtml({
    customerFirstName: customer.first_name ?? "there",
    contractNumber: contract.contract_number,
    productNames,
    total: Number(contract.total),
    signingUrl,
    salesRepName,
  });

  let emailSent = false;
  let emailError: string | null = null;
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `Atlas Spas <${process.env.INVITE_FROM_EMAIL ?? "hello@atlasspas.com"}>`,
          to: customer.email,
          subject: `Sign your Atlas Spas contract #${contract.contract_number}`,
          html,
        }),
      });
      emailSent = res.ok;
      if (!res.ok) emailError = `Resend ${res.status}`;
    } catch (e) {
      emailError = e instanceof Error ? e.message : "send failed";
    }
  } else {
    emailError = "RESEND_API_KEY not configured";
  }

  logAction({
    userId: user.id,
    action: "contract.signing_link_sent",
    entityType: "contract",
    entityId: id,
    metadata: {
      contract_number: contract.contract_number,
      customer_email: customer.email,
      email_sent: emailSent,
      email_error: emailError,
      expires_at: expiresAt,
    },
    req,
  });

  return NextResponse.json({
    ok: true,
    signing_url: signingUrl,
    expires_at: expiresAt,
    email_sent: emailSent,
    email_error: emailError,
    customer_email: customer.email,
  });
}
