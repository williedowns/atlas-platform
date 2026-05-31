import { describe, test, expect } from "bun:test";
import { canActOnContract, type ActorRole } from "./contract-access";

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

// The cancel route (POST /api/contracts/[id]/cancel) authorizes with this exact
// predicate config (allowBookkeeper: true). Atlas's rule is "Full, except delete":
// cancel IS granted to a show_manager (scoped to shows they manage); DELETE is
// NOT (admin-only, enforced in the DELETE handler — not by this predicate). This
// block pins the cancel matrix so a future refactor of the cancel gate can't
// silently regress it.
describe("cancel contract — 'full, except delete' (allowBookkeeper: true)", () => {
  const canCancel = (role: ActorRole, managesThisShow: boolean) =>
    canActOnContract({ role, managesThisShow, allowBookkeeper: true });

  test("admin can cancel any deal", () => {
    expect(canCancel("admin", false)).toBe(true);
  });
  test("manager can cancel any deal", () => {
    expect(canCancel("manager", false)).toBe(true);
  });
  test("bookkeeper can cancel (financial surface)", () => {
    expect(canCancel("bookkeeper", false)).toBe(true);
  });
  test("show_manager can cancel a deal at a show they manage", () => {
    expect(canCancel("show_manager", true)).toBe(true);
  });
  test("show_manager cannot cancel a deal at a show they do NOT manage", () => {
    expect(canCancel("show_manager", false)).toBe(false);
  });
  test("sales_rep cannot cancel even at a show they manage-match", () => {
    expect(canCancel("sales_rep", true)).toBe(false);
  });
});
