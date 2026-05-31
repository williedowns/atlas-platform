import { describe, test, expect } from "bun:test";
import {
  normalizeMarketingFeedback,
  isMarketingFeedbackEmpty,
  marketingChannelLabel,
  type MarketingFeedback,
} from "./marketing-feedback";

// The validation boundary for the internal lead-attribution checklist (Issue 6).
// normalizeMarketingFeedback is what /api/contracts trusts to turn an arbitrary
// client draft into clean jsonb or NULL; these pin that contract.
describe("normalizeMarketingFeedback", () => {
  describe("nothing meaningful -> null (so an untouched checklist persists as NULL)", () => {
    test("null / undefined / non-object inputs", () => {
      expect(normalizeMarketingFeedback(null)).toBeNull();
      expect(normalizeMarketingFeedback(undefined)).toBeNull();
      expect(normalizeMarketingFeedback("tv")).toBeNull();
      expect(normalizeMarketingFeedback(42)).toBeNull();
      expect(normalizeMarketingFeedback(true)).toBeNull();
    });
    test("empty object and empty-ish fields", () => {
      expect(normalizeMarketingFeedback({})).toBeNull();
      expect(normalizeMarketingFeedback({ heard_about: [] })).toBeNull();
      // whitespace-only text and a false flag are not "meaningful"
      expect(
        normalizeMarketingFeedback({
          heard_about: [],
          heard_about_other: "   ",
          booth_draw: "  ",
          first_time_visitor: false,
        }),
      ).toBeNull();
    });
    test("heard_about that is not an array is treated as empty", () => {
      expect(normalizeMarketingFeedback({ heard_about: "tv" })).toBeNull();
      expect(normalizeMarketingFeedback({ heard_about: { 0: "tv" } })).toBeNull();
    });
  });

  describe("channel cleaning", () => {
    test("keeps known channel keys", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv", "radio", "referral"] });
      expect(mf?.heard_about).toEqual(["tv", "radio", "referral"]);
    });
    test("drops unknown channel keys", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv", "carrier_pigeon", "billboard"] });
      expect(mf?.heard_about).toEqual(["tv"]);
    });
    test("drops non-string entries", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv", 5, null, { key: "radio" }, "social"] });
      expect(mf?.heard_about).toEqual(["tv", "social"]);
    });
    test("dedupes repeated channels", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv", "tv", "radio", "tv"] });
      expect(mf?.heard_about).toEqual(["tv", "radio"]);
    });
  });

  describe('"other" free-text handling', () => {
    test('keeps heard_about_other only when "other" is selected', () => {
      const mf = normalizeMarketingFeedback({
        heard_about: ["other"],
        heard_about_other: "Saw the truck at a gas station",
      });
      expect(mf?.heard_about).toEqual(["other"]);
      expect(mf?.heard_about_other).toBe("Saw the truck at a gas station");
    });
    test('drops heard_about_other when "other" is NOT selected', () => {
      const mf = normalizeMarketingFeedback({
        heard_about: ["tv"],
        heard_about_other: "stray note",
      });
      expect(mf?.heard_about).toEqual(["tv"]);
      expect(mf?.heard_about_other).toBeUndefined();
    });
    test("trims heard_about_other", () => {
      const mf = normalizeMarketingFeedback({
        heard_about: ["other"],
        heard_about_other: "  word of mouth  ",
      });
      expect(mf?.heard_about_other).toBe("word of mouth");
    });
    test('"other" selected but blank note -> the note is omitted, channel stays', () => {
      const mf = normalizeMarketingFeedback({
        heard_about: ["other"],
        heard_about_other: "   ",
      });
      expect(mf?.heard_about).toEqual(["other"]);
      expect(mf?.heard_about_other).toBeUndefined();
    });
    test("non-string heard_about_other is ignored", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["other"], heard_about_other: 123 });
      expect(mf?.heard_about).toEqual(["other"]);
      expect(mf?.heard_about_other).toBeUndefined();
    });
  });

  describe("booth_draw free-text", () => {
    test("trims and keeps booth_draw", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv"], booth_draw: "  the swim spa  " });
      expect(mf?.booth_draw).toBe("the swim spa");
    });
    test("booth_draw alone is meaningful (no channels needed)", () => {
      const mf = normalizeMarketingFeedback({ booth_draw: "the hot tub display" });
      expect(mf).not.toBeNull();
      expect(mf?.heard_about).toEqual([]);
      expect(mf?.booth_draw).toBe("the hot tub display");
    });
    test("blank booth_draw is dropped", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv"], booth_draw: "   " });
      expect(mf?.booth_draw).toBeUndefined();
    });
    test("non-string booth_draw is ignored", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv"], booth_draw: { v: "x" } });
      expect(mf?.booth_draw).toBeUndefined();
    });
  });

  describe("first_time_visitor flag", () => {
    test("true is kept", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv"], first_time_visitor: true });
      expect(mf?.first_time_visitor).toBe(true);
    });
    test("first_time_visitor true alone is meaningful", () => {
      const mf = normalizeMarketingFeedback({ first_time_visitor: true });
      expect(mf).not.toBeNull();
      expect(mf?.first_time_visitor).toBe(true);
    });
    test("false is dropped (absent = not flagged)", () => {
      const mf = normalizeMarketingFeedback({ heard_about: ["tv"], first_time_visitor: false });
      expect(mf?.first_time_visitor).toBeUndefined();
    });
    test('truthy-but-not-true values (e.g. "true", 1) are dropped', () => {
      const a = normalizeMarketingFeedback({ heard_about: ["tv"], first_time_visitor: "true" });
      const b = normalizeMarketingFeedback({ heard_about: ["tv"], first_time_visitor: 1 });
      expect(a?.first_time_visitor).toBeUndefined();
      expect(b?.first_time_visitor).toBeUndefined();
    });
  });

  test("a fully-populated checklist round-trips cleanly", () => {
    const mf = normalizeMarketingFeedback({
      heard_about: ["social", "referral", "other", "social"],
      heard_about_other: "  Nextdoor post  ",
      booth_draw: "  the lights  ",
      first_time_visitor: true,
      stray_field: "ignored",
    });
    expect(mf).toEqual({
      heard_about: ["social", "referral", "other"],
      heard_about_other: "Nextdoor post",
      booth_draw: "the lights",
      first_time_visitor: true,
    } satisfies MarketingFeedback);
  });
});

