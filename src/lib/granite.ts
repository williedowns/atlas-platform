// ── Crushed Granite Base — site-prep line auto-add ────────────────────────────
// When a salesperson adds a spa (any product with both length_ft and width_ft
// populated) to a contract, we auto-attach a "Crushed Granite Base" line item
// with quantity = max(length, width) feet and a default price of $145/ft.
// The sales rep can adjust price to $135 or $140 via a dropdown in Step 3,
// but quantity is locked (driven by the spa's dimensions).

import type { ContractLineItem, Product } from "@/types";

export const GRANITE_PRODUCT_ID = "812df407-4f9a-4596-9f65-0d73426eddb0";

export const GRANITE_PRICE_TIERS = [135, 140, 145] as const;

export const GRANITE_DEFAULT_PRICE = 145;

export type GranitePrice = (typeof GRANITE_PRICE_TIERS)[number];

/** True if the product needs a Crushed Granite Base auto-added (spas, swim spas, cold tubs). */
export function isSpaWithDimensions(p: Product): boolean {
  return p.length_ft != null && p.width_ft != null;
}

/** Granite quantity is the longest side of the spa, in feet. */
export function getGraniteLength(p: Product): number {
  const length = p.length_ft ?? 0;
  const width = p.width_ft ?? 0;
  return Math.max(length, width);
}

/** Build the granite line item that gets pushed alongside a spa line item. */
export function buildGraniteLineItem(
  spa: Product,
  price: number = GRANITE_DEFAULT_PRICE
): ContractLineItem {
  return {
    product_id: GRANITE_PRODUCT_ID,
    product_name: "Crushed Granite Base",
    msrp: GRANITE_DEFAULT_PRICE,
    sell_price: price,
    quantity: getGraniteLength(spa),
    linked_spa_product_id: spa.id,
  };
}
