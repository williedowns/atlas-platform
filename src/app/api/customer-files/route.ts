import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_CATEGORIES = new Set([
  "drivers_license",
  "proof_of_homeownership",
  "permit_receipt",
  "survey",
  "hoa_approval",
  "income_verification",
  "ach_voided_check",
  "wet_signature_contract",
  "photo",
  "other",
]);

const BUCKET = "customer-files";

// GET /api/customer-files?customer_id=...&contract_id=...&category=...
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const customerId = url.searchParams.get("customer_id");
  const contractId = url.searchParams.get("contract_id");
  const category = url.searchParams.get("category");

  let query = supabase
    .from("customer_files")
    .select("*")
    .order("created_at", { ascending: false });

  if (customerId) query = query.eq("customer_id", customerId);
  if (contractId) query = query.eq("contract_id", contractId);
  if (category) query = query.eq("category", category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Sign each storage path so the client can render previews
  const withUrls = await Promise.all(
    (data ?? []).map(async (f) => {
      const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(f.storage_path, 60 * 30);
      return { ...f, signed_url: signed?.signedUrl ?? null };
    })
  );

  return NextResponse.json({ files: withUrls });
}

// POST /api/customer-files (multipart form: file, customer_id, category, contract_id?, internal_notes?)
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const form = await req.formData();
  const file = form.get("file");
  const customerId = String(form.get("customer_id") ?? "");
  const contractId = String(form.get("contract_id") ?? "") || null;
  const category = String(form.get("category") ?? "");
  const internalNotes = String(form.get("internal_notes") ?? "") || null;

  if (!(file instanceof File)) return NextResponse.json({ error: "file is required" }, { status: 400 });
  if (!customerId) return NextResponse.json({ error: "customer_id is required" }, { status: 400 });
  if (!ALLOWED_CATEGORIES.has(category)) return NextResponse.json({ error: "invalid category" }, { status: 400 });

  const ext = file.name.split(".").pop() ?? "bin";
  const storagePath = `${customerId}/${category}/${Date.now()}-${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: row, error: insertError } = await supabase
    .from("customer_files")
    .insert({
      customer_id: customerId,
      contract_id: contractId,
      category,
      filename: file.name,
      storage_path: storagePath,
      mime_type: file.type || null,
      size_bytes: file.size,
      uploaded_by: user.id,
      internal_notes: internalNotes,
    })
    .select()
    .single();

  if (insertError) {
    // Best-effort cleanup of orphaned blob
    await supabase.storage.from(BUCKET).remove([storagePath]).catch(() => {/* ignore */});
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ file: row }, { status: 201 });
}
