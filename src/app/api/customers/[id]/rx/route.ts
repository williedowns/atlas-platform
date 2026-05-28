import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/audit";

// POST /api/customers/[id]/rx
// Uploads a doctor's prescription (Rx) to the customer's record. Rx is
// customer-level (not per-contract) because once a customer has a valid
// hydrotherapy Rx on file, every future spa purchase qualifies for the
// Texas hydrotherapy exemption — no need to re-upload per sale.
//
// Triggered from Step 5 of the sale flow after the contract is created, in
// the same fire-and-forget pattern as /api/portal/upload-cert.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: customerId } = await params;

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Missing file" }, { status: 400 });

  // Confirm the caller is staff. Rx uploads originate from the sales floor;
  // self-service customer Rx upload isn't a flow we support yet.
  const { data: staffProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (!staffProfile?.role) {
    return NextResponse.json({ error: "Staff access required" }, { status: 403 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("id, first_name, last_name")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `${customerId}/rx-${Date.now()}.${ext}`;
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from("customer-files")
    .upload(path, buffer, { contentType: file.type, upsert: false });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from("customer-files").getPublicUrl(path);
  const rxUrl = urlData.publicUrl;

  const { error: updateError } = await supabase
    .from("customers")
    .update({
      has_prescription: true,
      prescription_url: rxUrl,
    })
    .eq("id", customerId);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  logAction({
    userId: user.id,
    action: "customer.rx_uploaded",
    entityType: "customer",
    entityId: customerId,
    metadata: {
      customer_name: `${customer.first_name} ${customer.last_name}`.trim(),
      rx_url: rxUrl,
    },
    req,
  });

  return NextResponse.json({ success: true, url: rxUrl });
}
