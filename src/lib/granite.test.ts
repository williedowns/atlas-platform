import { describe, test, expect } from "bun:test";
import { getGraniteLength, buildGraniteLineItem, GRANITE_PRODUCT_ID } from "@/lib/granite";
import type { Product } from "@/types";

// getGraniteLength/buildGraniteLineItem only read id + dimensions at runtime,
// so a minimal cast is enough.
function spa(length_ft: number, width_ft: number, id = "spa-1"): Product {
  return { id, length_ft, width_ft } as Product;
}

describe("getGraniteLength — rounds UP to whole feet (Issue 2)", () => {
  test("7.83 ft (94in) spa rounds up to 8", () => {
    expect(getGraniteLength(spa(7.83, 6.5))).toBe(8);
  });

  test("uses the longer side when width is greater", () => {
    expect(getGraniteLength(spa(6.5, 7.83))).toBe(8);
  });

  test("an already-whole length is left unchanged", () => {
    expect(getGraniteLength(spa(8, 7))).toBe(8);
  });

  test("7.5 ft still rounds up to 8 (never down)", () => {
    expect(getGraniteLength(spa(7.5, 7.0))).toBe(8);
  });

  test("missing dimensions yield 0", () => {
    expect(getGraniteLength({ id: "x" } as Product)).toBe(0);
  });
});

describe("buildGraniteLineItem", () => {
  test("quantity is the rounded-up longest side", () => {
    expect(buildGraniteLineItem(spa(7.83, 6.5)).quantity).toBe(8);
  });

  test("defaults to $145/ft, is discount-excluded, and links the spa", () => {
    const li = buildGraniteLineItem(spa(8, 7));
    expect(li.sell_price).toBe(145);
    expect(li.discount_excluded).toBe(true);
    expect(li.product_id).toBe(GRANITE_PRODUCT_ID);
    expect(li.linked_spa_product_id).toBe("spa-1");
  });

  test("a price-tier override is respected", () => {
    expect(buildGraniteLineItem(spa(8, 7), 135).sell_price).toBe(135);
  });

  test("an 8 ft spa at $135/ft totals $1,080 of base", () => {
    const li = buildGraniteLineItem(spa(7.83, 6.5), 135);
    expect(li.quantity * li.sell_price).toBe(1080);
  });
});
