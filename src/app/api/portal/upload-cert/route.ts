import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const contractId = formData.get("contractId") as string | null;

  if (!file || !contractId) {
    return NextResponse.json({ error: "Missing file or contractId" }, { status: 400 });
  }

  // Verify this customer owns this contract
  const { data: customer } = await supabase
    .from("customers").select("id").eq("email", user.email ?? "").maybeSingle();

  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 403 });

  const { data: contract } = await supabase
    .from("contracts").select("id, customer_id, contract_number")
    .eq("id", contractId).eq("customer_id", customer.id).single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  // Upload to Supabase Storage
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${contractId}/tax-exemption-cert-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("tax-certs")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("tax-certs").getPublicUrl(path);

  // Mark cert received on contract
  await supabase.from("contracts").update({
    tax_exempt_cert_received: true,
    tax_exempt_cert_received_at: new Date().toISOString(),
  }).eq("id", contractId);

  // Notify Lori via Resend (best-effort)
  const resendKey = process.env.RESEND_API_KEY;
  const loriEmail = process.env.BOOKKEEPER_EMAIL ?? "lori@atlasswimspas.com";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";

  if (resendKey) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Atlas Spas Platform <noreply@atlasswimspas.com>",
        to: loriEmail,
        subject: `Tax Exemption Cert Received — Contract ${(contract as any).contract_number}`,
        html: `<p>A tax exemption certificate has been uploaded by the customer for contract <strong>${(contract as any).contract_number}</strong>.</p><p><a href="${appUrl}/bookkeeper">View in Bookkeeper Dashboard</a></p><p>Certificate file: <a href="${urlData.publicUrl}">${urlData.publicUrl}</a></p>`,
      }),
    }).catch(() => {/* non-fatal */});
  }

  return NextResponse.json({ success: true, url: urlData.publicUrl });
}
