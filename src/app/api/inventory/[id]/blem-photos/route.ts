import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST — add one or more blem photos to an existing inventory unit.
// Accepts photos as data URLs (rep uploads from iPad camera roll) and
// uploads them to the blem-photos bucket, then inserts the photo rows.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!["admin", "manager", "sales_rep"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const photos: Array<{ photo_url: string; caption?: string; sort_order?: number }> =
    Array.isArray(body?.photos) ? body.photos : [];
  if (photos.length === 0) {
    return NextResponse.json({ error: "No photos provided" }, { status: 400 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const saved: any[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    const dataUrl = p?.photo_url;
    if (!dataUrl?.startsWith("data:image/")) continue;
    const match = dataUrl.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
    if (!match) continue;
    const mime = match[1];
    const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
    const buf = Buffer.from(match[2], "base64");
    const key = `${id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("blem-photos")
      .upload(key, buf, { contentType: mime, upsert: false });
    if (upErr) continue;
    const { data: pub } = supabase.storage.from("blem-photos").getPublicUrl(key);
    const { data: row } = await supabase
      .from("inventory_blem_photos")
      .insert({
        inventory_unit_id: id,
        photo_url: pub.publicUrl,
        caption: p.caption || null,
        sort_order: p.sort_order ?? i,
        created_by: user.id,
      })
      .select()
      .single();
    if (row) saved.push(row);
  }

  return NextResponse.json({ photos: saved });
}

// GET — list active blem photos for a unit (sorted).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("inventory_blem_photos")
    .select("id, photo_url, caption, sort_order, created_at")
    .eq("inventory_unit_id", id)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ photos: data ?? [] });
}
