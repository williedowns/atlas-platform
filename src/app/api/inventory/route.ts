import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getCategoryForModelCode } from "@/lib/inventory-constants";

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const locationId = url.searchParams.get("location_id");
  const showId = url.searchParams.get("show_id");
  const productId = url.searchParams.get("product_id");
  const category = url.searchParams.get("category");
  // model_code of the selected product (e.g. "TS 8.25") — used to match
  // legacy inventory units that were imported without a product_id link
  const modelCode = url.searchParams.get("model_code");
  // When true, don't filter by location — return matching units from all locations
  const allLocations = url.searchParams.get("all_locations") === "true";

  let query = supabase
    .from("inventory_units")
    .select(`
      id, serial_number, order_number, status, unit_type,
      shell_color, cabinet_color, wrap_status, sub_location, model_code,
      blem_description,
      product:products(id, name, category, line, model_code),
      location:locations(id, name, city, state),
      show:shows(id, name, venue_name),
      blem_photos:inventory_blem_photos(id, photo_url, caption, sort_order, deleted_at)
    `)
    .order("created_at", { ascending: false });

  if (status) {
    const statuses = status.split(",");
    if (statuses.length > 1) query = query.in("status", statuses);
    else query = query.eq("status", status);
  }
  // Only apply location/show filter when not browsing all locations
  if (!allLocations) {
    if (locationId) query = query.eq("location_id", locationId);
    else if (showId) query = query.eq("show_id", showId);
  }
  // NOTE: productId is NOT applied as a DB-level filter here — units entered without a
  // product_id link would be silently excluded before the category fallback could catch them.
  // Instead both productId and category are handled in the post-fetch filter below.

  // Limit raised to 2000: at 500 rows ordered by created_at desc, units for an
  // older model could fall off the page BEFORE the post-fetch filter ran,
  // making them invisible to the rep ("inventory won't pull up" — May 2026
  // show floor). Filters below stay in the API layer because legacy units
  // have no product_id link and we still want to match them by model_code.
  const { data, error } = await query.limit(2000);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Post-fetch filter: try product_id first, then model_code (works for both
  // linked and legacy units), then category. The previous version dropped
  // any unit whose product_id linked to a DIFFERENT product UUID even when
  // model_code matched — common when the products table has near-duplicate
  // rows (e.g. "TS 6.2" vs "TS 6.25") and only one is selected.
  let rows = data ?? [];
  if (productId || modelCode || category) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rows = rows.filter((u: any) => {
      if (productId && u.product?.id === productId) return true;
      if (modelCode) {
        if (u.model_code === modelCode) return true;
        if (u.product?.model_code === modelCode) return true;
      }
      // Only short-circuit when the unit is LINKED to a (different) product —
      // those definitively belong elsewhere. Legacy show-floor units have
      // product_id NULL (imported by model_code), so they must fall through to
      // the category match below; otherwise selecting a product hides every
      // unlinked unit and the picker shows nothing ("none at the show" —
      // Blake, May 2026 show floor).
      if (productId && u.product?.id) return false;
      if (category) {
        if (u.product?.category === category) return true;
        if (getCategoryForModelCode(u.model_code) === category) return true;
        return false;
      }
      // A product was selected but we have no category to constrain on (the
      // selected product row has a null/blank category). Don't fall through to
      // the match-everything `return true` below — that would surface every
      // unlinked unit. Exclude instead; the rep can use "Show All Locations".
      if (productId) return false;
      return true;
    });
  }

  // Strip soft-deleted blem photos before returning + sort by sort_order
  // so the picker shows the canonical lead photo first.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cleaned = rows.map((u: any) => {
    const photos = Array.isArray(u.blem_photos) ? u.blem_photos : [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const active = photos.filter((p: any) => !p.deleted_at)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    return { ...u, blem_photos: active, blem_photo_count: active.length };
  });

  return NextResponse.json(cleaned);
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const {
    product_id, serial_number, order_number, status, unit_type,
    shell_color, cabinet_color, wrap_status, sub_location,
    location_id, show_id, received_date, notes,
    blem_description,
    blem_photos,  // staged photos: [{ photo_url (data URL), caption, sort_order }]
  } = body;

  const { data: unit, error } = await supabase
    .from("inventory_units")
    .insert({
      product_id: product_id || null,
      serial_number: serial_number || null,
      order_number: order_number || null,
      status: status ?? "at_location",
      unit_type: unit_type ?? "stock",
      shell_color: shell_color || null,
      cabinet_color: cabinet_color || null,
      wrap_status: wrap_status ?? "WR",
      sub_location: sub_location || null,
      location_id: location_id || null,
      show_id: show_id || null,
      received_date: received_date || null,
      notes: notes || null,
      blem_description: (unit_type === "blem" ? (blem_description || null) : null),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Persist staged blem photos. Data URLs are uploaded to the blem-photos
  // bucket and the resulting public URLs are inserted into
  // inventory_blem_photos. We do this server-side so the upload runs with
  // service credentials and so partial failure can be returned to the rep
  // (rather than leaving orphan data URLs in the table).
  let savedPhotos: Array<{ id: string; photo_url: string; caption: string | null; sort_order: number }> = [];
  if (unit_type === "blem" && Array.isArray(blem_photos) && blem_photos.length > 0) {
    for (let i = 0; i < blem_photos.length; i++) {
      const p = blem_photos[i];
      const dataUrl: string | undefined = p?.photo_url;
      if (!dataUrl?.startsWith("data:image/")) continue;
      try {
        const match = dataUrl.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
        if (!match) continue;
        const mime = match[1];
        const base64 = match[2];
        const ext = mime.split("/")[1]?.replace("jpeg", "jpg") ?? "jpg";
        const buf = Buffer.from(base64, "base64");
        const key = `${unit.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("blem-photos")
          .upload(key, buf, { contentType: mime, upsert: false });
        if (upErr) continue;
        const { data: pub } = supabase.storage.from("blem-photos").getPublicUrl(key);
        const { data: photoRow } = await supabase
          .from("inventory_blem_photos")
          .insert({
            inventory_unit_id: unit.id,
            photo_url: pub.publicUrl,
            caption: p.caption || null,
            sort_order: i,
            created_by: user.id,
          })
          .select()
          .single();
        if (photoRow) {
          savedPhotos.push({
            id: photoRow.id,
            photo_url: photoRow.photo_url,
            caption: photoRow.caption,
            sort_order: photoRow.sort_order,
          });
        }
      } catch {
        // Continue with remaining photos — partial success is acceptable;
        // the rep can re-add missing photos from the unit detail page.
      }
    }
  }

  return NextResponse.json({ ...unit, blem_photos: savedPhotos }, { status: 201 });
}
