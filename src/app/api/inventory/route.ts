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
      product:products(id, name, category, line, model_code),
      location:locations(id, name, city, state),
      show:shows(id, name, venue_name)
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

  const { data, error } = await query.limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Post-fetch filter: exact product match when available, then model_code, then category
  let rows = data ?? [];
  if (productId || modelCode || category) {
    rows = rows.filter((u: any) => {
      if (u.product?.id) {
        // Unit has a product FK linked — require exact product match
        return productId ? u.product.id === productId : u.product.category === category;
      }
      // Legacy unit with no product_id: try exact model_code match first ("TS 8.25" etc.)
      if (modelCode) {
        return (u as any).model_code === modelCode;
      }
      // Final fallback: category (only when no model_code provided)
      return category ? getCategoryForModelCode((u as any).model_code) === category : true;
    });
  }

  return NextResponse.json(rows);
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
  } = body;

  const { data, error } = await supabase
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
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