describe("isMarketingFeedbackEmpty", () => {
  test("null / undefined are empty", () => {
    expect(isMarketingFeedbackEmpty(null)).toBe(true);
    expect(isMarketingFeedbackEmpty(undefined)).toBe(true);
  });
  test("no signal in any field is empty", () => {
    expect(isMarketingFeedbackEmpty({ heard_about: [] })).toBe(true);
    expect(
      isMarketingFeedbackEmpty({
        heard_about: [],
        heard_about_other: "  ",
        booth_draw: "  ",
        first_time_visitor: false,
      }),
    ).toBe(true);
  });
  test("any single populated field makes it non-empty", () => {
    expect(isMarketingFeedbackEmpty({ heard_about: ["tv"] })).toBe(false);
    expect(isMarketingFeedbackEmpty({ heard_about: [], heard_about_other: "x" })).toBe(false);
    expect(isMarketingFeedbackEmpty({ heard_about: [], booth_draw: "x" })).toBe(false);
    expect(isMarketingFeedbackEmpty({ heard_about: [], first_time_visitor: true })).toBe(false);
  });
});

describe("marketingChannelLabel", () => {
  test("maps known keys to human labels", () => {
    expect(marketingChannelLabel("tv")).toBe("TV");
    expect(marketingChannelLabel("social")).toBe("Facebook / Instagram");
    expect(marketingChannelLabel("prior_customer")).toBe("Prior Atlas customer");
    expect(marketingChannelLabel("other")).toBe("Other");
  });
  test("falls back to the raw key when unknown", () => {
    expect(marketingChannelLabel("billboard")).toBe("billboard");
    expect(marketingChannelLabel("")).toBe("");
  });
});
