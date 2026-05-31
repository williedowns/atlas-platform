import { describe, test, expect } from "bun:test";
import {
  discountableSubtotal,
  solveOutTheDoorDiscount,
  isOutTheDoorDiscount,
} from "@/lib/discounts";

const spaLine = (sell_price: number, quantity = 1) => ({ sell_price, quantity });
const graniteLine = (sell_price: number, quantity: number) => ({
  sell_price,
  quantity,
  discount_excluded: true,
});

describe("discountableSubtotal", () => {
  test("sums discountable lines only, excluding site prep", () => {
    const lines = [spaLine(20000), graniteLine(135, 8)]; // granite = $1,080, excluded
    expect(discountableSubtotal(lines)).toBe(20000);
  });

  test("respects quantity", () => {
    expect(discountableSubtotal([spaLine(100, 3)])).toBe(300);
  });

  test("is zero when every line is excluded", () => {
    expect(discountableSubtotal([graniteLine(135, 8)])).toBe(0);
  });
});

describe("solveOutTheDoorDiscount — granite never roped in (Issue 1, Blake 2026-05-30)", () => {
  // Spa $20,000 + Crushed Granite Base $1,080 (excluded).
  const lines = [spaLine(20000), graniteLine(135, 8)];

  test("a $19,000 spa target yields a $1,000 discount, NOT $2,080", () => {
    expect(solveOutTheDoorDiscount(lines, 19000)).toBe(1000);
  });

  test("invalid targets return null", () => {
    expect(solveOutTheDoorDiscount(lines, 0)).toBeNull();
    expect(solveOutTheDoorDiscount(lines, -5)).toBeNull();
    expect(solveOutTheDoorDiscount(lines, NaN)).toBeNull();
  });

  test("a target at or above the discountable subtotal returns null", () => {
    expect(solveOutTheDoorDiscount(lines, 20000)).toBeNull(); // zero discount
    expect(solveOutTheDoorDiscount(lines, 25000)).toBeNull(); // negative discount
  });

  test("solves to the cent", () => {
    expect(solveOutTheDoorDiscount([spaLine(20000)], 18999.99)).toBe(1000.01);
  });
});

describe("isOutTheDoorDiscount detects the clarified label", () => {
  test("the new '(spa, pre-tax)' suffix is still detected", () => {
    expect(
      isOutTheDoorDiscount("Calculated to $19000.00 out-the-door (spa, pre-tax)"),
    ).toBe(true);
  });

  test("the legacy label is still detected", () => {
    expect(isOutTheDoorDiscount("Calculated to $19000.00 out-the-door")).toBe(true);
  });

  test("a non-OTD label is not detected", () => {
    expect(isOutTheDoorDiscount("Military Discount")).toBe(false);
  });
});
