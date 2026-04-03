import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

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

  // ── Ownership check ────────────────────────────────────────────────────────
  // Staff members (admin / manager / bookkeeper / etc.) can upload on behalf of any contract.
  // For portal customers, verify their auth email matches the contract's customer email.
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const isStaff = !!staffProfile?.role;

  // Fetch the contract (and its customer's email) to validate ownership
  const { data: contract } = await supabase
    .from("contracts")
    .select("id, contract_number, customer_id, customer:customers(id, email)")
    .eq("id", contractId)
    .single();

  if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  if (!isStaff) {
    // For portal customers: verify auth email matches contract customer email (case-insensitive)
    const customerEmail = (
      Array.isArray(contract.customer)
        ? (contract.customer[0] as { email?: string } | null)?.email
        : (contract.customer as { email?: string } | null)?.email
    ) ?? "";

    const authEmail = user.email ?? "";
    if (authEmail.toLowerCase() !== customerEmail.toLowerCase()) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }
  }

  // ── Upload to Supabase Storage ─────────────────────────────────────────────
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${contractId}/tax-exemption-cert-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("tax-certs")
    .upload(path, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: urlData } = supabase.storage.from("tax-certs").getPublicUrl(path);
  const certUrl = urlData.publicUrl;

  // ── Update contract ────────────────────────────────────────────────────────
  await supabase.from("contracts").update({
    tax_exempt_cert_received: true,
    tax_exempt_cert_received_at: new Date().toISOString(),
    // Save cert URL so bookkeeper can view the actual document (migration 018)
    tax_exempt_cert_url: certUrl,
  }).eq("id", contractId);

  // ── Audit log ──────────────────────────────────────────────────────────────
  logAction({
    userId: user.id,
    action: "cert.uploaded",
    entityType: "contract",
    entityId: contractId,
    metadata: {
      contract_number: (contract as any).contract_number,
      cert_url: certUrl,
      uploaded_by: isStaff ? "staff" : "customer",
    },
    req,
  });

  // ── Notify bookkeeper (Resend) ─────────────────────────────────────────────
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
        subject: `⚠️ Tax Refund Needed — Contract ${(contract as any).contract_number}`,
        html: `
          <p>A tax exemption certificate has been uploaded for contract <strong>${(contract as any).contract_number}</strong>.</p>
          <p><strong>Action required:</strong> Please review the certificate and issue the tax refund in QuickBooks.</p>
          <p><a href="${appUrl}/bookkeeper" style="background:#00929C;color:white;padding:10px 20px;border-radius:8px;text-decoration:none;display:inline-block;margin-top:8px;">Open Bookkeeper Dashboard</a></p>
          <p style="margin-top:12px;">Certificate file: <a href="${certUrl}">${certUrl}</a></p>
        `,
      }),
    }).catch(() => {/* non-fatal */});
  }

  return NextResponse.json({ success: true, url: certUrl });
}
