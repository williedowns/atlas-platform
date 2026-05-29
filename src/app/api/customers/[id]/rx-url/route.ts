import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// GET /api/customers/[id]/rx-url
// Returns a short-lived signed URL for the customer's prescription PDF/image.
// Mirrors /api/contracts/[id]/cert-url so RxViewButton can use the same
// signed-url pattern as CertViewButton.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: customerId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "manager", "bookkeeper", "sales_rep", "field_crew"];
  if (!profile?.role || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("prescription_url")
    .eq("id", customerId)
    .single();

  if (!customer?.prescription_url) {
    return NextResponse.json(
      { error: "No prescription on file for this customer" },
      { status: 404 },
    );
  }

  const parts = customer.prescription_url.split("/customer-files/");
  const path = parts[1];
  if (!path) {
    return NextResponse.json(
      { error: "Could not parse prescription path" },
      { status: 500 },
    );
  }

  const adminSupabase = createAdminClient();
  const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
    .from("customer-files")
    .createSignedUrl(path, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: signedUrlError?.message ?? "Failed to generate signed URL" },
      { status: 500 },
    );
  }

  return NextResponse.json({ signedUrl: signedUrlData.signedUrl });
}
