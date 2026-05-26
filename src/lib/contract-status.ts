// Derived display status for staff-facing contract list/detail views.
//
// A contract whose DB status is `signed` but which already has third-party
// financing that pays out at sale (Wells Fargo, GreenSky — entries where
// `deduct_from_balance !== false`) has, in practice, had its deposit secured.
// The cash payment routes auto-advance status → `deposit_collected`; the
// financing routes do not, which would otherwise leave these contracts
// visually stuck on "signed". Foundation financing (deduct_from_balance:
// false) does not pay out at sale, so it does NOT trigger the override —
// those contracts still owe a real cash deposit.
export function getDisplayStatus(contract: {
  status?: string | null;
  financing?: unknown;
}): string {
  const status = contract.status ?? "";
  if (status !== "signed") return status;
  if (!Array.isArray(contract.financing)) return status;
  const hasQualifyingFinancing = contract.financing.some(
    (f) =>
      f &&
      typeof f === "object" &&
      (f as { deduct_from_balance?: boolean }).deduct_from_balance !== false
  );
  return hasQualifyingFinancing ? "deposit_collected" : status;
}
