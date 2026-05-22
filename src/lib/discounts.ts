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
