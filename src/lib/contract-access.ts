// Who may act on the post-sale "modify contract" surface.
//
// The role policy is the same everywhere, but the SCOPE differs by role:
//   - admin / manager      → any contract in their org (org scope enforced by RLS)
//   - bookkeeper           → financial actions only (refunds), org-wide
//   - show_manager         → ONLY contracts sold at a show they manage
//
// This predicate is pure so the authorization LOGIC can be unit-tested in
// isolation. The caller is responsible for computing `managesThisShow` (a DB
// lookup) and passing it in. RLS (migrations 108/109/111/112) is the second
// enforcement layer on the actual table writes.

export type ActorRole = string | null | undefined;

export function canActOnContract(opts: {
  role: ActorRole;
  managesThisShow: boolean;
  // Refund endpoints allow bookkeeper; editing/scheduling endpoints do not.
  allowBookkeeper?: boolean;
}): boolean {
  const { role, managesThisShow, allowBookkeeper = false } = opts;
  if (role === "admin" || role === "manager") return true;
  if (allowBookkeeper && role === "bookkeeper") return true;
  if (role === "show_manager" && managesThisShow) return true;
  return false;
}
