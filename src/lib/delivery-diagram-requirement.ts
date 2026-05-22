import type { SupabaseClient } from "@supabase/supabase-js";
import { isSpaProduct } from "./inventory-constants";

// A delivery diagram is required whenever the contract contains at least one
// spa-family line item (hot tub, swim spa, cold tub, sauna). Above-ground pool
// contracts are exempt — they ship as kits and use a different install flow.
//
// Line items don't store category in the JSONB blob, so the caller passes the
// product_ids and we look up categories from the products table.
export async function isDeliveryDiagramRequired(
  supabase: SupabaseClient,
  lineItems: Array<{ product_id?: string | null }>
): Promise<boolean> {
  const productIds = Array.from(
    new Set(
      lineItems
        .map((li) => li?.product_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
    )
  );
  if (productIds.length === 0) return false;

  const { data, error } = await supabase
    .from("products")
    .select("id, category")
    .in("id", productIds);
  if (error || !data) return false;

  return data.some((p) => isSpaProduct(p.category));
}

export function isDeliveryDiagramFilled(
  diagram: unknown
): boolean {
  if (diagram === null || diagram === undefined) return false;
  if (Array.isArray(diagram)) return diagram.length > 0;
  if (typeof diagram === "object") return Object.keys(diagram as object).length > 0;
  return false;
}
