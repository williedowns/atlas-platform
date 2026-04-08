import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!["admin", "manager"].includes(profile?.role ?? "")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Products with a reorder threshold set
  const { data: products, error } = await supabase
    .from("products")
    .select("id, name, min_stock_qty")
    .gt("min_stock_qty", 0);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!products?.length) return NextResponse.json({ alerts: [] });

  // Count available units per product (not sold or delivered)
  const { data: unitCounts } = await supabase
    .from("inventory_units")
    .select("product_id")
    .in("product_id", products.map((p) => p.id))
    .not("status", "in", '("sold","delivered")');

  const countByProduct = new Map<string, number>();
  for (const unit of unitCounts ?? []) {
    countByProduct.set(unit.product_id, (countByProduct.get(unit.product_id) ?? 0) + 1);
  }

  const alerts = products
    .map((p) => ({ ...p, available: countByProduct.get(p.id) ?? 0 }))
    .filter((p) => p.available <= p.min_stock_qty);

  return NextResponse.json({ alerts });
}
