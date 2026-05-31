import { describe, test, expect } from "bun:test";
import { canActOnContract } from "./contract-access";

// The pure authorization predicate behind every show_manager grant on the
// post-sale surface. The DB-backed scope check (userManagesContractShow) is
// tested in prod against RLS; here we pin the role LOGIC in isolation.
describe("canActOnContract", () => {
  describe("admin / manager — full access, any contract", () => {
    test("admin is allowed regardless of show or bookkeeper flag", () => {
      expect(canActOnContract({ role: "admin", managesThisShow: false })).toBe(true);
      expect(canActOnContract({ role: "admin", managesThisShow: false, allowBookkeeper: true })).toBe(true);
    });
    test("manager is allowed regardless of show or bookkeeper flag", () => {
      expect(canActOnContract({ role: "manager", managesThisShow: false })).toBe(true);
      expect(canActOnContract({ role: "manager", managesThisShow: false, allowBookkeeper: true })).toBe(true);
    });
  });

  describe("bookkeeper — financial surfaces only", () => {
    test("denied on editing/scheduling surfaces (allowBookkeeper defaults false)", () => {
      expect(canActOnContract({ role: "bookkeeper", managesThisShow: false })).toBe(false);
      // managing a show must NOT smuggle a bookkeeper onto a non-financial gate
      expect(canActOnContract({ role: "bookkeeper", managesThisShow: true })).toBe(false);
    });
    test("allowed org-wide on refund surfaces (allowBookkeeper true)", () => {
      expect(canActOnContract({ role: "bookkeeper", managesThisShow: false, allowBookkeeper: true })).toBe(true);
    });
  });

  describe("show_manager — scoped to managed shows", () => {
    test("allowed only when they manage this contract's show", () => {
      expect(canActOnContract({ role: "show_manager", managesThisShow: true })).toBe(true);
      expect(canActOnContract({ role: "show_manager", managesThisShow: true, allowBookkeeper: true })).toBe(true);
    });
    test("denied when the contract is not at a show they manage", () => {
      expect(canActOnContract({ role: "show_manager", managesThisShow: false })).toBe(false);
      // allowBookkeeper must not widen a show_manager — it only affects bookkeeper
      expect(canActOnContract({ role: "show_manager", managesThisShow: false, allowBookkeeper: true })).toBe(false);
    });
  });

  describe("everyone else / unknown — denied", () => {
    test("sales_rep is denied even at a show they happen to manage-match", () => {
      expect(canActOnContract({ role: "sales_rep", managesThisShow: true })).toBe(false);
      expect(canActOnContract({ role: "sales_rep", managesThisShow: true, allowBookkeeper: true })).toBe(false);
    });
    test("null / undefined / empty role is denied", () => {
      expect(canActOnContract({ role: null, managesThisShow: true, allowBookkeeper: true })).toBe(false);
      expect(canActOnContract({ role: undefined, managesThisShow: true, allowBookkeeper: true })).toBe(false);
      expect(canActOnContract({ role: "", managesThisShow: true, allowBookkeeper: true })).toBe(false);
    });
    test("an unrecognized role string is denied", () => {
      expect(canActOnContract({ role: "field_crew", managesThisShow: true, allowBookkeeper: true })).toBe(false);
    });
  });
});
