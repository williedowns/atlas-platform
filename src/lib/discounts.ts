/**
 * "Out-the-door" discounts come from the Discount Calculator and are identified
 * by label prefix (the API normalizes `type` to "other" on edit, so type-based
 * detection isn't reliable). Only one is allowed per contract.
 */
export function isOutTheDoorDiscount(label: string | null | undefined): boolean {
  if (typeof label !== "string") return false;
  const s = label.toLowerCase().trim();
  return s.startsWith("calculated to") && s.includes("out-the-door");
}

export function countOutTheDoorDiscounts(
  discounts: ReadonlyArray<{ label?: string | null }>,
): number {
  let n = 0;
  for (const d of discounts) {
    if (isOutTheDoorDiscount(d.label)) n++;
  }
  return n;
}

type DiscountableLine = {
  sell_price?: number;
  quantity?: number;
  discount_excluded?: boolean;
};

/**
 * Subtotal of the items an out-the-door discount may be solved against — the
 * spa and other discountable goods. Site-prep lines flagged `discount_excluded`
 * (the Crushed Granite Base) are sold separately and excluded: the discount
 * must never rope them in or bleed onto them. Doc fee and tax are not line
 * items, so they're naturally outside this basis.
 */
export function discountableSubtotal(
  lineItems: ReadonlyArray<DiscountableLine>,
): number {
  const sum = lineItems.reduce(
    (acc, item) =>
      item.discount_excluded ? acc : acc + (item.sell_price ?? 0) * (item.quantity ?? 0),
    0,
  );
  return Math.round(sum * 100) / 100;
}

/**
 * Solve the out-the-door discount: the discount amount that lands the
 * DISCOUNTABLE subtotal exactly on `target` (a pre-tax, pre-fee spa price).
 * Returns null when the target is invalid or implies a non-positive discount,
 * or a discount that would meet/exceed the discountable subtotal.
 */
export function solveOutTheDoorDiscount(
  lineItems: ReadonlyArray<DiscountableLine>,
  target: number,
): number | null {
  if (isNaN(target) || target <= 0) return null;
  const ds = discountableSubtotal(lineItems);
  const discountAmt = Math.round((ds - target) * 100) / 100;
  if (discountAmt <= 0 || discountAmt >= ds) return null;
  return discountAmt;
}
