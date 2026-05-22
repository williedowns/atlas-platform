// ── Concrete pad estimate team — shared email identifiers ────────────────────
// Single source of truth for the three accounts that participate in concrete
// pad estimate routing. Used by:
//   - src/lib/concrete-pad-assignment.ts (state → email lookup)
//   - src/app/api/contracts/[id]/concrete-assignment/route.ts (auth gate)
//   - src/app/site-visits/page.tsx (UI conditional rendering)
//
// All values are stored lowercase to match Supabase auth's normalization.
// If any account's email changes, this is the only place to update.

export const COORDINATOR_EMAIL = "alex@hqatlas.com";
export const OK_KS_REP_EMAIL = "ryan@atlasspas.com";
export const OVERFLOW_EMAIL = "spaguychip@gmail.com";
