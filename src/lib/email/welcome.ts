import { createAdminClient } from "@/lib/supabase/admin";
import { jsPDF } from "jspdf";
import { renderContractPages, type ContractCcPayment } from "@/lib/contract-pdf-render";
import { buildWelcomeEmailHtml } from "@/lib/email/welcome-template";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://getsalta.com";
// Must be on a Resend-verified domain. atlasspas.com is verified; the legacy
// atlasswimspas.com is NOT, which is why earlier sends silently bounced.
const WELCOME_FROM = `Atlas Spas <${process.env.INVITE_FROM_EMAIL ?? "hello@atlasspas.com"}>`;

export interface WelcomeResult {
  sent: boolean;
  skipped?: string;
  error?: string;
  pdfAttached?: boolean;
}

// Single source of truth for the post-signature customer welcome. Called
// (and awaited) from every signing path — in-person contract creation, remote
// /sign/[token], and the manual staff resend route. Provisions the customer's
// portal auth account, generates a one-click set-password link, attaches the
// signed contract PDF, and sends from a verified domain. Awaited on purpose:
// Vercel kills un-awaited promises after the response returns, so a
// fire-and-forget send never actually completes in production.
export async function provisionAndSendWelcome(contractId: string): Promise<WelcomeResult> {
  const admin = createAdminClient();

  // Same join shape renderContractPages expects (mirrors GET /contracts/[id]/pdf).
  const { data: contract, error } = await admin
    .from("contracts")
    .select(
      "*, customer:customers(*), location:locations(*), show:shows(name, venue_name), sales_rep:profiles!contracts_sales_rep_id_fkey(full_name)"
    )
    .eq("id", contractId)
    .single();

  if (error || !contract) {
    console.error(`[welcome] contract ${contractId} not found:`, error?.message);
    return { sent: false, error: "contract_not_found" };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = contract as any;
  const customer = c.customer;
  const email: string | undefined = customer?.email?.trim();
  if (!email) {
    console.error(`[welcome] contract ${contractId} has no customer email — skipping`);
    return { sent: false, skipped: "no_customer_email" };
  }

  // Provision (idempotently) the customer's portal auth user. email_confirm
  // suppresses Supabase's own confirmation email; role=customer + NO profiles
  // row keeps them strictly non-staff. Portal pages link by email match.
  await ensureCustomerAuthUser(admin, email, customer.first_name, customer.last_name);

  // One-click "set password & enter portal" link. Recovery link lands on
  // /auth/callback, which forwards the next param through to set-password,
  // which then drops the customer at /portal/dashboard.
  let setupLink = `${APP_URL}/portal/login`;
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: {
      redirectTo: `${APP_URL}/auth/callback?next=${encodeURIComponent("/portal/dashboard")}`,
    },
  });
  if (linkError || !linkData?.properties?.action_link) {
    console.error(
      `[welcome] generateLink failed for ${email} (contract ${contractId}):`,
      linkError?.message
    );
    // Non-fatal: fall back to the portal login page; customer can use "forgot
    // password" to recover. Better to deliver the email than to abort.
  } else {
    setupLink = linkData.properties.action_link;
  }

  // Signed contract PDF — proof of purchase. Graceful degrade: a render
  // failure must never stop the email from going out.
  let pdfBase64: string | null = null;
  try {
    const { data: ccData } = await admin
      .from("payments")
      .select("amount, card_brand, card_last4")
      .eq("contract_id", contractId)
      .eq("status", "completed")
      .not("card_last4", "is", null)
      .order("created_at");
    const ccPayments: ContractCcPayment[] = ccData ?? [];
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    await renderContractPages(doc, contract, ccPayments);
    pdfBase64 = Buffer.from(doc.output("arraybuffer")).toString("base64");
  } catch (pdfErr) {
    console.error(
      `[welcome] PDF generation failed for contract ${contractId} (sending without attachment):`,
      pdfErr
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: any[] = Array.isArray(c.line_items) ? c.line_items : [];
  const productNames = lineItems
    .filter((i) => !i.waived && i.product_name)
    .map((i) => i.product_name as string);

  const html = buildWelcomeEmailHtml({
    customerFirstName: customer.first_name ?? "there",
    customerEmail: email,
    contractNumber: c.contract_number,
    contractId,
    productNames: productNames.length > 0 ? productNames : ["your new spa"],
    total: c.total ?? 0,
    depositPaid: c.deposit_paid ?? 0,
    balanceDue: c.balance_due ?? 0,
    portalUrl: APP_URL,
    setupLink,
    contractPdfAttached: !!pdfBase64,
  });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn(`[welcome] RESEND_API_KEY not set — skipping send for contract ${contractId}`);
    return { sent: false, skipped: "no_resend_key" };
  }

  const payload: Record<string, unknown> = {
    from: WELCOME_FROM,
    to: email,
    subject: `Welcome to the Atlas Family, ${customer.first_name ?? "friend"}!`,
    html,
  };
  if (pdfBase64) {
    payload.attachments = [
      { filename: `Contract-${c.contract_number}.pdf`, content: pdfBase64 },
    ];
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errBody = await res.text();
    console.error(
      `[welcome] Resend send FAILED for contract ${contractId} (${email}): ${res.status} ${errBody}`
    );
    return { sent: false, error: errBody, pdfAttached: !!pdfBase64 };
  }

  console.log(
    `[welcome] sent to ${email} for contract ${c.contract_number} (pdf=${!!pdfBase64})`
  );
  return { sent: true, pdfAttached: !!pdfBase64 };
}

// Creates the customer's Supabase auth user if it doesn't already exist.
// Idempotent two ways: we look first, and if a create still collides we treat
// "already registered" as success. Never creates a profiles row (that is the
// staff table) so customers can't gain staff access.
async function ensureCustomerAuthUser(
  admin: ReturnType<typeof createAdminClient>,
  email: string,
  firstName?: string | null,
  lastName?: string | null
): Promise<void> {
  const { data: existing } = await admin.auth.admin.listUsers();
  const found = existing?.users?.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (found) return;

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const { error } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      first_name: firstName ?? "",
      last_name: lastName ?? "",
      role: "customer",
    },
  });
  if (error && !/already.*(regist|exist)/i.test(error.message)) {
    console.error(`[welcome] createUser failed for ${email}:`, error.message);
  }
}
