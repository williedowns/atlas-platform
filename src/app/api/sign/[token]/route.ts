import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

// Public endpoint — accepts a signature submission from a customer who
// followed the email link to /sign/[token]. Validates the token, uploads
// the captured signature/initials to Supabase Storage, flips the contract
// row from `quote` to `signed`, and triggers the welcome email side
// effects that the in-person Step 7 flow already produces.
//
// No authenticated user — the token *is* the auth.

interface SignSubmitBody {
  printed_name: string;
  signature_data_url: string;
  initials: {
    sales_final: string | null;
    cancellation_forfeit: string | null;
    rx_30_day: string | null;
  };
  electronic_consent: boolean;
}

async function uploadDataUrl(
  supabase: Awaited<ReturnType<typeof createClient>>,
  dataUrl: string,
  path: string
): Promise<string | null> {
  try {
    const blob = await fetch(dataUrl).then((r) => r.blob());
    const { error } = await supabase.storage
      .from("signatures")
      .upload(path, blob, { contentType: "image/png", upsert: true });
    if (error) return null;
    const { data } = supabase.storage.from("signatures").getPublicUrl(path);
    return data.publicUrl;
  } catch {
    return null;
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const supabase = await createClient();

  const body = (await req.json().catch(() => null)) as SignSubmitBody | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const printedName = (body.printed_name ?? "").trim();
  const signatureDataUrl = body.signature_data_url;
  const initials = body.initials ?? { sales_final: null, cancellation_forfeit: null, rx_30_day: null };

  if (!printedName) {
    return NextResponse.json({ error: "Printed name is required" }, { status: 400 });
  }
  if (!signatureDataUrl?.startsWith("data:image/")) {
    return NextResponse.json({ error: "Signature is required" }, { status: 400 });
  }
  if (!body.electronic_consent) {
    return NextResponse.json({ error: "Electronic consent is required" }, { status: 400 });
  }
  if (!initials.sales_final || !initials.cancellation_forfeit || !initials.rx_30_day) {
    return NextResponse.json(
      { error: "All three required acknowledgments must be initialed" },
      { status: 400 }
    );
  }

  const { data: contract, error: lookupError } = await supabase
    .from("contracts")
    .select("id, contract_number, status, signing_token, signing_token_expires_at, sales_rep_id")
    .eq("signing_token", token)
    .maybeSingle();

  if (lookupError || !contract) {
    return NextResponse.json(
      { error: "This signing link is no longer valid. Please contact your sales rep for a new link." },
      { status: 404 }
    );
  }
  if (contract.status !== "quote") {
    return NextResponse.json(
      { error: "This contract has already been signed." },
      { status: 409 }
    );
  }
  const expiresAt = contract.signing_token_expires_at
    ? new Date(contract.signing_token_expires_at)
    : null;
  if (!expiresAt || expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { error: "This signing link has expired. Please contact your sales rep for a new link." },
      { status: 410 }
    );
  }

  // Upload signature + initials to Storage. Fall back to inline data URL if
  // upload fails so signing still completes (matches Step 7's resilience).
  const nowIso = new Date().toISOString();
  const tsSlug = Date.now();
  const signatureUrl =
    (await uploadDataUrl(supabase, signatureDataUrl, `${contract.id}/${tsSlug}-signature.png`)) ??
    signatureDataUrl;
  const salesFinalUrl =
    (await uploadDataUrl(supabase, initials.sales_final, `${contract.id}/${tsSlug}-sales-final.png`)) ??
    initials.sales_final;
  const cancelForfeitUrl =
    (await uploadDataUrl(
      supabase,
      initials.cancellation_forfeit,
      `${contract.id}/${tsSlug}-cancel-forfeit.png`
    )) ?? initials.cancellation_forfeit;
  const rx30DayUrl =
    (await uploadDataUrl(supabase, initials.rx_30_day, `${contract.id}/${tsSlug}-rx-30day.png`)) ??
    initials.rx_30_day;

  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  const userAgent = req.headers.get("user-agent") ?? "unknown";

  const signatureMetadata = {
    ip_address: ip,
    user_agent: userAgent,
    electronic_consent: true,
    consent_timestamp: nowIso,
    signed_name: printedName,
    signed_remotely: true,
    acknowledgments: {
      sales_final: true,
      sales_final_initials_url: salesFinalUrl,
      cancellation_forfeit: true,
      cancellation_forfeit_initials_url: cancelForfeitUrl,
      rx_30_day: true,
      rx_30_day_initials_url: rx30DayUrl,
      acknowledged_at: nowIso,
    },
  };

  const { error: updateError } = await supabase
    .from("contracts")
    .update({
      status: "signed",
      signed_at: nowIso,
      customer_signature_url: signatureUrl,
      signature_metadata: signatureMetadata,
      // Clear the token so the URL stops working after a successful sign.
      signing_token: null,
      signing_token_expires_at: null,
    })
    .eq("id", contract.id)
    .eq("status", "quote"); // race guard

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Audit (under the sales rep's user_id since the customer has no auth user).
  if (contract.sales_rep_id) {
    logAction({
      userId: contract.sales_rep_id,
      action: "contract.remote_signed",
      entityType: "contract",
      entityId: contract.id,
      metadata: {
        contract_number: contract.contract_number,
        signed_name: printedName,
        ip_address: ip,
      },
      req,
    });
  }

  // Fire-and-forget welcome email — same side effect as in-person flow.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  if (appUrl) {
    fetch(`${appUrl}/api/contracts/${contract.id}/welcome-email`, { method: "POST" }).catch(
      () => {/* non-fatal */}
    );
  }

  return NextResponse.json({
    ok: true,
    contract_id: contract.id,
    contract_number: contract.contract_number,
  });
}
