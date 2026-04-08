import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Role check
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const allowedRoles = ["admin", "manager", "bookkeeper", "sales_rep", "field_crew"];
  if (!profile?.role || !allowedRoles.includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch cert URL from contract
  const { data: contract } = await supabase
    .from("contracts")
    .select("tax_exempt_cert_url")
    .eq("id", id)
    .single();

  if (!contract?.tax_exempt_cert_url) {
    return NextResponse.json(
      { error: "No certificate found for this contract" },
      { status: 404 }
    );
  }

  // Extract the storage path from the full URL
  const parts = contract.tax_exempt_cert_url.split("/tax-certs/");
  const path = parts[1];
  if (!path) {
    return NextResponse.json(
      { error: "Could not parse certificate path" },
      { status: 500 }
    );
  }

  // Use admin client to create a signed URL (works for private buckets)
  const adminSupabase = createAdminClient();
  const { data: signedUrlData, error: signedUrlError } = await adminSupabase.storage
    .from("tax-certs")
    .createSignedUrl(path, 3600);

  if (signedUrlError || !signedUrlData?.signedUrl) {
    return NextResponse.json(
      { error: signedUrlError?.message ?? "Failed to generate signed URL" },
      { status: 500 }
    );
  }

  return NextResponse.json({ signedUrl: signedUrlData.signedUrl });
}
