import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { syncProducts, type QBOItem } from "@/lib/qbo/client";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const qboItems: QBOItem[] = await syncProducts();

  let synced = 0;
  let errors = 0;

  for (const item of qboItems) {
    if (item.Type !== "Inventory" && item.Type !== "NonInventory") continue;

    const { error } = await supabase
      .from("products")
      .upsert(
        {
          qbo_item_id: item.Id,
          name: item.Name,
          sku: item.Sku ?? null,
          description: item.Description ?? null,
          msrp: item.UnitPrice ?? 0,
          active: item.Active,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "qbo_item_id" }
      );

    if (error) {
      console.error(`Failed to sync item ${item.Id}:`, error);
      errors++;
    } else {
      synced++;
    }
  }

  return NextResponse.json({ synced, errors, total: qboItems.length });
}
