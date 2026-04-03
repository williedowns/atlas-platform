import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildWelcomeEmailHtml } from "@/lib/email/welcome-template";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: contract, error } = await supabase
    .from("contracts")
    .select(`
      id, contract_number, total, deposit_paid, balance_due, line_items,
      customer:customers(first_name, last_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !contract) {
    return NextResponse.json({ error: "Contract not found" }, { status: 404 });
  }

  const customer = (contract as any).customer;
  if (!customer?.email) {
    return NextResponse.json({ error: "No customer email" }, { status: 400 });
  }

  const lineItems: any[] = Array.isArray((contract as any).line_items) ? (contract as any).line_items : [];
  const productNames = lineItems
    .filter((i) => !i.waived && i.product_name)
    .map((i) => i.product_name as string);

  const portalUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://app.atlasswimspas.com";

  const html = buildWelcomeEmailHtml({
    customerFirstName: customer.first_name,
    customerEmail: customer.email,
    contractNumber: (contract as any).contract_number,
    productNames: productNames.length > 0 ? productNames : ["your new spa"],
    total: (contract as any).total ?? 0,
    depositPaid: (contract as any).deposit_paid ?? 0,
    balanceDue: (contract as any).balance_due ?? 0,
    portalUrl,
  });

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) {
    console.warn("[welcome-email] RESEND_API_KEY not set — skipping send");
    return NextResponse.json({ skipped: true, reason: "RESEND_API_KEY not configured" });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Atlas Spas <welcome@atlasswimspas.com>",
      to: customer.email,
      subject: `Welcome to the Atlas Family, ${customer.first_name}!`,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[welcome-email] Resend error:", body);
    return NextResponse.json({ error: "Email send failed" }, { status: 500 });
  }

  return NextResponse.json({ sent: true });
}
